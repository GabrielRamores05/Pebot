package com.cafeos.tablet.data

import fi.iki.elonen.NanoHTTPD
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections
import java.io.File
import java.io.FileInputStream

class LocalWebServer(private val dao: CafeDao, private val onOrderCreated: ((Order) -> Unit)? = null) : NanoHTTPD(PORT) {
    companion object {
        const val PORT = 3000

        fun getLocalAddress(): String {
            return try {
                Collections.list(NetworkInterface.getNetworkInterfaces()).asSequence()
                    .flatMap { Collections.list(it.inetAddresses).asSequence() }
                    .filterIsInstance<Inet4Address>()
                    .firstOrNull { !it.isLoopbackAddress && it.isSiteLocalAddress }
                    ?.hostAddress ?: "127.0.0.1"
            } catch (_: Exception) { "127.0.0.1" }
        }
    }

    override fun serve(session: IHTTPSession): Response {
        return try {
            when {
                session.uri == "/" || session.uri == "/menu" -> htmlResponse(menuPage())
                session.uri == "/kitchen" -> htmlResponse(kitchenPage())
                session.uri == "/api/menu" -> jsonResponse(menuJson())
                session.uri == "/api/payment-qr" -> paymentQrResponse(session)
                session.uri == "/api/orders" && session.method == Method.GET -> jsonResponse(ordersJson())
                session.uri == "/api/orders" && session.method == Method.POST -> {
                    session.parseBody(HashMap())
                    val body = session.parms["postData"] ?: "{}"
                    createOrder(body)
                }
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found")
            }
        } catch (error: Exception) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, error.message ?: "Server error")
        }
    }

    private fun paymentQrResponse(session: IHTTPSession): Response {
        val method = session.parameters["method"]?.firstOrNull()?.uppercase()
        val settings = runBlocking { dao.getBusinessSettingsSync() } ?: return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "QR not configured")
        val path = if (method == "GCASH") settings.gcashQrPath else if (method == "PAYMAYA") settings.paymayaQrPath else null
        val file = path?.let { File(it) }
        return if (file != null && file.exists()) {
            newChunkedResponse(Response.Status.OK, "image/jpeg", FileInputStream(file))
        } else newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "QR not configured")
    }

    private fun menuJson(): String = runBlocking {
        val categories = dao.getAllCategories().first()
        val products = dao.getAllProducts().first().filter { it.available }
        val tables = dao.getAllTables().first().filter { it.status != "CLOSED" }
        val optionGroupsByProduct = products.associate { product ->
            product.id to dao.getProductOptionGroups(product.id).mapNotNull { link ->
                val group = dao.getOptionGroup(link.groupId) ?: return@mapNotNull null
                JSONObject().apply {
                    put("name", group.name)
                    put("selectionType", group.selectionType)
                    put("options", JSONArray().apply {
                        dao.getOptionsByGroup(group.id).forEach { option ->
                            put(JSONObject().put("name", option.name).put("priceDelta", option.priceDelta))
                        }
                    })
                }
            }
        }
        JSONObject().apply {
            put("categories", JSONArray().apply { categories.forEach { put(JSONObject().put("id", it.id).put("name", it.name)) } })
            put("tables", JSONArray().apply { tables.forEach { put(JSONObject().put("id", it.id).put("name", it.name).put("capacity", it.capacity).put("occupied", it.currentOccupants)) } })
            put("products", JSONArray().apply {
                products.forEach {
                    put(JSONObject().put("id", it.id).put("name", it.name).put("price", it.price).put("categoryId", it.categoryId).put("description", it.description ?: "").put("optionGroups", JSONArray().apply { optionGroupsByProduct[it.id].orEmpty().forEach { group -> put(group) } }))
                }
            })
        }.toString()
    }

    private fun ordersJson(): String = runBlocking {
        val products = dao.getAllProducts().first().associateBy { it.id }
        val orders = dao.getAllOrders().first().take(50)
        val sections = dao.getAllTableSectionsNow()
        val tables = dao.getAllTables().first().associateBy { it.id }
        JSONArray().apply {
            orders.forEach { order ->
                put(JSONObject().apply {
                    put("id", order.id)
                    put("orderNumber", order.orderNumber)
                    put("customerName", order.customerName)
                    put("status", order.status)
                    put("totalAmount", order.totalAmount)
                     put("tableLocation", order.tableLocation ?: order.tableId?.let { tableId ->
                         sections.firstOrNull { section -> section.tableIds.split(',').mapNotNull { it.trim().toIntOrNull() }.contains(tableId) }
                             ?.let { section -> "${section.name} / ${tables[tableId]?.name ?: tableId}" }
                             ?: tables[tableId]?.name
                     } ?: "")
                    put("createdAt", order.createdAt)
                    put("items", JSONArray().apply {
                        dao.getOrderItems(order.id).forEach { item ->
                             put(JSONObject().apply {
                                 put("name", products[item.productId]?.name ?: "Item")
                                 put("quantity", item.quantity)
                                 put("subtotal", item.subtotal)
                                 put("options", JSONArray().apply {
                                     dao.getOrderOptions(item.id).forEach { option ->
                                         put("${option.name}: ${option.value}")
                                     }
                                 })
                             })
                        }
                    })
                })
            }
        }.toString()
    }

    private fun createOrder(body: String): Response = runBlocking {
        val payload = JSONObject(body)
        val items = payload.optJSONArray("items") ?: JSONArray()
        if (items.length() == 0) return@runBlocking jsonResponse(JSONObject().put("error", "Cart is empty").toString(), Response.Status.BAD_REQUEST)
        val paymentMethod = payload.optString("paymentMethod", "GCASH").uppercase()
        val proofData = payload.optString("paymentProof", "")
        if ((paymentMethod == "GCASH" || paymentMethod == "PAYMAYA") && !proofData.startsWith("data:image/")) {
            return@runBlocking jsonResponse(JSONObject().put("error", "Upload payment proof before sending the order.").toString(), Response.Status.BAD_REQUEST)
        }

        val now = System.currentTimeMillis()
        val orderNumber = "WEB-${SimpleDateFormat("MMddHHmmss", Locale.US).format(Date(now))}"
        val products = dao.getAllProducts().first().associateBy { it.id }
        for (index in 0 until items.length()) {
            val item = items.getJSONObject(index)
            if (!products.containsKey(item.optInt("productId"))) {
                return@runBlocking jsonResponse(JSONObject().put("error", "A selected product is no longer available.").toString(), Response.Status.BAD_REQUEST)
            }
            if (item.optInt("quantity", 0) <= 0) {
                return@runBlocking jsonResponse(JSONObject().put("error", "Each product must have a valid quantity.").toString(), Response.Status.BAD_REQUEST)
            }
        }
        val tables = dao.getAllTables().first()
        val selectedTableId = payload.optInt("tableId", 0).takeIf { tableId -> tables.any { it.id == tableId && it.status != "CLOSED" } }
        val tableLocation = selectedTableId?.let { tableId ->
            dao.getAllTableSectionsNow().firstOrNull { section ->
                section.tableIds.split(',').mapNotNull { it.trim().toIntOrNull() }.contains(tableId)
            }?.let { section -> "${section.name} / ${tables.first { it.id == tableId }.name}" }
                ?: tables.first { it.id == tableId }.name
        }
        val total = (0 until items.length()).sumOf { index ->
            val item = items.getJSONObject(index)
            val product = products[item.optInt("productId")] ?: return@sumOf 0.0
            val optionDelta = item.optJSONArray("options")?.let { selected ->
                (0 until selected.length()).sumOf { optionIndex ->
                    val selectedOption = selected.getJSONObject(optionIndex)
                    dao.getOptionGroupsByName(selectedOption.optString("name"))
                        .flatMap { dao.getOptionsByGroup(it.id) }
                        .firstOrNull { it.name == selectedOption.optString("value") }
                        ?.priceDelta ?: 0.0
                }
            } ?: 0.0
            (product.price + optionDelta) * item.optInt("quantity", 1)
        }
        val orderId = dao.insertOrder(Order(
            orderNumber = orderNumber,
            customerName = payload.optString("customerName", "Walk-in Customer").ifBlank { "Walk-in Customer" },
            status = "PENDING",
            totalAmount = total,
            paymentMethod = paymentMethod,
            orderType = "DINE_IN",
            tableId = selectedTableId,
            tableLocation = tableLocation,
            createdAt = now
        )).toInt()
        for (index in 0 until items.length()) {
            val item = items.getJSONObject(index)
            val quantity = item.optInt("quantity", 1)
            val product = products[item.optInt("productId")] ?: continue
            val selectedOrderOptions = item.optJSONArray("options")?.let { selected ->
                (0 until selected.length()).mapNotNull { optionIndex ->
                    val selectedOption = selected.getJSONObject(optionIndex)
                    val groupName = selectedOption.optString("name")
                    val option = dao.getOptionGroupsByName(groupName)
                        .flatMap { dao.getOptionsByGroup(it.id) }
                        .firstOrNull { it.name == selectedOption.optString("value") }
                        ?: return@mapNotNull null
                    OrderOption(orderItemId = 0, name = groupName, value = option.name, priceDelta = option.priceDelta, ingredientId = option.ingredientId, ingredientQuantity = option.ingredientQuantity)
                }
            } ?: emptyList()
            val unitPrice = product.price + selectedOrderOptions.sumOf { it.priceDelta }
            val orderItemId = dao.insertOrderItem(OrderItem(
                orderId = orderId,
                productId = product.id,
                quantity = quantity,
                unitPrice = unitPrice,
                subtotal = unitPrice * quantity
            )).toInt()
            dao.insertOrderOptions(selectedOrderOptions.map { it.copy(orderItemId = orderItemId) })
            val ingredients = dao.getAllIngredients().first().associateBy { it.id }
            dao.getProductIngredients(product.id).forEach { recipe ->
                val ingredient = ingredients[recipe.ingredientId] ?: return@forEach
                val consumed = recipe.quantity * quantity
                dao.updateIngredient(ingredient.copy(currentStock = ingredient.currentStock - consumed))
                dao.insertIngredientTransaction(IngredientTransaction(ingredientId = ingredient.id, type = "USAGE", quantity = -consumed, notes = "Customer order consumption"))
            }
            selectedOrderOptions.forEach { option ->
                val ingredientId = option.ingredientId ?: return@forEach
                val ingredient = ingredients[ingredientId] ?: return@forEach
                val consumed = option.ingredientQuantity * quantity
                if (consumed > 0.0) {
                    dao.updateIngredient(ingredient.copy(currentStock = ingredient.currentStock - consumed))
                    dao.insertIngredientTransaction(IngredientTransaction(ingredientId = ingredient.id, type = "USAGE", quantity = -consumed, notes = "Customer add-on: ${option.value}"))
                }
            }
        }
        val proofPath = if (proofData.startsWith("data:image/")) {
            val encoded = proofData.substringAfter("base64,", "")
            val file = File.createTempFile("web-payment-", ".jpg")
            file.writeBytes(android.util.Base64.decode(encoded, android.util.Base64.DEFAULT))
            file.absolutePath
        } else null
        dao.insertPayment(Payment(orderId = orderId, method = paymentMethod, amountTendered = total, screenshotPath = proofPath))
        dao.getOrderById(orderId)?.let { onOrderCreated?.invoke(it) }
        jsonResponse(JSONObject().put("success", true).put("orderNumber", orderNumber).put("totalAmount", total).toString(), Response.Status.CREATED)
    }

    private fun menuPage(): String = page("Pebot Menu", """
        <header><div><span class="eyebrow">PEBOT</span><h1>Order from the menu</h1></div><div class="pill">Local POS</div></header>
        <main><section class="hero"><p>Freshly prepared, served simply.</p><p class="muted">Choose your items, customize them, and send your order to the counter.</p></section><section id="categories" class="categories"></section><section id="products" class="grid"></section><aside class="cart"><div class="cart-head"><h2>Your order</h2><span id="count">0 items</span></div><div id="cart-items" class="cart-items"><p class="muted">Your cart is empty.</p></div><div class="checkout"><label class="field-label" for="customer">Name for the order</label><input id="customer" placeholder="Your name" maxlength="60"><label class="field-label" for="table">Where are you sitting?</label><select id="table" class="table-select"><option value="">Choose a table</option></select><label class="field-label" for="payment">Payment method</label><select id="payment" class="table-select"><option value="GCASH">GCash</option><option value="PAYMAYA">PayMaya</option></select><div id="payment-details" class="payment-details"><img id="payment-qr" class="payment-qr" alt="Payment QR code"><p id="payment-account" class="muted"></p></div><label class="field-label" for="proof">Upload payment proof</label><input id="proof" type="file" accept="image/*" capture="environment"><button onclick="placeOrder()">Send order <span id="total">₱0.00</span></button><p class="muted">Your order is sent after payment proof is uploaded.</p><p id="message" class="muted"></p></div></aside></main><div id="product-modal" class="modal" onclick="closeProduct(event)"><div class="modal-card" onclick="event.stopPropagation()"><button class="modal-close" onclick="closeProduct()">×</button><div class="modal-image"><span class="dot"></span></div><h2 id="modal-name"></h2><p id="modal-description" class="muted"></p><div id="modal-options"></div><button id="modal-add" class="modal-add">Add to order</button></div></div>
        <script>
        let data={categories:[],products:[]},cart=[];
        const peso=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);
        async function load(){data=await fetch('/api/menu').then(r=>r.json());renderCats();renderProducts();document.querySelector('#table').innerHTML='<option value="">Choose a table</option>'+(data.tables||[]).map(t=>'<option value="'+t.id+'">'+esc(t.name)+' · '+t.occupied+'/'+t.capacity+' seated</option>').join('');updatePaymentDetails();}
        document.querySelector('#payment').addEventListener('change',updatePaymentDetails);function updatePaymentDetails(){let method=document.querySelector('#payment').value;document.querySelector('#payment-qr').src='/api/payment-qr?method='+method;document.querySelector('#payment-account').textContent='Scan the '+method+' QR, then upload your receipt.'}
        function renderCats(){document.querySelector('#categories').innerHTML='<button class="cat active" onclick="filter(0,this)">All items</button>'+data.categories.map(c=>'<button class="cat" onclick="filter('+c.id+',this)">'+c.name+'</button>').join('')}
        function filter(id,el){document.querySelectorAll('.cat').forEach(x=>x.classList.remove('active'));el.classList.add('active');renderProducts(id)}
        function renderProducts(id=0){document.querySelector('#products').innerHTML=data.products.filter(p=>!id||p.categoryId===id).map(p=>'<article class="product" onclick="openProduct('+p.id+')"><div><span class="dot"></span><h3>'+esc(p.name)+'</h3><p>'+esc(p.description)+'</p></div><div class="product-foot"><strong>'+peso(p.price)+'</strong><button class="add" onclick="event.stopPropagation();openProduct('+p.id+')">Customize</button></div></article>').join('')}
        let activeProduct=null;let activeOptions=[];
        function openProduct(id){activeProduct=data.products.find(p=>p.id===id);if(!activeProduct)return;activeOptions=(activeProduct.optionGroups||[]).map(g=>({name:g.name,value:g.options[0]?.name||'',priceDelta:Number(g.options[0]?.priceDelta||0)}));document.querySelector('#modal-name').textContent=activeProduct.name;document.querySelector('#modal-description').textContent=activeProduct.description||'';document.querySelector('#modal-options').innerHTML=(activeProduct.optionGroups||[]).map((g,groupIndex)=>'<section class="modal-option"><strong>'+esc(g.name)+'</strong><div class="option-pills">'+g.options.map((o,optionIndex)=>'<button class="option-pill '+(optionIndex===0?'selected':'')+'" onclick="pickOption('+groupIndex+','+optionIndex+',this)">'+esc(o.name)+(o.priceDelta>0?' + '+peso(o.priceDelta):'')+'</button>').join('')+'</div></section>').join('');document.querySelector('#modal-add').textContent='Add to order · '+peso(activeProduct.price+activeOptions.reduce((s,o)=>s+o.priceDelta,0));document.querySelector('#modal-add').onclick=()=>{addConfigured(activeProduct,activeOptions);closeProduct()};document.querySelector('#product-modal').classList.add('open')}
        function pickOption(groupIndex,optionIndex,button){let group=activeProduct.optionGroups[groupIndex],option=group.options[optionIndex];activeOptions[groupIndex]={name:group.name,value:option.name,priceDelta:Number(option.priceDelta||0)};button.parentElement.querySelectorAll('.option-pill').forEach(x=>x.classList.remove('selected'));button.classList.add('selected');document.querySelector('#modal-add').textContent='Add to order · '+peso(activeProduct.price+activeOptions.reduce((s,o)=>s+o.priceDelta,0))}
        function addConfigured(product,options){let delta=options.reduce((s,o)=>s+o.priceDelta,0),x=cart.find(x=>x.productId===product.id&&JSON.stringify(x.options)===JSON.stringify(options));x?x.quantity++:cart.push({productId:product.id,name:product.name,unitPrice:product.price+delta,quantity:1,options:options});renderCart()}
        function closeProduct(event){if(!event||event.target===document.querySelector('#product-modal'))document.querySelector('#product-modal').classList.remove('open')}
        function add(id,button){let p=data.products.find(x=>x.id===id),card=button.closest('.product'),options=[...card.querySelectorAll('select')].map(select=>({name:select.dataset.group,value:select.value,priceDelta:Number(select.selectedOptions[0].dataset.price||0)})),delta=options.reduce((sum,o)=>sum+o.priceDelta,0),x=cart.find(x=>x.productId===id&&JSON.stringify(x.options)===JSON.stringify(options));x?x.quantity++:cart.push({productId:id,name:p.name,unitPrice:p.price+delta,quantity:1,options:options});renderCart()}
        function remove(id){let x=cart.find(x=>x.productId===id);if(!x)return;x.quantity--;if(x.quantity<1)cart=cart.filter(x=>x.productId!==id);renderCart()}
        function renderCart(){let total=cart.reduce((s,x)=>s+x.unitPrice*x.quantity,0);document.querySelector('#count').textContent=cart.reduce((s,x)=>s+x.quantity,0)+' items';document.querySelector('#total').textContent=peso(total);document.querySelector('#cart-items').innerHTML=cart.length?cart.map(x=>'<div class="cart-row"><span>'+esc(x.name)+' × '+x.quantity+'</span><button onclick="remove('+x.productId+')">−</button><strong>'+peso(x.unitPrice*x.quantity)+'</strong></div>').join(''):'<p class="muted">Your cart is empty.</p>'}
        async function placeOrder(){if(!cart.length){document.querySelector('#message').textContent='Add an item before sending your order.';return}let file=document.querySelector('#proof').files[0];if(!file){document.querySelector('#message').textContent='Upload payment proof first.';return}let proof=await new Promise(resolve=>{let reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file)});let r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerName:document.querySelector('#customer').value,tableId:Number(document.querySelector('#table').value)||0,paymentMethod:document.querySelector('#payment').value,paymentProof:proof,items:cart.map(x=>({...x,unitPrice:x.unitPrice,options:x.options||[]}))})});let j=await r.json();document.querySelector('#message').textContent=j.success?'Order '+j.orderNumber+' sent to the counter.':(j.error||('Unable to send order ('+r.status+').'));if(j.success){cart=[];document.querySelector('#proof').value='';renderCart()}}
        const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));load();
        </script>
    """.trimIndent())

    private fun kitchenPage(): String = page("Pebot Kitchen", """
        <header><div><span class="eyebrow">PEBOT / KITCHEN</span><h1>Live orders</h1></div><div class="pill"><span class="live"></span> Local POS</div></header>
        <main><section class="hero"><p>Keep the line moving.</p><p class="muted">Orders refresh automatically from the host tablet.</p></section><section id="orders" class="orders"></section></main>
        <script>
        const peso=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
        let knownOrders=new Set();let voiceReady=false;document.addEventListener('click',()=>{voiceReady=true},{once:true});const speak=message=>{if(voiceReady&&'speechSynthesis' in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(message))}};
        async function load(){let orders=await fetch('/api/orders').then(r=>r.json());orders.filter(o=>o.status!=='CANCELLED').forEach(o=>{if(knownOrders.size&& !knownOrders.has(o.id))speak('New order '+o.orderNumber+' received');knownOrders.add(o.id)});document.querySelector('#orders').innerHTML=orders.filter(o=>o.status!=='CANCELLED').map(o=>'<article class="order"><div class="order-top"><div><span class="eyebrow">'+esc(o.orderNumber)+'</span><h2>'+esc(o.customerName)+'</h2><p class="muted">'+esc(o.tableLocation||'')+'</p></div><span class="status '+o.status.toLowerCase()+'">'+o.status+'</span></div><div class="items">'+o.items.map(i=>'<div><span>'+i.quantity+' × '+esc(i.name)+(i.options&&i.options.length?' <small>('+i.options.map(esc).join(', ')+')</small>':'')+'</span><strong>'+peso(i.subtotal)+'</strong></div>').join('')+'</div><div class="order-bottom"><span>'+new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span><strong>'+peso(o.totalAmount)+'</strong></div></article>').join('')||'<p class="muted">No active orders.</p>'}load();setInterval(load,5000);
        </script>
    """.trimIndent())

    private fun page(title: String, body: String): String = """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>$title</title><style>
    :root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1c1917;background:#f5f3ee}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#ffffff 0,#f5f3ee 48%,#e9e7e0 100%);min-height:100vh}header{display:flex;justify-content:space-between;align-items:center;padding:28px clamp(20px,6vw,80px);border-bottom:1px solid #ddd6c8;background:#ffffffdd;backdrop-filter:blur(18px)}h1{font-size:clamp(26px,4vw,42px);letter-spacing:-.04em;margin:6px 0 0}h2,h3,p{margin:0}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;color:#4a5d3a}.pill{border:1px solid #d7e1cf;border-radius:999px;background:#f1f5ed;padding:9px 14px;font-size:12px;font-weight:700}.live,.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#4a5d3a;margin-right:7px}.hero,main{max-width:1180px;margin:auto}.hero{padding:38px 20px 22px}.hero p:first-child{font-size:22px;font-weight:700}.muted{color:#625d57;font-size:14px;margin-top:7px}.categories{display:flex;gap:8px;overflow:auto;padding:0 20px 20px}.cat{border:1px solid #ddd6c8;background:#fff;color:#625d57;border-radius:999px;padding:10px 16px;white-space:nowrap}.cat.active{background:#23271f;color:white;border-color:#23271f}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;padding:0 20px 300px}.product,.order{background:#fff;border:1px solid #ddd6c8;border-radius:16px;padding:18px;box-shadow:0 10px 24px #23271f0c}.product{min-height:145px;display:flex;flex-direction:column;justify-content:space-between}.product h3{font-size:18px;margin-top:6px}.product p{font-size:13px;color:#625d57;margin-top:7px}.option-label,.field-label{display:block;font-size:11px;font-weight:800;color:#625d57;margin-top:12px}.option-label select,.table-select{width:100%;margin-top:5px;border:1px solid #ddd6c8;border-radius:9px;padding:10px;background:#fbfaf7;color:#1c1917}.product-foot,.order-top,.order-bottom,.cart-head,.cart-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.product-foot{margin-top:18px}.product-foot strong,.order-bottom strong{color:#4a5d3a}.add,button{cursor:pointer;border:0;font-weight:700}.add{background:#4a5d3a;color:white;border-radius:9px;padding:10px 15px}.cart{position:fixed;bottom:0;left:0;right:0;padding:16px max(20px,calc((100vw - 1180px)/2 + 20px));background:#ffffffef;border-top:1px solid #ddd6c8;box-shadow:0 -10px 30px #23271f12;backdrop-filter:blur(18px)}.cart-items{display:flex;gap:16px;overflow:auto;margin:12px 0}.cart-row{min-width:210px;font-size:13px}.cart-row button{background:#eef1eb;border-radius:8px;padding:4px 9px}.checkout{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}.checkout input{border:1px solid #ddd6c8;border-radius:9px;padding:11px;background:white;color:#1c1917}.checkout button{background:#4a5d3a;color:white;border-radius:9px;padding:12px 18px}.orders{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;padding:0 20px 40px}.order h2{font-size:20px;margin-top:6px}.status{border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800}.pending{background:#fff3d6;color:#8a5b00}.preparing{background:#eaf0f7;color:#4b647d}.completed{background:#eaf7ee;color:#2f8f4a}.cancelled{background:#fbe8e5;color:#b3261e}.items{border-top:1px solid #e2dfd7;border-bottom:1px solid #e2dfd7;padding:12px 0;margin:16px 0}.items div{display:flex;justify-content:space-between;padding:5px 0;font-size:14px}.order-bottom{font-size:13px;color:#625d57}@media(max-width:600px){header{padding:22px 20px}.checkout{grid-template-columns:1fr 1fr}.checkout button{grid-column:1/-1;width:100%}}
            .modal{display:none;position:fixed;inset:0;z-index:50;align-items:center;justify-content:center;padding:16px;background:#1c1917aa;backdrop-filter:blur(10px)}.modal.open{display:flex}.modal-card{position:relative;width:min(92vw,440px);max-height:88vh;overflow:auto;border:1px solid #ddd6c8;border-radius:26px;background:#fff;padding:16px;box-shadow:0 24px 70px #1c191755}.modal-close{position:absolute;right:12px;top:12px;width:34px;height:34px;border-radius:50%;background:#eef1eb;color:#1c1917;font-size:22px}.modal-image{height:150px;margin-bottom:16px;border-radius:18px;background:linear-gradient(135deg,#e7eee2,#f7f5f0);padding:16px}.modal-card h2{font-size:24px;color:#1c1917}.modal-option{margin-top:16px;padding:12px;border:1px solid #ddd6c8;border-radius:16px;background:#fbfaf7}.modal-option strong{display:block;color:#1c1917;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.option-pills{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.option-pill{border:1px solid #ddd6c8;border-radius:999px;background:#fff;color:#625d57;padding:8px 11px}.option-pill.selected{border-color:#4a5d3a;background:#4a5d3a;color:white}.modal-add{width:100%;margin-top:16px;border-radius:12px;background:#23271f;color:white;padding:13px 16px}.field-label{display:block;color:#625d57;font-size:11px;font-weight:800;margin:9px 0 4px}.payment-details{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #d7e1cf;border-radius:12px;background:#f1f5ed}.payment-qr{width:76px;height:76px;object-fit:contain;border-radius:8px;background:white}.payment-details .muted{margin:0;color:#4a5d3a}
        </style></head><body>$body</body></html>"""

    private fun htmlResponse(html: String) = newFixedLengthResponse(Response.Status.OK, "text/html; charset=utf-8", html)
    private fun jsonResponse(json: String, status: Response.Status = Response.Status.OK) = newFixedLengthResponse(status, "application/json; charset=utf-8", json)
}
