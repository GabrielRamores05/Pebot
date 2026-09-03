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

/**
 * Serves the café's QR ordering pages on the tablet's LAN (port 3000):
 *  - "/" and "/menu" — the customer menu (styled like the Windows café menu:
 *    top navbar, category chips, photo product cards, cart drawer, voucher
 *    code, and Pay-at-counter or e-wallet-with-proof checkout).
 *  - "/kitchen" — a lightweight kitchen order screen.
 *  - API endpoints for the menu JSON, payment QR images, product photos,
 *    voucher validation and order submission.
 *
 * Prices and discounts are always recomputed here server-side from the
 * product/option/voucher rows — client-supplied pesos are never trusted.
 */
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
                session.uri == "/api/menu-image" -> menuImageResponse(session)
                session.uri == "/api/voucher/check" -> voucherCheckResponse(session)
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

    private fun menuImageResponse(session: IHTTPSession): Response = runBlocking {
        val id = session.parameters["id"]?.firstOrNull()?.toIntOrNull()
        val product = id?.let { pid -> dao.getAllProducts().first().firstOrNull { it.id == pid } }
        val file = product?.imageUrl?.let { File(it) }
        if (file != null && file.exists()) {
            newChunkedResponse(Response.Status.OK, "image/jpeg", FileInputStream(file))
        } else {
            newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Image not found")
        }
    }

    private fun voucherCheckResponse(session: IHTTPSession): Response = runBlocking {
        val code = session.parameters["code"]?.firstOrNull()?.trim()?.uppercase() ?: ""
        val voucher = if (code.isNotEmpty()) {
            dao.getActiveVouchersNow().firstOrNull { it.code.equals(code, ignoreCase = true) }
        } else null
        if (voucher == null) {
            return@runBlocking jsonResponse(
                JSONObject().put("valid", false).put("reason", "Voucher is invalid, expired, or fully used.").toString()
            )
        }
        jsonResponse(
            JSONObject()
                .put("valid", true)
                .put("code", voucher.code)
                .put("discountType", voucher.discountType)
                .put("discountValue", voucher.discountValue)
                .put("minOrderAmount", voucher.minOrderAmount)
                .put("maxDiscount", voucher.maxDiscount)
                .put("usageLeft", (voucher.usageLimit - voucher.usedCount).coerceAtLeast(0))
                .toString()
        )
    }

    private fun menuJson(): String = runBlocking {
        val categories = dao.getAllCategories().first()
        val products = dao.getAllProducts().first().filter { it.available }
        val tables = dao.getAllTables().first().filter { it.status != "CLOSED" }
        val settings = dao.getBusinessSettingsSync()
        val optionGroupsByProduct = products.associate { product ->
            product.id to dao.getProductOptionGroups(product.id).mapNotNull { link ->
                val group = dao.getOptionGroup(link.groupId) ?: return@mapNotNull null
                JSONObject().apply {
                    put("name", group.name)
                    put("selectionType", group.selectionType)
                    put("options", JSONArray().apply {
                        dao.getOptionsByGroup(group.id).forEach { option ->
                            put(JSONObject()
                                .put("name", option.name)
                                .put("priceDelta", option.priceDelta))
                        }
                    })
                }
            }
        }
        JSONObject().apply {
            put("categories", JSONArray().apply { categories.forEach { put(JSONObject().put("id", it.id).put("name", it.name)) } })
            put("tables", JSONArray().apply { tables.forEach { put(JSONObject().put("id", it.id).put("name", it.name).put("occupied", it.currentOccupants)) } })
            put("shopName", settings?.shopName ?: "Pebot")
            put("payment", JSONObject().apply {
                put("gcashAccount", settings?.gcashAccountName ?: "")
                put("gcashQr", if (settings?.gcashQrPath?.let { File(it).exists() } == true) true else false)
                put("paymayaAccount", settings?.paymayaAccountName ?: "")
                put("paymayaQr", if (settings?.paymayaQrPath?.let { File(it).exists() } == true) true else false)
            })
            put("products", JSONArray().apply {
                products.forEach {
                    put(JSONObject()
                        .put("id", it.id)
                        .put("name", it.name)
                        .put("price", it.price)
                        .put("categoryId", it.categoryId)
                        .put("description", it.description ?: "")
                        .put("image", if (it.imageUrl?.let { p -> File(p).exists() } == true) "/api/menu-image?id=${it.id}" else "")
                        .put("optionGroups", JSONArray().apply { optionGroupsByProduct[it.id].orEmpty().forEach { group -> put(group) } }))
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
        val paymentMethod = payload.optString("paymentMethod", "CASH").uppercase()
        val isWallet = paymentMethod == "GCASH" || paymentMethod == "PAYMAYA"
        if (paymentMethod !in setOf("CASH", "GCASH", "PAYMAYA")) {
            return@runBlocking jsonResponse(JSONObject().put("error", "Please choose a payment method.").toString(), Response.Status.BAD_REQUEST)
        }
        val proofData = payload.optString("paymentProof", "")
        if (isWallet && !proofData.startsWith("data:image/")) {
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
        val orderType = if (selectedTableId != null) "DINE_IN" else "TAKEOUT"
        val tableLocation = selectedTableId?.let { tableId ->
            dao.getAllTableSectionsNow().firstOrNull { section ->
                section.tableIds.split(',').mapNotNull { it.trim().toIntOrNull() }.contains(tableId)
            }?.let { section -> "${section.name} / ${tables.first { it.id == tableId }.name}" }
                ?: tables.first { it.id == tableId }.name
        }

        // Server-side line totals — client unit prices are never trusted.
        var subtotal = 0.0
        val resolved = mutableListOf<Pair<JSONObject, List<OrderOption>>>()
        for (index in 0 until items.length()) {
            val item = items.getJSONObject(index)
            val product = products[item.optInt("productId")] ?: continue
            val quantity = item.optInt("quantity", 1)
            val selected = item.optJSONArray("options")
            val options = if (selected != null) {
                (0 until selected.length()).mapNotNull { optionIndex ->
                    val sel = selected.getJSONObject(optionIndex)
                    val groupName = sel.optString("name")
                    dao.getOptionGroupsByName(groupName)
                        .flatMap { dao.getOptionsByGroup(it.id) }
                        .firstOrNull { it.name == sel.optString("value") }
                        ?.let { option ->
                            OrderOption(orderItemId = 0, name = groupName, value = option.name, priceDelta = option.priceDelta, ingredientId = option.ingredientId, ingredientQuantity = option.ingredientQuantity)
                        }
                }
            } else emptyList()
            val unitPrice = product.price + options.sumOf { it.priceDelta }
            subtotal += unitPrice * quantity
            resolved.add(item to options)
        }

        // Voucher discount — validated and computed server-side.
        val voucherCode = payload.optString("voucherCode", "").trim().uppercase()
        var voucherDiscount = 0.0
        var appliedVoucher: LoyaltyVoucher? = null
        if (voucherCode.isNotEmpty()) {
            val voucher = dao.getActiveVouchersNow().firstOrNull { it.code.equals(voucherCode, ignoreCase = true) }
            if (voucher == null) {
                return@runBlocking jsonResponse(
                    JSONObject().put("error", "Voucher \"$voucherCode\" is invalid, expired, or fully used.").toString(),
                    Response.Status.BAD_REQUEST
                )
            }
            if (subtotal < voucher.minOrderAmount) {
                return@runBlocking jsonResponse(
                    JSONObject().put("error", "This voucher needs a minimum order of ₱${voucher.minOrderAmount}.").toString(),
                    Response.Status.BAD_REQUEST
                )
            }
            val raw = when (voucher.discountType) {
                "PERCENTAGE" -> subtotal * voucher.discountValue / 100.0
                else -> voucher.discountValue
            }
            voucherDiscount = raw.coerceAtMost(if (voucher.maxDiscount > 0) voucher.maxDiscount else Double.MAX_VALUE)
            appliedVoucher = voucher
        }

        val total = (subtotal - voucherDiscount).coerceAtLeast(0.0)
        val customerName = payload.optString("customerName", "Walk-in Customer").ifBlank { "Walk-in Customer" }

        val orderId = dao.insertOrder(Order(
            orderNumber = orderNumber,
            customerName = customerName,
            status = "PENDING",
            totalAmount = total,
            discountAmount = voucherDiscount,
            discountRate = if (appliedVoucher?.discountType == "PERCENTAGE") appliedVoucher!!.discountValue else 0.0,
            discountReason = appliedVoucher?.code,
            paymentMethod = paymentMethod,
            orderType = orderType,
            tableId = selectedTableId,
            tableLocation = tableLocation,
            createdAt = now
        )).toInt()

        val ingredients = dao.getAllIngredients().first().associateBy { it.id }
        for ((item, options) in resolved) {
            val quantity = item.optInt("quantity", 1)
            val product = products[item.optInt("productId")] ?: continue
            val unitPrice = product.price + options.sumOf { it.priceDelta }
            val orderItemId = dao.insertOrderItem(OrderItem(
                orderId = orderId,
                productId = product.id,
                quantity = quantity,
                unitPrice = unitPrice,
                subtotal = unitPrice * quantity
            )).toInt()
            dao.insertOrderOptions(options.map { it.copy(orderItemId = orderItemId) })
            dao.getProductIngredients(product.id).forEach { recipe ->
                val ingredient = ingredients[recipe.ingredientId] ?: return@forEach
                val consumed = recipe.quantity * quantity
                dao.updateIngredient(ingredient.copy(currentStock = ingredient.currentStock - consumed))
                dao.insertIngredientTransaction(IngredientTransaction(ingredientId = ingredient.id, type = "USAGE", quantity = -consumed, notes = "Customer order consumption"))
            }
            options.forEach { option ->
                val ingredientId = option.ingredientId ?: return@forEach
                val ingredient = ingredients[ingredientId] ?: return@forEach
                val consumed = option.ingredientQuantity * quantity
                if (consumed > 0.0) {
                    dao.updateIngredient(ingredient.copy(currentStock = ingredient.currentStock - consumed))
                    dao.insertIngredientTransaction(IngredientTransaction(ingredientId = ingredient.id, type = "USAGE", quantity = -consumed, notes = "Customer add-on: ${option.value}"))
                }
            }
        }

        appliedVoucher?.let { voucher ->
            dao.updateVoucher(voucher.copy(usedCount = voucher.usedCount + 1))
        }

        val proofPath = if (proofData.startsWith("data:image/")) {
            val encoded = proofData.substringAfter("base64,", "")
            val file = File.createTempFile("web-payment-", ".jpg")
            file.writeBytes(android.util.Base64.decode(encoded, android.util.Base64.DEFAULT))
            file.absolutePath
        } else null
        dao.insertPayment(Payment(orderId = orderId, method = paymentMethod, amount = total, amountTendered = total, screenshotPath = proofPath))

        // A dine-in web order occupies its table when it was free.
        if (orderType == "DINE_IN" && selectedTableId != null) {
            dao.getTable(selectedTableId)?.let { table ->
                if (table.status == "AVAILABLE") {
                    dao.updateTable(table.copy(status = "OCCUPIED", updatedAt = System.currentTimeMillis()))
                }
            }
        }

        dao.getOrderById(orderId)?.let { onOrderCreated?.invoke(it) }
        jsonResponse(
            JSONObject()
                .put("success", true)
                .put("orderNumber", orderNumber)
                .put("totalAmount", total)
                .toString(),
            Response.Status.CREATED
        )
    }

    private fun menuPage(): String = page("Pebot Menu", """
        <header class="topbar">
          <div class="brand"><span class="logo-dot"></span><div><strong id="brand-name">Pebot</strong><span>Freshly served</span></div></div>
          <div class="top-actions">
            <button class="soft-btn" onclick="openOrders()">My Orders</button>
            <button class="cart-btn" onclick="toggleCart()">Cart <span id="count-badge" class="badge">0</span></button>
          </div>
        </header>
        <main>
          <section class="hero">
            <h1>Order from the menu</h1>
            <p class="muted">Freshly prepared, served simply. Choose your favorites and send your order to the counter.</p>
          </section>
          <nav id="categories" class="chips"></nav>
          <section id="products" class="grid"></section>
        </main>

        <div id="overlay" class="overlay" onclick="closeAll()"></div>

        <div id="modal" class="modal" role="dialog" aria-modal="true">
          <div class="modal-card">
            <button class="modal-close" onclick="closeModal()">×</button>
            <div id="modal-img" class="modal-img"><span class="ph">☕</span></div>
            <h2 id="modal-name"></h2>
            <p id="modal-desc" class="muted"></p>
            <div id="modal-options"></div>
            <button id="modal-add" class="modal-add" onclick="addFromModal()">Add to order</button>
          </div>
        </div>

        <aside id="cart" class="drawer">
          <div class="drawer-head"><div><h2>Your order</h2><span id="count" class="muted">0 items</span></div><button class="modal-close" onclick="toggleCart()">×</button></div>
          <div id="cart-items" class="cart-items"><p class="muted">Your cart is empty.</p></div>
          <div id="checkout" class="checkout">
            <div class="field"><label>Name for the order</label><input id="customer" maxlength="60" placeholder="Your name"></div>
            <div class="field"><label>Where are you sitting?</label>
              <select id="table"><option value="0">Takeout / no table</option></select>
            </div>
            <div class="field"><label>Voucher code (optional)</label>
              <div class="voucher-row"><input id="voucher-input" maxlength="30" placeholder="e.g. SAVE10"><button class="soft-btn" onclick="applyVoucher()">Apply</button></div>
              <p id="voucher-msg" class="muted"></p>
            </div>
            <div class="field"><label>Payment</label>
              <div class="pay-chips">
                <button class="pay-chip" data-pay="CASH" onclick="pickPay('CASH',this)">Pay at counter</button>
                <button class="pay-chip" data-pay="GCASH" onclick="pickPay('GCASH',this)">GCash</button>
                <button class="pay-chip" data-pay="PAYMAYA" onclick="pickPay('PAYMAYA',this)">Maya</button>
              </div>
            </div>
            <div id="wallet-box" class="wallet-box" style="display:none">
              <div class="wallet-line"><img id="payment-qr" class="payment-qr" alt="Payment QR"><p id="payment-account" class="muted"></p></div>
              <div class="field"><label id="proof-label">Upload payment proof</label>
                <label class="file-btn" for="proof">Choose image from gallery…</label>
                <input id="proof" type="file" accept="image/*">
                <span id="proof-name" class="muted"></span>
              </div>
            </div>
            <button class="send" onclick="placeOrder()">Send order <span id="total"></span></button>
            <p id="message" class="muted"></p>
          </div>
        </aside>

        <div id="orders-panel" class="orders-panel">
          <div class="drawer-head"><div><h2>My Orders</h2></div><button class="modal-close" onclick="closeOrders()">×</button></div>
          <div id="orders-list" class="cart-items"><p class="muted">No orders yet on this device.</p></div>
        </div>

        <div id="toast" class="toast"></div>
        <script>
        var data={categories:[],products:[],shopName:'Pebot'},cart=[],voucher=null,payment='CASH',activeProduct=null,activeSelections=[],myOrders=[];
        var firstChip=document.querySelector('.pay-chip');if(firstChip){firstChip.classList.add('selected')}
        var peso=function(n){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n)};
        var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
        function imgFail(img){img.style.display='none';img.parentNode.classList.add('noimg')}
        function closeAll(){q('#cart').classList.remove('open');q('#orders-panel').classList.remove('open');q('#modal').classList.remove('open');q('#overlay').classList.remove('show')}
        function q(sel){return document.querySelector(sel)}
        function showToast(t){var el=q('#toast');el.textContent=t;el.classList.add('show');setTimeout(function(){el.classList.remove('show')},2600)}
        function load(){return fetch('/api/menu').then(function(r){return r.json()}).then(function(d){data=d;if(q('#brand-name')){q('#brand-name').textContent=d.shopName}renderCats();renderProducts();var tb=q('#table');tb.innerHTML='<option value="0">Takeout / no table</option>'+(d.tables||[]).map(function(t){return '<option value="'+t.id+'">'+esc(t.name)+' · '+t.occupied+' seated</option>'}).join('');document.title=d.shopName+' — Order';loadMyOrders()})}
        function renderCats(){q('#categories').innerHTML='<button class="chip active" onclick="filter(0,this)">All items</button>'+data.categories.map(function(c){return '<button class="chip" onclick="filter('+c.id+',this)">'+esc(c.name)+'</button>'}).join('')}
        function filter(id,el){document.querySelectorAll('.chip').forEach(function(x){x.classList.remove('active')});el.classList.add('active');renderProducts(id)}
        function imgHtml(p,cls){if(!p.image){return '<span class="'+cls+' noimg"><span class="ph">☕</span></span>'}return '<div class="'+cls+'"><img loading="lazy" src="'+p.image+'" onerror="imgFail(this)" alt=""></div>'}
        function renderProducts(id){q('#products').innerHTML=data.products.filter(function(p){return !id||p.categoryId===id}).map(function(p){
          var gs=(p.optionGroups||[]).map(function(g){return '<span class="mini-tag">'+esc(g.name)+'</span>'}).join('');
          return '<article class="product" onclick="openProduct('+p.id+')">'+imgHtml(p,'p-img')+'<div class="p-body"><h3>'+esc(p.name)+'</h3><p>'+esc(p.description)+'</p><div class="p-foot"><strong>'+peso(p.price)+'</strong>'+ (gs?'<div class="mini-tags">'+gs+'</div>':'')+'<button class="add" onclick="event.stopPropagation();openProduct('+p.id+')">Customize</button></div></div></article>'
        }).join('')}
        function openProduct(id){activeProduct=data.products.find(function(p){return p.id===id});if(!activeProduct)return;
          activeSelections=(activeProduct.optionGroups||[]).map(function(g){return {name:g.name,selectionType:g.selectionType,value:(g.selectionType==='multi'?[]:''),priceDelta:0}});
          var mi=q('#modal-img');mi.innerHTML=imgHtml(activeProduct,'modal-img');
          q('#modal-name').textContent=activeProduct.name;q('#modal-desc').textContent=activeProduct.description||'';
          q('#modal-options').innerHTML=(activeProduct.optionGroups||[]).map(function(g,gi){
            return '<section class="opt-group"><strong>'+esc(g.name)+'</strong><p class="muted hint">'+(g.selectionType==='multi'?'Choose any that apply':'Choose one')+'</p><div class="option-pills">'+
              g.options.map(function(o,oi){return '<button class="option-pill'+(g.selectionType!=='multi'&&oi===0?' selected':'')+'" onclick="pick('+gi+','+oi+',this)">'+esc(o.name)+(o.priceDelta>0?' + '+peso(o.priceDelta):'')+'</button>'}).join('')+
            '</div></section>'}).join('');
          activeProduct.optionGroups.forEach(function(g,gi){if(g.selectionType!=='multi'&&g.options.length){var o=g.options[0];activeSelections[gi].value=o.name;activeSelections[gi].priceDelta=Number(o.priceDelta||0)}});
          q('#modal').classList.add('open');q('#overlay').classList.add('show');
        }
        function pick(gi,oi,btn){var g=activeProduct.optionGroups[gi],o=g.options[oi],s=activeSelections[gi];
          if(g.selectionType==='multi'){
            var vs=(s.value||[]).slice();var ix=vs.indexOf(o.name);
            if(ix>=0){vs.splice(ix,1);btn.classList.remove('selected')}else{vs.push(o.name);btn.classList.add('selected')}
            s.value=vs;
          }else{
            btn.parentElement.querySelectorAll('.option-pill').forEach(function(x){x.classList.remove('selected')});
            btn.classList.add('selected');s.value=o.name;s.priceDelta=Number(o.priceDelta||0);
          }}
        function selectedOptions(){var out=[];
          activeSelections.forEach(function(s){var g=activeProduct.optionGroups.filter(function(x){return x.name===s.name})[0];if(!g)return;
            if(s.selectionType==='multi'){(s.value||[]).forEach(function(v){var o=g.options.filter(function(x){return x.name===v})[0];if(o)out.push({name:s.name,value:v,priceDelta:Number(o.priceDelta||0)})})}
            else if(s.value){var o2=g.options.filter(function(x){return x.name===s.value})[0];if(o2)out.push({name:s.name,value:s.value,priceDelta:Number(o2.priceDelta||0)})}
          });return out}
        function addFromModal(){addItem(activeProduct,selectedOptions());closeModal()}
        function addItem(p,options){var delta=options.reduce(function(s,o){return s+Number(o.priceDelta||0)},0);var line=cart.find(function(x){return x.productId===p.id&&JSON.stringify(x.options)===JSON.stringify(options)});if(line){line.quantity++}else{cart.push({productId:p.id,name:p.name,unitPrice:p.price+delta,quantity:1,options:options||[]})}renderCart();showToast(p.name+' added to your order')}
        function changeQty(i,d){var x=cart[i];x.quantity+=d;if(x.quantity<1){cart.splice(i,1)}renderCart()}
        function removeLine(i){cart.splice(i,1);renderCart()}
        function lineDesc(o){return o&&o.length?o.map(function(x){return x.name+': '+x.value}).join(', '):''}
        function estDiscount(){if(!voucher)return 0;var sub=cart.reduce(function(s,x){return s+x.unitPrice*x.quantity},0);var raw=voucher.discountType==='PERCENTAGE'?sub*voucher.discountValue/100:voucher.discountValue;return Math.min(raw,voucher.maxDiscount>0?voucher.maxDiscount:raw)}
        function renderCart(){var total=cart.reduce(function(s,x){return s+x.unitPrice*x.quantity},0);var disc=estDiscount();var due=Math.max(0,total-disc);
          q('#count-badge').textContent=cart.reduce(function(s,x){return s+x.quantity},0);q('#count').textContent=cart.reduce(function(s,x){return s+x.quantity},0)+' items';
          q('#cart-items').innerHTML=cart.length?cart.map(function(x,i){return '<div class="cart-row"><div class="cr-main"><strong>'+esc(x.name)+'</strong>'+(x.options&&x.options.length?'<span class="muted">'+esc(lineDesc(x.options))+'</span>':'')+'</div><div class="cr-ops"><button class="qty" onclick="changeQty('+i+',-1)">−</button><span>'+x.quantity+'</span><button class="qty" onclick="changeQty('+i+',1)">+</button><strong>'+peso(x.unitPrice*x.quantity)+'</strong><button class="remove" onclick="removeLine('+i+')">✕</button></div></div>'}).join(''):'<p class="muted">Your cart is empty — tap a product to start.</p>';
          var sum='<div class="sum-row"><span>Subtotal</span><span>'+peso(total)+'</span></div>';if(voucher){sum+='<div class="sum-row gold"><span>'+esc(voucher.code)+' discount</span><span>-'+peso(disc)+'</span></div>'}sum+='<div class="sum-row total"><span>Total</span><span>'+peso(due)+'</span></div>';
          var old=q('#sum-box');if(old)old.remove();var wrap=document.createElement('div');wrap.id='sum-box';wrap.innerHTML=sum;q('#checkout').insertBefore(wrap,q('#checkout').firstChild);
          var t=q('#total');t.textContent=peso(due)}
        function cartCount(){return cart.reduce(function(s,x){return s+x.quantity},0)}
        function toggleCart(){var c=q('#cart');c.classList.toggle('open');q('#overlay').classList.toggle('show',c.classList.contains('open'))}
        function openOrders(){loadMyOrders();q('#orders-panel').classList.add('open');q('#overlay').classList.add('show')}
        function closeOrders(){q('#orders-panel').classList.remove('open');q('#overlay').classList.remove('show')}
        function closeModal(){q('#modal').classList.remove('open');q('#overlay').classList.remove('show')}
        function pickPay(m,btn){payment=m;document.querySelectorAll('.pay-chip').forEach(function(x){x.classList.remove('selected')});btn.classList.add('selected');updatePaymentBox()}
        function updatePaymentBox(){var box=q('#wallet-box');var isWallet=payment!=='CASH';
          if(isWallet){box.style.display='block';var acc=payment==='GCASH'?data.payment.gcashAccount:data.payment.paymayaAccount;var hasQr=payment==='GCASH'?data.payment.gcashQr:data.payment.paymayaQr;
            q('#payment-qr').src='/api/payment-qr?method='+payment;q('#payment-qr').style.display=hasQr?'block':'none';
            q('#payment-account').textContent=acc?('Send to '+payment+' account: '+esc(acc)+'. Keep the reference photo ready.'):(hasQr?'Scan the '+payment+' QR, then upload your receipt.':payment+' QR is not set up yet — pay at the counter instead.');
          }else{box.style.display='none'}}
        function applyVoucher(){var code=q('#voucher-input').value.trim().toUpperCase();if(!code){return}fetch('/api/voucher/check?code='+encodeURIComponent(code)).then(function(r){return r.json()}).then(function(j){if(j.valid){voucher=j;q('#voucher-msg').textContent=j.code+' applied — '+ (j.discountType==='PERCENTAGE'?j.discountValue+'% off':'₱'+j.discountValue+' off')+(j.minOrderAmount>0?' · min ₱'+j.minOrderAmount:'');renderCart()}else{voucher=null;q('#voucher-msg').textContent=j.reason||'Voucher invalid.';renderCart()}}).catch(function(){voucher=null;q('#voucher-msg').textContent='Could not check voucher.'})}
        function fileProof(){var f=q('#proof').files[0];q('#proof-name').textContent=f?f.name:''}
        q('#proof').addEventListener('change',fileProof);
        function readFile(file){return new Promise(function(resolve){var r=new FileReader();r.onload=function(){resolve(r.result)};r.readAsDataURL(file)})}
        function placeOrder(){q('#message').textContent='';
          if(!cart.length){q('#message').textContent='Add an item before sending your order.';return}
          var sub=cart.reduce(function(s,x){return s+x.unitPrice*x.quantity},0);
          if(voucher&&sub<voucher.minOrderAmount){q('#message').textContent='This voucher needs a minimum order of ₱'+voucher.minOrderAmount+'.';return}
          if(payment!=='CASH'&&!q('#proof').files[0]){q('#message').textContent='Upload your payment proof photo from the gallery first.';return}
          var send=function(proofData){
            var tableId=Number(q('#table').value)||0;
            var body=JSON.stringify({customerName:q('#customer').value,tableId:tableId,paymentMethod:payment,voucherCode:voucher?voucher.code:'',paymentProof:proofData,items:cart.map(function(x){return {productId:x.productId,name:x.name,unitPrice:x.unitPrice,quantity:x.quantity,options:x.options||[]}})});
            return fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:body}).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})});
          };
          var task=payment==='CASH'?Promise.resolve(''):readFile(q('#proof').files[0]);
          task.then(send).then(function(res){if(res.ok&&res.j.success){var o={orderNumber:res.j.orderNumber,customerName:q('#customer').value||'Walk-in Customer',totalAmount:res.j.totalAmount,createdAt:new Date().toISOString()};myOrders.push(o);saveMyOrders();
            cart=[];voucher=null;q('#voucher-input').value='';q('#voucher-msg').textContent='';q('#proof').value='';q('#proof-name').textContent='';q('#customer').value='';
            renderCart();toggleCart();q('#message').textContent='';showToast('Order '+o.orderNumber+' sent to the counter.');renderMyOrders()
          }else{q('#message').textContent=res.j.error||('Unable to send order.');}}).catch(function(){q('#message').textContent='Unable to reach the counter. Check the Wi-Fi connection.'})}
        function saveMyOrders(){try{localStorage.setItem('pebot_orders',JSON.stringify(myOrders))}catch(e){}}
        function loadMyOrders(){try{myOrders=JSON.parse(localStorage.getItem('pebot_orders')||'[]')}catch(e){myOrders=[]}renderMyOrders()}
        function renderMyOrders(){q('#orders-list').innerHTML=myOrders.length?myOrders.slice().reverse().map(function(o){return '<div class="order-mini"><div><strong>'+esc(o.orderNumber)+'</strong><p class="muted">'+esc(o.customerName)+' · '+peso(o.totalAmount)+'</p></div><span class="status">Sent</span></div>'}).join(''):'<p class="muted">No orders yet on this device.</p>'}
        load();
        </script>
    """.trimIndent())

    private fun kitchenPage(): String = page("Pebot Kitchen", """
        <header class="topbar"><div class="brand"><span class="logo-dot"></span><div><strong>PEBOT / KITCHEN</strong><span>Live orders</span></div></div><div class="pill"><span class="live"></span> Local POS</div></header>
        <main><section class="hero"><h1>Keep the line moving</h1><p class="muted">Orders refresh automatically from the host tablet.</p></section><section id="orders" class="orders"></section></main>
        <script>
        var peso=function(n){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n)};var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
        var knownOrders=new Set();var voiceReady=false;document.addEventListener('click',function(){voiceReady=true},{once:true});
        function speak(m){if(voiceReady&&'speechSynthesis' in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(m))}}
        function load(){fetch('/api/orders').then(function(r){return r.json()}).then(function(orders){
          orders.filter(function(o){return o.status!=='CANCELLED'}).forEach(function(o){if(knownOrders.size&&!knownOrders.has(o.id)){speak('New order '+o.orderNumber+' received')}knownOrders.add(o.id)});
          q('#orders').innerHTML=orders.filter(function(o){return o.status!=='CANCELLED'}).map(function(o){return '<article class="order"><div class="order-top"><div><span class="eyebrow">'+esc(o.orderNumber)+'</span><h2>'+esc(o.customerName)+'</h2><p class="muted">'+esc(o.tableLocation||'')+'</p></div><span class="status '+o.status.toLowerCase()+'">'+o.status+'</span></div><div class="items">'+o.items.map(function(i){return '<div><span>'+i.quantity+' × '+esc(i.name)+(i.options&&i.options.length?' <small>('+i.options.map(esc).join(', ')+')</small>':'')+'</span><strong>'+peso(i.subtotal)+'</strong></div>'}).join('')+'</div><div class="order-bottom"><span>'+new Date(o.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</span><strong>'+peso(o.totalAmount)+'</strong></div></article>'}).join('')||'<p class="muted">No active orders.</p>'})}
        load();setInterval(load,5000);
        </script>
    """.trimIndent())

    private fun page(title: String, body: String): String = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>$title</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1c1917;background:#f5f3ee}
    body{background:radial-gradient(circle at top,#ffffff 0,#f5f3ee 55%,#e9e7e0 100%);min-height:100vh}
    .topbar{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:14px clamp(16px,5vw,64px);border-bottom:1px solid #e4ddcf;background:#fdfcf9f2;backdrop-filter:blur(14px)}
    .brand{display:flex;align-items:center;gap:10px}.brand strong{display:block;font-size:17px;letter-spacing:.06em}.brand span{color:#8a817a;font-size:12px}
    .logo-dot{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#23271f,#4a5d3a);position:relative}
    .logo-dot:after{content:'';position:absolute;inset:9px;border-radius:50%;background:#b58a4a}
    .top-actions{display:flex;gap:8px;align-items:center}
    .soft-btn,.cart-btn{border:1px solid #ddd6c8;background:#fff;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer}
    .cart-btn{background:#1f1a17;color:#fff;border-color:#1f1a17}
    .badge{display:inline-block;min-width:18px;margin-left:4px;border-radius:999px;background:#b58a4a;color:#fff;font-size:11px;padding:1px 5px}
    .hero{max-width:1200px;margin:0 auto;padding:34px 20px 14px}.hero h1{font-size:clamp(24px,4vw,38px);letter-spacing:-.03em}.muted{color:#6b645d;font-size:14px;margin-top:6px}
    .chips{display:flex;gap:8px;overflow-x:auto;max-width:1200px;margin:0 auto;padding:8px 20px 16px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
    .chip{border:1px solid #ddd6c8;background:#fff;color:#6b645d;border-radius:999px;padding:10px 16px;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer}
    .chip.active{background:#23271f;color:#fff;border-color:#23271f}
    .grid{max-width:1200px;margin:0 auto;padding:0 20px 60px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
    .product{background:#fffdfb;border:1px solid #f1e3d2;border-radius:20px;overflow:hidden;cursor:pointer;box-shadow:0 10px 22px rgba(79,50,27,.07);transition:transform .15s ease,box-shadow .15s ease}
    .product:hover{transform:translateY(-3px);box-shadow:0 16px 30px rgba(79,50,27,.12)}
    .p-img,.modal-img{height:150px;background:linear-gradient(135deg,#f1e9dc,#e7eee2);display:flex;align-items:center;justify-content:center}
    .p-img img,.modal-img img{width:100%;height:100%;object-fit:cover}
    .noimg .ph,.p-img .ph,.modal-img .ph{font-size:44px;opacity:.55}
    .p-body{padding:14px 16px 16px}.p-body h3{font-size:17px}.p-body p{font-size:13px;color:#6b645d;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .p-foot{margin-top:12px;display:flex;align-items:center;gap:8px}.p-foot strong{font-size:16px;color:#23271f}
    .p-foot .add{margin-left:auto;border:0;border-radius:999px;background:#eef1eb;color:#4a5d3a;padding:8px 13px;font-size:12px;font-weight:800;cursor:pointer}
    .mini-tags{margin-left:auto;display:none}.mini-tag{font-size:10px;color:#4a5d3a;background:#eef1eb;border-radius:999px;padding:2px 8px}
    .overlay{position:fixed;inset:0;background:#1c19178c;backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .2s;z-index:40}
    .overlay.show{opacity:1;pointer-events:auto}
    .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:16px;z-index:60}
    .modal.open{display:flex}
    .modal-card{position:relative;width:min(94vw,470px);max-height:90vh;overflow:auto;border-radius:26px;background:#fff;padding:16px;box-shadow:0 24px 70px #1c191766}
    .modal-close{position:absolute;right:12px;top:12px;z-index:2;width:34px;height:34px;border-radius:50%;background:#f1f0ec;border:0;font-size:20px;cursor:pointer}
    .modal-card h2{font-size:22px;margin-top:12px}.opt-group{margin-top:14px;padding:12px;border:1px solid #ece3d4;border-radius:16px;background:#fbfaf7}
    .opt-group strong{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#1c1917}.hint{margin-top:2px;font-size:12px}
    .option-pills{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
    .option-pill{border:1px solid #ddd6c8;border-radius:999px;background:#fff;color:#6b645d;padding:8px 12px;font-size:13px;cursor:pointer}
    .option-pill.selected{border-color:#4a5d3a;background:#4a5d3a;color:#fff}
    .modal-add{width:100%;margin-top:16px;border-radius:14px;border:0;background:#23271f;color:#fff;padding:14px;font-size:15px;font-weight:800;cursor:pointer}
    .drawer,.orders-panel{position:fixed;top:0;right:0;height:100%;width:min(420px,100vw);background:#fdfcf9;z-index:50;box-shadow:-18px 0 50px #1c191733;transform:translateX(102%);transition:transform .25s ease;display:flex;flex-direction:column;overflow:hidden}
    .drawer.open,.orders-panel.open{transform:none}
    .drawer-head{display:flex;justify-content:space-between;align-items:center;padding:18px 18px 10px}
    .cart-items{flex:1;overflow-y:auto;padding:6px 18px 12px}
    .cart-row{background:#fff;border:1px solid #f1e3d2;border-radius:16px;padding:11px 12px;margin-bottom:9px}
    .cr-main strong{display:block;font-size:14px}.cr-main .muted{font-size:12px;margin-top:2px}
    .cr-ops{margin-top:8px;display:flex;align-items:center;gap:8px}.cr-ops strong{margin-left:auto;font-size:14px}
    .qty{border:1px solid #e2d8c8;background:#fbfaf7;border-radius:999px;width:26px;height:26px;cursor:pointer}
    .remove{border:0;background:none;color:#b3261e;cursor:pointer;font-size:13px}
    .checkout{padding:10px 18px 22px;border-top:1px solid #efe7da;background:#faf8f4;max-height:52vh;overflow-y:auto}
    .field{margin-top:10px}.field label{display:block;font-size:11px;font-weight:800;color:#6b645d;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em}
    .field input,.field select{width:100%;border:1px solid #ddd6c8;border-radius:12px;padding:11px;font-size:14px;background:#fff}
    .voucher-row{display:flex;gap:8px}.voucher-row input{flex:1}.voucher-row .soft-btn{white-space:nowrap}
    .pay-chips{display:flex;gap:7px;flex-wrap:wrap}
    .pay-chip{border:1px solid #ddd6c8;border-radius:999px;background:#fff;color:#6b645d;padding:9px 13px;font-size:12px;font-weight:800;cursor:pointer}
    .pay-chip.selected{background:#23271f;color:#fff;border-color:#23271f}
    .wallet-box{background:#f4f7f1;border:1px solid #dbe5d4;border-radius:16px;padding:12px;margin-top:10px}
    .wallet-line{display:flex;gap:12px;align-items:center}
    .payment-qr{width:86px;height:86px;object-fit:contain;background:#fff;border-radius:10px;padding:4px}
    .file-btn{display:inline-block;border:1px dashed #b9c9ad;background:#fff;color:#4a5d3a;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:700;cursor:pointer;width:100%;text-align:center}
    #proof{display:none}.send{width:100%;margin-top:14px;border:0;border-radius:14px;background:#1f1a17;color:#fff;padding:15px;font-size:16px;font-weight:800;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
    #message{text-align:center;color:#b3261e;font-size:13px;margin-top:8px;min-height:16px}
    .sum-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:#6b645d}
    .sum-row.gold{color:#8a6a2f;font-weight:700}.sum-row.total{font-size:17px;font-weight:900;color:#1c1917;border-top:1px dashed #ddd6c8;margin-top:6px;padding-top:8px}
    .toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);background:#23271f;color:#fff;padding:12px 20px;border-radius:999px;font-size:14px;opacity:0;pointer-events:none;transition:.25s;z-index:80;box-shadow:0 10px 30px #1c191755}
    .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .order-mini{background:#fff;border:1px solid #f1e3d2;border-radius:14px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
    .status{font-size:11px;font-weight:800;color:#4a5d3a;background:#eef1eb;border-radius:999px;padding:4px 10px}
    .orders,.items{max-width:1180px;margin:0 auto}
    .orders{padding:10px 20px 60px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
    .order{background:#fff;border:1px solid #eee4d5;border-radius:18px;padding:16px;box-shadow:0 8px 20px #23271f0c}
    .order-top,.order-bottom{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
    .order h2{font-size:18px;margin-top:4px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;color:#4a5d3a}
    .items{margin:12px 0;padding-top:10px;border-top:1px dashed #e4dccb}.items div{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
    .order-bottom{padding-top:8px;border-top:1px solid #f0e8db;align-items:center}
    .pill{display:inline-flex;align-items:center;border:1px solid #d7e1cf;border-radius:999px;background:#f1f5ed;padding:8px 13px;font-size:12px;font-weight:700;color:#4a5d3a}
    .live,.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#4a5d3a;margin-right:6px;animation:pulse 1.6s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
    .status.pending{background:#f5e9d3;color:#8a6a2f}.status.preparing{background:#e3ebf3;color:#47688a}.status.completed{background:#e3efe1;color:#3e7d4a}.status.cancelled{background:#f6e4e2;color:#b3261e}
    </style></head><body>$body</body></html>"""

    private fun htmlResponse(html: String) = newFixedLengthResponse(Response.Status.OK, "text/html; charset=utf-8", html)
    private fun jsonResponse(json: String, status: Response.Status = Response.Status.OK) = newFixedLengthResponse(status, "application/json; charset=utf-8", json)
}
