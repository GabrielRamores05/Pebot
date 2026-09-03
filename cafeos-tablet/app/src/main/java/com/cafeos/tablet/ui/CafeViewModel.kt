package com.cafeos.tablet.ui

import android.app.Application
import android.content.Context
import android.os.Bundle
import android.net.Uri
import android.os.Environment
import android.provider.Settings
import android.speech.tts.TextToSpeech
import androidx.compose.runtime.mutableStateListOf
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.room.withTransaction
import com.cafeos.tablet.data.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okio.buffer
import okio.sink
import okio.source
import okio.use

class CafeViewModel(application: Application) : AndroidViewModel(application) {
    private val dao = CafeDatabase.getDatabase(application).cafeDao()
    private val db = CafeDatabase.getDatabase(application)
    private val syncManager = SocketSyncManager(application)
    private val webServer = LocalWebServer(dao) { order -> announceOrder(order) }
    private val textToSpeech = TextToSpeech(application) { status ->
        if (status == TextToSpeech.SUCCESS) textToSpeechReady = true
    }
    private var textToSpeechReady = false
    private var lastQuotaAnnouncementDay: String? = null
    private var webServerStarted = false
    private val _webHostAddress = MutableStateFlow<String?>(null)
    val webHostAddress: StateFlow<String?> = _webHostAddress.asStateFlow()
    val receiptPrinter = ReceiptPrinter(application)

    val isConnectedToSync: StateFlow<Boolean> = syncManager.isConnected
    val syncHostAddress: StateFlow<String?> = syncManager.hostAddress
    val orderSyncEvent: StateFlow<OrderSyncEvent?> = syncManager.orderUpdates
    val inventorySyncEvent: StateFlow<InventorySyncEvent?> = syncManager.inventoryUpdates
    val discoveredSyncHosts: StateFlow<List<String>> = syncManager.discoveredHosts

    init {
        // The QR ordering/kitchen pages must always be reachable on the LAN —
        // not only after the user opens Connection and toggles host mode.
        ensureWebServerRunning()
        if (savedSyncMode == "host") startSyncHost()
        viewModelScope.launch {
            syncManager.orderUpdates.collectLatest { event ->
                event?.let { applyIncomingOrder(it) }
            }
        }
    }

    private fun ensureWebServerRunning() {
        if (webServerStarted) return
        try {
            webServer.start()
            webServerStarted = true
        } catch (error: Exception) {
            error.printStackTrace()
        }
        _webHostAddress.value = "http://${LocalWebServer.getLocalAddress()}:${LocalWebServer.PORT}"
    }

    private suspend fun applyIncomingOrder(event: OrderSyncEvent) {
        val existingOrders = dao.getAllOrders().firstOrNull() ?: emptyList()
        val existing = existingOrders.firstOrNull {
            it.id == event.order.id || it.orderNumber == event.order.orderNumber
        }
        if (existing != null) {
            if (existing.status != event.order.status) dao.updateOrder(existing.copy(status = event.order.status))
            syncManager.clearOrderUpdate()
            return
        }
        val newOrderId = dao.insertOrder(event.order.copy(id = 0)).toInt()
        announceOrder(event.order)
        val availableProducts = dao.getAllProducts().firstOrNull()?.map { it.id }?.toSet() ?: emptySet()
        event.items.filter { it.productId in availableProducts }.forEach { item ->
            dao.insertOrderItem(item.copy(id = 0, orderId = newOrderId))
        }
        syncManager.clearOrderUpdate()
    }

    val savedSyncMode: String
        get() = getApplication<Application>().getSharedPreferences("pebot_sync", Context.MODE_PRIVATE)
            .getString("mode", "host") ?: "host"

    val savedSyncUrl: String
        get() = getApplication<Application>().getSharedPreferences("pebot_sync", Context.MODE_PRIVATE)
            .getString("url", "") ?: ""

    fun initializeSync(serverUrl: String) {
        syncManager.connect(serverUrl)
    }

    fun startSyncDiscovery() = syncManager.startDiscovery()

    fun stopSyncDiscovery() = syncManager.stopDiscovery()

    fun startSyncHost() {
        syncManager.startHost()
        if (!webServerStarted) {
            try {
                webServer.start()
                webServerStarted = true
            } catch (error: Exception) {
                error.printStackTrace()
            }
        }
        _webHostAddress.value = "http://${LocalWebServer.getLocalAddress()}:${LocalWebServer.PORT}"
    }

    fun disconnectSync() {
        syncManager.disconnect()
        try { webServer.stop() } catch (_: Exception) { }
        webServerStarted = false
        _webHostAddress.value = null
    }

    fun clearOrderSyncEvent() { syncManager.clearOrderUpdate() }
    fun clearInventorySyncEvent() { syncManager.clearInventoryUpdate() }

    fun requestFullSync() {
        syncManager.requestFullSync()
    }

    override fun onCleared() {
        textToSpeech.stop()
        textToSpeech.shutdown()
        super.onCleared()
    }

    val categories = dao.getAllCategories()
    val allProducts = dao.getAllProducts()
    private val _productCache = HashMap<Int, Product>()
    private val _productCacheByName = HashMap<String, List<Product>>()
    private val _imageCache = HashMap<String, android.graphics.Bitmap>()

    fun getCachedProduct(id: Int): Product? = _productCache[id]
    fun getCachedProductsByName(name: String): List<Product> = _productCacheByName[name] ?: emptyList()

    fun getCachedImage(path: String?): android.graphics.Bitmap? {
        if (path == null) return null
        _imageCache[path]?.let { return it }
        var bitmap = _imageCache[path]
        if (bitmap == null) {
            try {
                val file = java.io.File(path)
                if (file.exists()) {
                    bitmap = android.graphics.BitmapFactory.decodeFile(path)
                    if (bitmap != null) {
                        _imageCache[path] = bitmap
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return bitmap
    }

    fun clearImageCache() {
        _imageCache.clear()
    }

    init {
        viewModelScope.launch {
            dao.getAllProducts().collect { products ->
                _productCache.clear()
                _productCacheByName.clear()
                products.forEach { product ->
                    _productCache[product.id] = product
                    val lowerName = product.name.lowercase()
                    _productCacheByName[lowerName] = (_productCacheByName[lowerName] ?: emptyList()) + product
                }
            }
        }
    }
    val allOrders = dao.getAllOrders()
    val ingredients = dao.getAllIngredients()
    val allPayments = dao.getAllPayments()
    val allCustomers = dao.getAllCustomers()
    val suppliers = dao.getAllSuppliers()
    val tables = dao.getAllTables()
    val stations = dao.getAllStations()
    val productionCapacity = dao.getProductionCapacity()
    val allOptionGroups = dao.getAllOptionGroups()
    val allOptions = dao.getAllOptions()
    val allExpenses = dao.getAllExpenses()
    val allTransactions = dao.getAllTransactions()
    val allPurchases = dao.getAllPurchases()
    val lowStockIngredients = dao.getLowStockIngredients()
    val businessSettings = dao.getBusinessSettings()
    val allStaff = dao.getAllStaff()
    val activeVouchers = dao.getActiveVouchers()

    // POS Cart
    private val _cartItems = mutableStateListOf<CartItem>()
    val cartItems: List<CartItem> get() = _cartItems

    private val _totalAmount = MutableStateFlow(0.0)
    val totalAmount: StateFlow<Double> = _totalAmount.asStateFlow()

    private val _selectedProduct = MutableStateFlow<Product?>(null)
    val selectedProduct: StateFlow<Product?> = _selectedProduct.asStateFlow()

    private val _customerName = MutableStateFlow("")
    val customerName: StateFlow<String> = _customerName.asStateFlow()

    private val _orderType = MutableStateFlow("DINE_IN")
    val orderType: StateFlow<String> = _orderType.asStateFlow()

    private val _deliveryAddress = MutableStateFlow("")
    val deliveryAddress: StateFlow<String> = _deliveryAddress.asStateFlow()

    private val _paymentMethod = MutableStateFlow("CASH")
    val paymentMethod: StateFlow<String> = _paymentMethod.asStateFlow()

    private val _amountTendered = MutableStateFlow("")
    val amountTendered: StateFlow<String> = _amountTendered.asStateFlow()

    private val _discountType = MutableStateFlow("NONE")
    val discountType: StateFlow<String> = _discountType.asStateFlow()

    private val _discountRate = MutableStateFlow(0.0)
    val discountRate: StateFlow<Double> = _discountRate.asStateFlow()

    private val _selectedVoucher = MutableStateFlow<LoyaltyVoucher?>(null)
    val selectedVoucher: StateFlow<LoyaltyVoucher?> = _selectedVoucher.asStateFlow()

    private val _selectedTableId = MutableStateFlow<Int?>(null)
    val selectedTableId: StateFlow<Int?> = _selectedTableId.asStateFlow()

    private val _showCheckout = MutableStateFlow(false)
    val showCheckout: StateFlow<Boolean> = _showCheckout.asStateFlow()

    private val _showProductOptions = MutableStateFlow<Product?>(null)
    val showProductOptions: StateFlow<Product?> = _showProductOptions.asStateFlow()

    private val _screenshotPath = MutableStateFlow<String?>(null)
    val screenshotPath: StateFlow<String?> = _screenshotPath.asStateFlow()

    private val _placedOrder = MutableStateFlow<Order?>(null)
    val placedOrder: StateFlow<Order?> = _placedOrder.asStateFlow()

    private val _subtotalAmount = MutableStateFlow(0.0)
    val subtotalAmount: StateFlow<Double> = _subtotalAmount.asStateFlow()

    private val _finalTotal = MutableStateFlow(0.0)
    val finalTotal: StateFlow<Double> = _finalTotal.asStateFlow()

    // Product/Category management
    private val _editingProduct = MutableStateFlow<Product?>(null)
    val editingProduct: StateFlow<Product?> = _editingProduct.asStateFlow()

    private val _editingCategory = MutableStateFlow<Category?>(null)
    val editingCategory: StateFlow<Category?> = _editingCategory.asStateFlow()

    private val _showProductForm = MutableStateFlow(false)
    val showProductForm: StateFlow<Boolean> = _showProductForm.asStateFlow()

    private val _showCategoryForm = MutableStateFlow(false)
    val showCategoryForm: StateFlow<Boolean> = _showCategoryForm.asStateFlow()

    // Live Orders
    private val _selectedOrder = MutableStateFlow<Order?>(null)
    val selectedOrder: StateFlow<Order?> = _selectedOrder.asStateFlow()

    private val _liveOrders = MutableStateFlow<List<Order>>(emptyList())
    val liveOrders: StateFlow<List<Order>> = _liveOrders.asStateFlow()

    // Export state
    private val _exportStatus = MutableStateFlow<String?>(null)
    val exportStatus: StateFlow<String?> = _exportStatus.asStateFlow()

    fun selectProduct(product: Product) {
        _selectedProduct.value = product
    }

    fun setCustomerName(name: String) {
        _customerName.value = name
    }

    fun setOrderType(type: String) {
        _orderType.value = type
        if (type == "DINE_IN") _selectedTableId.value?.let { occupyTableIfFree(it) }
    }

    fun setDeliveryAddress(address: String) {
        _deliveryAddress.value = address
    }

    fun setPaymentMethod(method: String) {
        _paymentMethod.value = method
    }

    fun setAmountTendered(amount: String) {
        _amountTendered.value = amount
    }

    fun setSelectedTableId(id: Int?) {
        _selectedTableId.value = id
        // Business rule (owner, 2026-09-04): picking a DINE-IN table at the POS
        // marks that table occupied immediately, not only after the sale is placed.
        if (id != null && _orderType.value == "DINE_IN") occupyTableIfFree(id)
    }

    /** Marks a free table OCCUPIED; never overrides staff-set OCCUPIED/NEEDS_CLEANING. */
    private fun occupyTableIfFree(tableId: Int) {
        viewModelScope.launch {
            dao.getTable(tableId)?.let { t ->
                if (t.status == "AVAILABLE") {
                    dao.updateTable(t.copy(status = "OCCUPIED", updatedAt = System.currentTimeMillis()))
                }
            }
        }
    }

    fun setScreenshotPath(path: String?) {
        _screenshotPath.value = path
    }

    fun clearScreenshot() {
        _screenshotPath.value = null
    }

    fun dismissPlacedOrder() {
        _placedOrder.value = null
    }

    fun setDiscountType(type: String) {
        _discountType.value = type
        // Discount rate comes from the shop's BusinessSettings (web parity:
        // studentPwdDiscountRate is configurable in Settings ▸ Business), not a
        // hard-coded 20%.
        viewModelScope.launch {
            val settings = dao.getBusinessSettingsSync() ?: BusinessSettings()
            val rate = when (type) {
                "PWD", "STUDENT" -> (settings.studentPwdDiscountRate / 100.0).coerceIn(0.0, 1.0)
                else -> 0.0
            }
            _discountRate.value = rate
            calculateTotals()
        }
    }

    fun setSelectedVoucher(voucher: LoyaltyVoucher?) {
        _selectedVoucher.value = voucher
        if (voucher != null) {
            _discountType.value = "VOUCHER"
        } else {
            _discountType.value = "NONE"
        }
        calculateTotals()
    }

    private fun getVoucherDiscountAmount(subtotal: Double): Double {
        val voucher = _selectedVoucher.value ?: return 0.0
        val discount = if (voucher.discountType == "PERCENTAGE") {
            subtotal * voucher.discountValue / 100.0
        } else {
            voucher.discountValue
        }
        val maxDiscount = if (voucher.maxDiscount > 0) voucher.maxDiscount else Double.MAX_VALUE
        return minOf(discount, maxDiscount, subtotal)
    }

    fun openCheckout() {
        _showCheckout.value = true
    }

    fun closeCheckout() {
        _showCheckout.value = false
    }

    fun openProductOptions(product: Product) {
        _showProductOptions.value = product
    }

    fun closeProductOptions() {
        _showProductOptions.value = null
    }

    fun addToCart(product: Product, selectedOptions: List<Pair<String, String>> = emptyList(), priceDelta: Double = 0.0) {
        val existing = _cartItems.find { it.product.id == product.id && it.selectedOptions == selectedOptions }
        if (existing != null) {
            existing.quantity++
        } else {
            _cartItems.add(CartItem(product, 1, selectedOptions, priceDelta))
        }
        calculateTotals()
    }

    fun removeFromCart(cartItem: CartItem) {
        _cartItems.remove(cartItem)
        calculateTotals()
    }

    fun updateCartItemQuantity(cartItem: CartItem, newQuantity: Int) {
        if (newQuantity <= 0) {
            _cartItems.remove(cartItem)
        } else {
            val index = _cartItems.indexOf(cartItem)
            if (index != -1) {
                _cartItems[index] = cartItem.copy(quantity = newQuantity)
            }
        }
        calculateTotals()
    }

    fun clearCart() {
        _cartItems.clear()
        calculateTotals()
    }

    private fun calculateTotals() {
        val sub = _cartItems.sumOf { it.product.price * it.quantity + it.priceDelta * it.quantity }
        _subtotalAmount.value = sub
        val discount = if (_discountType.value == "VOUCHER") {
            getVoucherDiscountAmount(sub)
        } else {
            sub * _discountRate.value
        }
        _totalAmount.value = sub - discount
        _finalTotal.value = sub - discount
    }

    fun calculateBirPrice(capitalCost: Double, marginType: String, marginValue: Double, vatExempt: Boolean): Double {
        val base = capitalCost + if (marginType.equals("PERCENTAGE", ignoreCase = true)) {
            capitalCost * marginValue / 100.0
        } else {
            marginValue
        }
        return if (vatExempt) base else base * 1.12
    }

    suspend fun calculateCapitalFromRecipe(productId: Int): Double {
        val recipeItems = dao.getProductIngredients(productId)
        if (recipeItems.isEmpty()) return 0.0
        val allIngredients = dao.getAllIngredients().firstOrNull() ?: emptyList()
        val ingredientMap = allIngredients.associateBy { it.id }
        return recipeItems.sumOf { pi ->
            val ingredient = ingredientMap[pi.ingredientId]
            ingredient?.costPerUnit?.times(pi.quantity) ?: 0.0
        }
    }

    fun placeOrder() {
        if (_cartItems.isEmpty()) return
        viewModelScope.launch {
            try {
            val total = _finalTotal.value
            val tendered = if (_paymentMethod.value == "CASH") _amountTendered.value.toDoubleOrNull() else total
            if (tendered == null || tendered < total) return@launch
            if (_orderType.value == "DELIVERY" && _deliveryAddress.value.isBlank()) return@launch
            val subtotal = _subtotalAmount.value
            var placedOrderOut: Order? = null
            var placedItemsOut: List<OrderItem> = emptyList()
            // The whole order write — receipt number, order+items+options, stock
            // consumption, payment, voucher use — is one transaction so a partial
            // failure can never leave a half-recorded sale (constitution §III/§VII).
            db.withTransaction {
            val nextReceipt = getNextReceiptNumber()
            val order = Order(
                orderNumber = nextReceipt,
                customerName = _customerName.value.ifBlank { "Walk-in Customer" },
                status = "PENDING",
                totalAmount = total,
                discountAmount = subtotal - total,
                discountRate = _discountRate.value,
                 discountReason = when (_discountType.value) {
                    // Web vocabulary: one code covers both PWD and Student.
                    "PWD", "STUDENT" -> "STUDENT_PWD"
                    "VOUCHER" -> _selectedVoucher.value?.code
                    else -> null
                },
                paymentMethod = _paymentMethod.value,
                orderType = _orderType.value,
                deliveryAddress = if (_orderType.value == "DELIVERY") _deliveryAddress.value.trim().ifBlank { null } else null,
                tableId = _selectedTableId.value,
                tableLocation = _selectedTableId.value?.let { tableId ->
                    val table = dao.getTable(tableId)
                    dao.getAllTableSectionsNow().firstOrNull { section ->
                        section.tableIds.split(',').mapNotNull { it.trim().toIntOrNull() }.contains(tableId)
                    }?.let { section -> "${section.name} / ${table?.name ?: tableId}" } ?: table?.name
                },
                barcodeValue = nextReceipt
            )
            val orderId = dao.insertOrder(order).toInt()

            val allOptions = dao.getAllOptionsNow()
            val optionGroups = dao.getAllTableSectionsNow()
            val groupNames = allOptions.mapNotNull { option ->
                dao.getOptionGroupName(option.groupId)?.let { option.groupId to it }
            }.toMap()
            val orderItems = _cartItems.map { cartItem ->
                val orderItem = OrderItem(
                    orderId = orderId,
                    productId = cartItem.product.id,
                    quantity = cartItem.quantity,
                    unitPrice = cartItem.product.price,
                    subtotal = cartItem.product.price * cartItem.quantity + cartItem.priceDelta * cartItem.quantity
                )
                val orderItemId = dao.insertOrderItem(orderItem).toInt()

                val options = cartItem.selectedOptions.map { (name, value) ->
                    val option = allOptions.firstOrNull { candidate ->
                        candidate.name == value && groupNames[candidate.groupId] == name
                    }
                    OrderOption(
                        orderItemId = orderItemId,
                        name = name,
                        value = value,
                        priceDelta = option?.priceDelta ?: 0.0,
                        ingredientId = option?.ingredientId,
                        ingredientQuantity = option?.ingredientQuantity ?: 0.0
                    )
                }
                dao.insertOrderOptions(options)
                orderItem.copy(id = orderItemId)
            }

            consumeRecipeStock(orderItems)

            val change = (tendered - total).coerceAtLeast(0.0)
            dao.insertPayment(
                Payment(
                    orderId = orderId,
                    method = _paymentMethod.value,
                    amount = total,
                    amountTendered = tendered,
                    change = change,
                    screenshotPath = _screenshotPath.value
                )
            )
            _selectedVoucher.value?.let { voucher ->
                dao.updateVoucher(voucher.copy(usedCount = voucher.usedCount + 1))
            }
            // A dine-in sale occupies its table (only when the table was free —
            // never clobber an OCCUPIED/NEEDS_CLEANING state set by staff).
            if (order.orderType == "DINE_IN" && order.tableId != null) {
                dao.getTable(order.tableId!!)?.let { table ->
                    if (table.status == "AVAILABLE") {
                        dao.updateTable(table.copy(status = "OCCUPIED", updatedAt = System.currentTimeMillis()))
                    }
                }
            }
            placedOrderOut = order.copy(id = orderId)
            placedItemsOut = orderItems
            } // end db.withTransaction

            val placedOrder = placedOrderOut ?: return@launch
            _placedOrder.value = placedOrder
            syncManager.handleOrderPlaced(placedOrder, placedItemsOut)
            announceOrder(placedOrder)
            _cartItems.clear()
            _totalAmount.value = 0.0
            _subtotalAmount.value = 0.0
            _finalTotal.value = 0.0
            _customerName.value = ""
            _amountTendered.value = ""
            _showCheckout.value = false
            _paymentMethod.value = "CASH"
            _orderType.value = "DINE_IN"
            _deliveryAddress.value = ""
             _discountType.value = "NONE"
            _selectedVoucher.value = null
            _discountRate.value = 0.0
            _selectedTableId.value = null
            _screenshotPath.value = null
            } catch (e: Throwable) {
                // An order write must never take the app down with it — log and
                // close the checkout so the staff can retry.
                android.util.Log.e("PlaceOrder", "Failed to place order", e)
                _showCheckout.value = false
            }
        }
    }

    private fun announceOrder(order: Order) {
        if (!textToSpeechReady) return
        viewModelScope.launch {
            val settings = dao.getBusinessSettingsSync() ?: BusinessSettings()
            if (!settings.voiceEnabled) return@launch
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val ordersToday = dao.getAllOrders().firstOrNull()?.filter {
                it.createdAt >= startOfToday() && it.status != "CANCELLED"
            } ?: emptyList()
            val current = if (settings.dailyQuotaMode == "REVENUE") ordersToday.sumOf { it.totalAmount }.toString() else dao.getProductUnitCountNow(startOfToday(), System.currentTimeMillis()).toString()
            val table = order.tableLocation ?: order.tableId?.let { "Table $it" } ?: "Takeaway"
            val message = settings.voiceOrderMessage
                .replace("{order}", order.orderNumber)
                .replace("{customer}", order.customerName)
                .replace("{table}", table)
                .replace("{current}", current)
                .replace("{target}", settings.dailyQuotaTarget.toString())
            textToSpeech.setSpeechRate(settings.voiceSpeed)
            val speechParams = Bundle().apply {
                putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, settings.voiceVolume)
            }
            textToSpeech.speak(message, TextToSpeech.QUEUE_ADD, speechParams, "order-${order.orderNumber}")
            val achieved = if (settings.dailyQuotaMode == "REVENUE") ordersToday.sumOf { it.totalAmount } else current.toDouble()
            if (settings.dailyQuotaTarget > 0.0 && achieved >= settings.dailyQuotaTarget && lastQuotaAnnouncementDay != today) {
                lastQuotaAnnouncementDay = today
                textToSpeech.speak(
                    settings.voiceQuotaMessage
                        .replace("{current}", current)
                        .replace("{target}", settings.dailyQuotaTarget.toString()),
                    TextToSpeech.QUEUE_ADD,
                    speechParams,
                    "quota-$today"
                )
            }
        }
    }

    private fun startOfToday(): Long = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    fun updateOrderStatus(orderId: Int, newStatus: String, adminAuthorized: Boolean = false) {
        if (newStatus == "CANCELLED" && !adminAuthorized) return
        viewModelScope.launch {
            db.withTransaction {
                val order = dao.getOrderById(orderId) ?: return@withTransaction
                if (order.status == newStatus) return@withTransaction
                dao.updateOrder(order.copy(status = newStatus, updatedAt = System.currentTimeMillis()))
                if (newStatus == "CANCELLED") {
                    // Reverse everything the sale consumed, atomically (web parity:
                    // "Order cancelled: stock restored").
                    restoreStockForOrder(order)
                    revertVoucherForOrder(order)
                }
            }
            val updated = dao.getOrderById(orderId) ?: return@launch
            syncManager.handleOrderPlaced(updated)
            logAuditEvent("ORDER_STATUS", "order", orderId, details = newStatus)
        }
    }

    suspend fun getOrderById(orderId: Int) = dao.getOrderById(orderId)

    suspend fun getOrderItemsSync(orderId: Int): List<OrderItem> = dao.getOrderItems(orderId)

    suspend fun getOrderOptionsForItemSync(orderItemId: Int): List<OrderOption> = dao.getOrderOptions(orderItemId)

    suspend fun getPaymentsForOrder(orderId: Int): List<Payment> = dao.getPaymentsForOrder(orderId)

    suspend fun getAllVouchersNow(): List<LoyaltyVoucher> = dao.getAllVouchersNow()

    val loyaltySettings = dao.getAllLoyaltySettings()

    suspend fun deleteLoyaltySetting(setting: LoyaltySetting) = dao.deleteLoyaltySetting(setting)

    fun adjustStock(ingredient: Ingredient, delta: Double, notes: String) {
        viewModelScope.launch {
            val updated = ingredient.copy(currentStock = ingredient.currentStock + delta)
            dao.updateIngredient(updated)
            dao.insertIngredientTransaction(
                IngredientTransaction(
                    ingredientId = ingredient.id,
                    type = if (delta > 0) "PURCHASE" else "ADJUSTMENT",
                    quantity = delta,
                    notes = notes
                )
            )
        }
    }

    fun addIngredient(name: String, category: String, baseUnit: String, currentStock: Double, minStock: Double, costPerUnit: Double) {
        viewModelScope.launch {
            dao.insertIngredient(Ingredient(name = name, category = category, baseUnit = baseUnit, currentStock = currentStock, minStock = minStock, costPerUnit = costPerUnit))
        }
    }

    fun deleteIngredient(ingredient: Ingredient) {
        viewModelScope.launch {
            dao.deleteIngredient(ingredient)
        }
    }

    fun getDailySales(): Flow<Double?> {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        return dao.getDailySales(calendar.timeInMillis)
    }

    fun getTopSellingProducts() = dao.getTopSellingProducts()

    fun getOrderCount() = dao.getOrderCount(System.currentTimeMillis())

    fun getProductUnitCount(start: Long, end: Long): Flow<Int> = dao.getProductUnitCount(start, end)

    fun getAverageOrderValue() = dao.getAverageOrderValue(System.currentTimeMillis())

    fun getSalesByPaymentMethod() = dao.getSalesByPaymentMethod(System.currentTimeMillis())

    fun getSalesByCategory() = dao.getSalesByCategory(System.currentTimeMillis())

    fun saveProduct(product: Product) {
        viewModelScope.launch {
            if (product.id == 0) {
                dao.insertProduct(product)
            } else {
                dao.updateProduct(product)
            }
        }
    }

    suspend fun saveProductAndReturnId(product: Product): Int {
        return if (product.id == 0) dao.insertProduct(product).toInt() else {
            dao.updateProduct(product)
            product.id
        }
    }

    suspend fun clearProductRecipe(productId: Int) = dao.clearProductIngredients(productId)

    suspend fun saveProductOptionGroups(productId: Int, groupIds: List<Int>) {
        dao.deleteProductOptionGroupsByProduct(productId)
        groupIds.forEach { groupId ->
            dao.insertProductOptionGroup(ProductOptionGroup(productId = productId, groupId = groupId))
        }
    }

    fun deleteProduct(product: Product) {
        viewModelScope.launch {
            try {
                dao.deleteProduct(product)
                logAuditEvent("PRODUCT_DELETE", "product", product.id, details = product.name)
            } catch (e: Exception) {
                // Past orders reference this product (RESTRICT FK): hard delete is
                // not allowed. Hide it from the menu instead — never crash the app.
                try {
                    dao.updateProduct(product.copy(available = false))
                    logAuditEvent("PRODUCT_DELETE_BLOCKED", "product", product.id, details = "${product.name} hidden (was ordered in the past)")
                } catch (_: Exception) {
                    // give up quietly — the app must not close over a delete
                }
            }
        }
    }

    fun saveCategory(category: Category) {
        viewModelScope.launch {
            if (category.id == 0) {
                dao.insertCategory(category)
            } else {
                dao.updateCategory(category)
            }
        }
    }

    fun deleteCategory(category: Category) {
        viewModelScope.launch {
            dao.deleteCategory(category)
        }
    }

    fun saveProductImage(context: Context, uri: Uri): String? {
        return try {
            val input = context.contentResolver.openInputStream(uri)
            val fileName = "product_${System.currentTimeMillis()}.jpg"
            val file = java.io.File(context.filesDir, fileName)
            val output = file.outputStream()
            input?.copyTo(output)
            input?.close()
            output.close()
            file.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun getProductImageFile(path: String?): java.io.File? {
        if (path == null) return null
        return java.io.File(path)
    }

    fun saveProductRecipe(productId: Int, ingredientIds: List<Int>, quantities: List<Double>) {
        viewModelScope.launch {
            dao.deleteProductIngredientsByProduct(productId)
            val ingredients = ingredientIds.zip(quantities).map { (ingId, qty) ->
                ProductIngredient(productId = productId, ingredientId = ingId, quantity = qty)
            }
            dao.insertProductIngredients(ingredients)
        }
    }

    suspend fun getProductIngredients(productId: Int): List<ProductIngredient> {
        return dao.getProductIngredients(productId)
    }

    fun saveOptionGroup(group: OptionGroup) {
        viewModelScope.launch {
            if (group.id == 0) {
                dao.insertOptionGroup(group)
            } else {
                dao.updateOptionGroup(group)
            }
        }
    }

    fun saveProductOptionGroup(productId: Int, groupId: Int) {
        viewModelScope.launch {
            dao.insertProductOptionGroup(ProductOptionGroup(productId = productId, groupId = groupId))
        }
    }

    fun saveOption(option: Option) {
        viewModelScope.launch {
            if (option.id == 0) {
                dao.insertOption(option)
            } else {
                dao.updateOption(option)
            }
        }
    }

    suspend fun getOptionGroupsForProduct(productId: Int): List<OptionGroup> {
        val pogs = dao.getProductOptionGroups(productId)
        val allGroups = dao.getAllOptionGroups().firstOrNull() ?: emptyList()
        val groupMap = allGroups.associateBy { it.id }
        return pogs.mapNotNull { groupMap[it.groupId] }
    }

    suspend fun getOptionsForGroup(groupId: Int): List<Option> {
        return dao.getOptionsByGroup(groupId)
    }

    suspend fun getAllOptionsSync(): List<Option> = dao.getAllOptions().firstOrNull() ?: emptyList()

    suspend fun deleteOption(option: Option) = dao.deleteOption(option)

    suspend fun deleteOptionGroup(group: OptionGroup) = dao.deleteOptionGroup(group)

    suspend fun deleteProductOptionGroup(productId: Int, groupId: Int) {
        dao.deleteProductOptionGroupsByProduct(productId)
    }

    fun searchProducts(query: String): Flow<List<Product>> = dao.searchProducts(query)

    suspend fun getTransactionsForIngredient(ingredientId: Int): Flow<List<IngredientTransaction>> =
        dao.getTransactionsForIngredient(ingredientId)

    fun addExpense(expense: Expense) {
        viewModelScope.launch { dao.insertExpense(expense) }
    }

    suspend fun deleteExpense(expense: Expense) = dao.deleteExpense(expense)

    suspend fun updateBusinessSettings(settings: BusinessSettings) {
        dao.upsertBusinessSettings(settings)
        logAuditEvent("SETTINGS_UPDATE", "business_settings", 1)
    }

    suspend fun getNextReceiptNumber(): String {
        val settings = dao.getBusinessSettingsSync() ?: BusinessSettings()
        val prefix = settings.receiptPrefix?.takeIf { it.isNotBlank() } ?: "INV"
        // Never reuse or collide: the next number is past BOTH the stored counter
        // and the highest suffix already used under this prefix (orders may exist
        // that the counter never saw — imports, restores, earlier builds).
        val fromCounter = dao.getLastReceiptNumber()
        val fromOrders = dao.getMaxReceiptSuffix("$prefix-%", prefix.length + 2)
        val next = maxOf(fromCounter, fromOrders) + 1
        dao.updateLastReceiptNumber(next)
        return "${prefix}-${next.toString().padStart(6, '0')}"
    }

    suspend fun purchaseIngredient(ingredientId: Int, quantity: Double, unitCost: Double, supplierId: Int? = null, notes: String? = null) {
        // Legacy path (base-unit entry): quantity is already in the ingredient's
        // base unit and unitCost = total ÷ quantity. Delegates to the one shared
        // transactional purchase path so stock, cost, supplier and history can
        // never diverge (spec 014, US1).
        val ingredient = dao.getIngredientSync(ingredientId) ?: return
        commitPurchase(
            ingredientId = ingredientId,
            purchaseUnit = ingredient.baseUnit,
            quantity = quantity,
            totalCost = quantity * unitCost,
            supplierId = supplierId,
            notes = notes
        )
    }

    /** Unit-aware purchase entry (spec 014): converts to the base unit, stores the
     *  auto-computed latest unit cost and the supplier link in ONE transaction. */
    suspend fun purchaseIngredientWithUnits(
        ingredientId: Int,
        purchaseUnit: String,
        quantity: Double,
        totalCost: Double,
        supplierId: Int? = null,
        notes: String? = null,
        purchaseName: String? = null
    ) {
        commitPurchase(ingredientId, purchaseUnit, quantity, totalCost, supplierId, notes, purchaseName)
    }

    private suspend fun commitPurchase(
        ingredientId: Int,
        purchaseUnit: String,
        quantity: Double,
        totalCost: Double,
        supplierId: Int?,
        notes: String?,
        purchaseName: String? = null
    ) {
        db.withTransaction {
            val ingredient = dao.getIngredientSync(ingredientId) ?: return@withTransaction
            val baseQty = PurchaseUnits.toBaseQuantity(ingredient.baseUnit, purchaseUnit, quantity) ?: return@withTransaction
            val unitCost = PurchaseUnits.unitCost(ingredient.baseUnit, purchaseUnit, quantity, totalCost) ?: return@withTransaction
            dao.updateIngredient(
                ingredient.copy(
                    currentStock = ingredient.currentStock + baseQty,
                    costPerUnit = unitCost,           // latest purchase price replaces (Q3 decision)
                    lastSupplierId = supplierId,      // null when this purchase has no supplier
                    updatedAt = System.currentTimeMillis()
                )
            )
            val supplierName = supplierId?.let { dao.getSupplier(it)?.name }
            val txnId = dao.insertIngredientTransaction(
                IngredientTransaction(
                    ingredientId = ingredientId,
                    type = "PURCHASE",
                    quantity = baseQty,
                    referenceType = if (supplierId != null) "supplier" else null,
                    referenceId = supplierId,
                    purchaseUnit = purchaseUnit,
                    purchaseCost = totalCost,
                    unitCost = unitCost,
                    notes = (if (!purchaseName.isNullOrBlank()) "$purchaseName · " else "") + (notes ?: ""),
                    createdAt = System.currentTimeMillis()
                )
            )
            // Spec 014 T030: every purchase write emits an audit event inside the
            // same transaction (same pattern as the VOID_PURCHASE audit).
            val supplierText = if (supplierName != null) " from $supplierName" else " (no supplier)"
            logAuditEvent(
                "PURCHASE_RECORD",
                "ingredient_transaction",
                txnId.toInt(),
                details = "Purchased ${trimNumber(quantity)} $purchaseUnit of ${ingredient.name} for ₱${trimNumber(totalCost)}$supplierText (unit cost ₱${trimNumber(unitCost)}/${ingredient.baseUnit})"
            )
        }
    }

    /**
     * Bulk stock corrections (spec 014, US4). One transaction for the whole
     * batch; each line writes an ADJUSTMENT row sharing the batch token in its
     * notes. No row may push stock below zero — the whole batch is validated
     * first so a bad row saves nothing. Never touches cost or supplier.
     */
    fun bulkAdjustStock(adjustments: List<Pair<Int, Double>>, notes: String = "Bulk adjust") {
        if (adjustments.isEmpty()) return
        viewModelScope.launch {
            try {
                db.withTransaction {
                    // Validate the entire batch against current stock before writing.
                    for ((ingredientId, delta) in adjustments) {
                        val ingredient = dao.getIngredientSync(ingredientId) ?: return@withTransaction
                        if (ingredient.currentStock + delta < 0.0) return@withTransaction
                    }
                    val batchToken = "bulk-" + System.currentTimeMillis()
                    var written = 0
                    for ((ingredientId, delta) in adjustments) {
                        if (delta == 0.0) continue
                        val ingredient = dao.getIngredientSync(ingredientId) ?: continue
                        dao.updateIngredient(
                            ingredient.copy(
                                currentStock = ingredient.currentStock + delta,
                                updatedAt = System.currentTimeMillis()
                            )
                        )
                        dao.insertIngredientTransaction(
                            IngredientTransaction(
                                ingredientId = ingredientId,
                                type = "ADJUSTMENT",
                                quantity = delta,
                                referenceType = "batch",
                                notes = if (notes.isBlank()) batchToken else "$notes · $batchToken",
                                createdAt = System.currentTimeMillis()
                            )
                        )
                        written++
                    }
                    // Spec 014 T030: one audit event per batch write, inside the
                    // same transaction (same pattern as the VOID_PURCHASE audit).
                    if (written > 0) {
                        logAuditEvent(
                            "BULK_ADJUST",
                            "ingredient",
                            0,
                            details = "Bulk adjusted $written ingredient(s) (batch $batchToken${if (notes.isNotBlank()) "; $notes" else ""})"
                        )
                    }
                }
            } catch (e: Throwable) {
                android.util.Log.e("BulkAdjust", "Bulk adjustment failed", e)
            }
        }
    }

    suspend fun adjustStock(ingredientId: Int, newStock: Double, notes: String? = null) {
        val ingredient = dao.getIngredientSync(ingredientId) ?: return
        val delta = newStock - ingredient.currentStock
        dao.updateIngredient(ingredient.copy(currentStock = newStock))
        dao.insertIngredientTransaction(
            IngredientTransaction(
                ingredientId = ingredientId,
                type = "ADJUSTMENT",
                quantity = delta,
                notes = notes,
                createdAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun getIngredientSync(id: Int): Ingredient? = dao.getIngredientSync(id)

    /** Per-ingredient latest price + change vs previous price from ONE supplier (spec 014, US3). */
    suspend fun supplierIngredientTrends(supplierId: Int): List<SupplierIngredientTrend> {
        val purchases = dao.purchasesForSupplier(supplierId)
        val ingredientNames = dao.getAllIngredients().firstOrNull()?.associateBy { it.id } ?: emptyMap()
        return purchases.groupBy { it.ingredientId }.mapNotNull { (ingredientId, rows) ->
            val ingredient = ingredientNames[ingredientId] ?: return@mapNotNull null
            val ordered = rows.sortedBy { it.id }
            val priced = ordered.filter { it.unitCost != null }
            val latest = priced.lastOrNull()
            val previous = if (priced.size >= 2) priced[priced.size - 2].unitCost else null
            SupplierIngredientTrend(
                ingredientName = ingredient.name,
                baseUnit = ingredient.baseUnit,
                latestUnitCost = latest?.unitCost,
                previousUnitCost = previous,
                change = if (latest != null && previous != null) PriceTrends.change(previous, latest.unitCost ?: 0.0) else null,
                purchaseCount = ordered.size,
                lastPurchaseDate = ordered.lastOrNull()?.createdAt
            )
        }.sortedBy { it.ingredientName }
    }

    private suspend fun consumeRecipeStock(orderItems: List<OrderItem>) {
        val ingredients = dao.getAllIngredients().firstOrNull()?.associateBy { it.id } ?: return
        orderItems.forEach { orderItem ->
            dao.getProductIngredients(orderItem.productId).forEach { recipe ->
                val ingredient = ingredients[recipe.ingredientId] ?: return@forEach
                val consumed = recipe.quantity * orderItem.quantity
                dao.updateIngredient(ingredient.copy(currentStock = ingredient.currentStock - consumed))
                dao.insertIngredientTransaction(
                    IngredientTransaction(
                        ingredientId = ingredient.id,
                        type = "USAGE",
                        quantity = -consumed,
                        notes = "Order consumption"
                    )
                )
            }
            dao.getOrderOptions(orderItem.id).forEach { option ->
                val ingredientId = option.ingredientId ?: return@forEach
                val ingredient = ingredients[ingredientId] ?: return@forEach
                val consumed = option.ingredientQuantity * orderItem.quantity
                if (consumed <= 0.0) return@forEach
                dao.updateIngredient(ingredient.copy(currentStock = ingredient.currentStock - consumed))
                dao.insertIngredientTransaction(
                    IngredientTransaction(
                        ingredientId = ingredientId,
                        type = "USAGE",
                        quantity = -consumed,
                        notes = "Add-on: ${option.value}"
                    )
                )
            }
        }
    }

    /** Reverses the stock consumption recorded for a cancelled order. Mirrors
     *  [consumeRecipeStock] with additive adjustments, in the same transaction
     *  as the status change so stock can never be lost on a cancellation. */
    private suspend fun restoreStockForOrder(order: Order) {
        val ingredients = dao.getAllIngredients().firstOrNull()?.associateBy { it.id } ?: return
        dao.getOrderItems(order.id).forEach { item ->
            dao.getProductIngredients(item.productId).forEach { recipe ->
                val ingredient = ingredients[recipe.ingredientId] ?: return@forEach
                val restored = recipe.quantity * item.quantity
                dao.updateIngredient(ingredient.copy(currentStock = ingredient.currentStock + restored))
                dao.insertIngredientTransaction(
                    IngredientTransaction(
                        ingredientId = ingredient.id,
                        type = "ADJUSTMENT",
                        quantity = restored,
                        notes = "Order cancelled: stock restored"
                    )
                )
            }
            dao.getOrderOptions(item.id).forEach { option ->
                val ingredientId = option.ingredientId ?: return@forEach
                val ingredient = ingredients[ingredientId] ?: return@forEach
                val restored = option.ingredientQuantity * item.quantity
                if (restored <= 0.0) return@forEach
                dao.updateIngredient(ingredient.copy(currentStock = ingredient.currentStock + restored))
                dao.insertIngredientTransaction(
                    IngredientTransaction(
                        ingredientId = ingredientId,
                        type = "ADJUSTMENT",
                        quantity = restored,
                        notes = "Order cancelled: add-on stock restored"
                    )
                )
            }
        }
    }

    /** Releases the voucher use counted when the order was placed. */
    private suspend fun revertVoucherForOrder(order: Order) {
        val code = order.discountReason ?: return
        dao.getAllVouchersNow().firstOrNull { it.code == code }?.let { voucher ->
            if (voucher.usedCount > 0) {
                dao.updateVoucher(voucher.copy(usedCount = voucher.usedCount - 1))
            }
        }
    }

    suspend fun saveSupplier(supplier: Supplier) {
        if (supplier.id == 0) dao.insertSupplier(supplier) else dao.updateSupplier(supplier)
    }

    suspend fun deleteSupplier(supplier: Supplier) {
        // Spec 014 / no silent data loss: deleting a supplier must never leave an
        // ingredient pointing at a missing vendor. Recompute every affected
        // ingredient's latest supplier from remaining purchase history first.
        val affected = dao.getAllIngredients().firstOrNull().orEmpty().filter { it.lastSupplierId == supplier.id }
        dao.deleteSupplier(supplier)
        for (ingredient in affected) {
            // Exclude the deleted supplier so an ingredient falls back to its
            // prior supplier (or none) and never re-points at the removed id.
            val latest = dao.latestSupplierIdForIngredientExcluding(ingredient.id, supplier.id)
            if (latest != ingredient.lastSupplierId) {
                dao.updateIngredient(ingredient.copy(lastSupplierId = latest, updatedAt = System.currentTimeMillis()))
            }
        }
    }

    /**
     * Void a purchase (spec 014 FR-009): appends a compensating VOID_PURCHASE row
     * (the original purchase is never modified), reverses stock in the same
     * transaction, and — only when the voided row is the latest non-void
     * purchase — reverts costPerUnit/lastSupplierId to the previous non-void
     * purchase. Callers confirm via admin passcode first (mirrors order cancel).
     */
    fun voidPurchase(transaction: IngredientTransaction) {
        if (transaction.type != "PURCHASE") return
        viewModelScope.launch {
            try {
                db.withTransaction {
                    val ingredient = dao.getIngredientSync(transaction.ingredientId) ?: return@withTransaction
                    // Pure decision (T026/T028): latest/previous are the max-id
                    // PURCHASE rows — VOID rows can never be latest or previous.
                    val ledger = dao.getIngredientLedgerSync(transaction.ingredientId)
                    val plan = VoidReversal.plan(ledger, transaction.id)

                    val stockReverted = ingredient.copy(
                        currentStock = (ingredient.currentStock - transaction.quantity).coerceAtLeast(0.0),
                        updatedAt = System.currentTimeMillis()
                    )
                    val updated = if (plan.voidedIsLatest) {
                        stockReverted.copy(costPerUnit = plan.previousUnitCost ?: 0.0, lastSupplierId = plan.previousSupplierId)
                    } else {
                        stockReverted
                    }
                    dao.updateIngredient(updated)
                    dao.insertIngredientTransaction(
                        IngredientTransaction(
                            ingredientId = transaction.ingredientId,
                            type = "VOID_PURCHASE",
                            quantity = -transaction.quantity,
                            referenceType = "void-of",
                            referenceId = transaction.id,
                            notes = "Void of purchase #${transaction.id}" + if (plan.voidedIsLatest) " (latest — cost/last supplier reverted)" else " (older purchase — stock only)",
                            createdAt = System.currentTimeMillis()
                        )
                    )
                    logAuditEvent("VOID_PURCHASE", "ingredient_transaction", transaction.id, details = "Voided purchase of ingredient ${ingredient.name}")
                }
            } catch (e: Throwable) {
                android.util.Log.e("VoidPurchase", "Failed to void purchase", e)
            }
        }
    }

    fun addCustomer(name: String, contact: String?) {
        viewModelScope.launch { dao.insertCustomer(Customer(name = name, contact = contact)) }
    }

    suspend fun updateCustomerPoints(customerId: Int, points: Int) {
        dao.updateCustomerPoints(customerId, points)
    }

    suspend fun saveTable(table: CafeTable) {
        if (table.id == 0) dao.insertTable(table) else dao.updateTable(table)
    }

    suspend fun deleteTable(table: CafeTable) = dao.deleteTable(table)

    suspend fun saveStation(station: Station) {
        if (station.id == 0) dao.insertStation(station) else dao.updateStation(station)
    }

    suspend fun deleteStation(station: Station) = dao.deleteStation(station)

    suspend fun saveStaff(staff: Staff) {
        // Hash any newly-entered (plaintext) PIN. Already-hashed values (edits
        // where the PIN was not changed, or imported data) pass through as-is.
        val prepared = if (staff.pin != null && !PinHasher.isHashed(staff.pin)) {
            staff.copy(pin = PinHasher.hash(staff.pin))
        } else {
            staff
        }
        if (prepared.id == 0) {
            dao.insertStaff(prepared)
            logAuditEvent("STAFF_CREATE", "staff", 0, details = prepared.name)
        } else {
            dao.updateStaff(prepared)
            logAuditEvent("STAFF_UPDATE", "staff", prepared.id, details = prepared.name)
        }
    }

    suspend fun deleteStaff(staff: Staff) {
        logAuditEvent("STAFF_DELETE", "staff", staff.id, details = staff.name)
        dao.deleteStaff(staff)
    }

    /** True when at least one staff account exists. Drives first-run setup UI. */
    suspend fun hasAnyStaff(): Boolean = dao.getAllStaffCount() > 0

    suspend fun authenticateStaff(pin: String): Staff? {
        if (pin.isBlank()) return null
        for (staff in dao.getAllStaffNow().filter { it.active }) {
            val stored = staff.pin
            if (PinHasher.matches(pin, stored)) {
                // Upgrade legacy plaintext rows to a hash on first successful login.
                if (!PinHasher.isHashed(stored)) {
                    dao.updateStaff(staff.copy(pin = PinHasher.hash(pin)))
                }
                return staff
            }
        }
        return null
    }

    suspend fun authenticateAdminPasscode(pin: String): Boolean {
        return authenticateStaff(pin)?.role?.equals("ADMIN", ignoreCase = true) == true
    }

    fun saveVoucher(voucher: LoyaltyVoucher) {
        viewModelScope.launch {
            if (voucher.id == 0) {
                dao.insertVoucher(voucher)
                logAuditEvent("VOUCHER_CREATE", "loyalty_voucher", 0, details = voucher.code)
            } else {
                dao.updateVoucher(voucher)
                logAuditEvent("VOUCHER_UPDATE", "loyalty_voucher", voucher.id, details = voucher.code)
            }
        }
    }

    suspend fun deleteVoucher(voucher: LoyaltyVoucher) {
        logAuditEvent("VOUCHER_DELETE", "loyalty_voucher", voucher.id, details = voucher.code)
        dao.deleteVoucher(voucher)
    }

    // Order Messages
    val allReviews = dao.getAllReviews()
    val allExpenseCategories = dao.getAllExpenseCategories()
    val recentAuditEvents = dao.getRecentAuditEvents()

    // HR: Attendance
    val pendingLeaveRequests = dao.getPendingLeaveRequests()

    fun clockIn(staffId: Int) {
        viewModelScope.launch {
            dao.insertAttendance(Attendance(staffId = staffId, clockIn = System.currentTimeMillis()))
        }
    }

    fun clockOut(attendanceId: Int, breakStart: Long? = null, breakEnd: Long? = null) {
        viewModelScope.launch {
            dao.updateAttendanceClockOut(attendanceId, System.currentTimeMillis(), breakStart, breakEnd)
        }
    }

    suspend fun getStaffAttendance(staffId: Int, start: Long, end: Long): List<Attendance> =
        dao.getStaffAttendanceRange(staffId, start, end)

    // HR: Leave Types
    fun getAllLeaveTypes(): Flow<List<LeaveType>> = dao.getAllLeaveTypes()

    fun addLeaveType(name: String, requiresFile: Boolean = false) {
        viewModelScope.launch {
            dao.insertLeaveType(LeaveType(name = name, requiresFile = requiresFile))
        }
    }

    suspend fun updateLeaveType(leaveType: LeaveType) {
        dao.updateLeaveType(leaveType)
    }

    suspend fun deleteLeaveType(leaveType: LeaveType) {
        dao.deleteLeaveType(leaveType)
    }

    // HR: Leave Requests
    fun requestLeave(staffId: Int, type: String, startDate: Long, endDate: Long, reason: String? = null) {
        viewModelScope.launch {
            dao.insertLeaveRequest(
                LeaveRequest(staffId = staffId, type = type, startDate = startDate, endDate = endDate, reason = reason)
            )
        }
    }

    suspend fun approveLeaveRequest(request: LeaveRequest) {
        dao.updateLeaveRequest(request.copy(status = "APPROVED"))
    }

    suspend fun rejectLeaveRequest(request: LeaveRequest) {
        dao.updateLeaveRequest(request.copy(status = "REJECTED"))
    }

    suspend fun getStaffLeaveRequests(staffId: Int): List<LeaveRequest> = dao.getStaffLeaveRequests(staffId)

    // HR: Schedules
    fun addSchedule(staffId: Int, dayOfWeek: Int, shiftStart: String, shiftEnd: String, role: String? = null) {
        viewModelScope.launch {
            dao.insertSchedule(Schedule(staffId = staffId, dayOfWeek = dayOfWeek, shiftStart = shiftStart, shiftEnd = shiftEnd, role = role))
        }
    }

    suspend fun updateSchedule(schedule: Schedule) {
        dao.updateSchedule(schedule)
    }

    suspend fun deleteSchedule(schedule: Schedule) {
        dao.deleteSchedule(schedule)
    }

    suspend fun getStaffSchedules(staffId: Int): List<Schedule> = dao.getStaffSchedules(staffId)

    // HR: Payroll
    fun generatePayroll(staffId: Int, periodStart: Long, periodEnd: Long, baseSalary: Double,
                        overtimePay: Double = 0.0, sss: Double = 0.0, philhealth: Double = 0.0,
                       pagibig: Double = 0.0, tax: Double = 0.0, deductions: Double = 0.0,
                       profitShareRate: Double = 0.0) {
        viewModelScope.launch {
            val totalDeductions = sss + philhealth + pagibig + tax + deductions
            val periodOrders = (dao.getAllOrders().firstOrNull() ?: emptyList()).filter {
                it.createdAt in periodStart..periodEnd && it.status != "CANCELLED"
            }
            val profitShare = if (profitShareRate > 0.0 && periodOrders.isNotEmpty()) {
                (calculatePeriodMetrics(periodOrders).netProfit.coerceAtLeast(0.0) * profitShareRate / 100.0)
            } else 0.0
            val netPay = baseSalary + overtimePay + profitShare - totalDeductions
            dao.insertPayroll(
                Payroll(
                    staffId = staffId, periodStart = periodStart, periodEnd = periodEnd,
                    baseSalary = baseSalary, overtimePay = overtimePay, deductions = deductions,
                    sss = sss, philhealth = philhealth, pagibig = pagibig, tax = tax,
                    profitShareAmount = profitShare,
                    netPay = netPay
                )
            )
        }
    }

    suspend fun updatePayroll(payroll: Payroll) {
        dao.updatePayroll(payroll)
    }

    suspend fun getStaffPayrolls(staffId: Int): List<Payroll> = dao.getStaffPayrolls(staffId)

    // HR: Staff Documents
    fun addStaffDocument(staffId: Int, title: String, fileUri: String, fileType: String? = null) {
        viewModelScope.launch {
            dao.insertStaffDocument(StaffDocument(staffId = staffId, title = title, fileUri = fileUri, fileType = fileType))
        }
    }

    suspend fun getStaffDocuments(staffId: Int): List<StaffDocument> = dao.getStaffDocuments(staffId)

    suspend fun deleteStaffDocument(document: StaffDocument) {
        dao.deleteStaffDocument(document)
    }

    // HR: Staff Training
    fun addStaffTraining(staffId: Int, program: String, completed: Boolean = false, certifiedAt: Long? = null) {
        viewModelScope.launch {
            dao.insertStaffTraining(StaffTraining(staffId = staffId, program = program, completed = completed, certifiedAt = certifiedAt))
        }
    }

    suspend fun updateStaffTraining(training: StaffTraining) {
        dao.updateStaffTraining(training)
    }

    suspend fun deleteStaffTraining(training: StaffTraining) {
        dao.deleteStaffTraining(training)
    }

    suspend fun getStaffTrainings(staffId: Int): List<StaffTraining> = dao.getStaffTrainings(staffId)

    // HR: Performance Reviews
    fun addPerformanceReview(staffId: Int, reviewerId: Int? = null, score: Int, comments: String? = null) {
        viewModelScope.launch {
            dao.insertPerformanceReview(PerformanceReview(staffId = staffId, reviewerId = reviewerId, score = score, comments = comments))
        }
    }

    suspend fun updatePerformanceReview(review: PerformanceReview) {
        dao.updatePerformanceReview(review)
    }

        suspend fun getStaffReviews(staffId: Int): List<PerformanceReview> = dao.getStaffReviews(staffId)

    // Product Options (product-specific price deltas)
    val activeTableSessions = dao.getActiveTableSessions()

    suspend fun getProductOptions(productId: Int): List<ProductOption> = dao.getProductOptions(productId)

    fun addProductOption(productId: Int, optionId: Int, priceDelta: Double) {
        viewModelScope.launch {
            dao.insertProductOption(ProductOption(productId = productId, optionId = optionId, priceDelta = priceDelta))
        }
    }

    suspend fun deleteProductOptionsByProduct(productId: Int) {
        dao.deleteProductOptionsByProduct(productId)
    }

    // Table Sessions
    fun openTableSession(tableId: Int, guestCount: Int = 0) {
        viewModelScope.launch {
            dao.insertTableSession(
                TableSession(
                    tableId = tableId,
                    startedAt = System.currentTimeMillis(),
                    guestCount = guestCount
                )
            )
        }
    }

    suspend fun getTableSessions(tableId: Int): List<TableSession> = dao.getTableSessions(tableId)

    fun closeTableSession(sessionId: Int) {
        viewModelScope.launch {
            dao.closeTableSession(sessionId, System.currentTimeMillis())
        }
    }

    // Export/Import extensions for Phase 1 remaining entities

    suspend fun exportLeaveTypes(): List<LeaveType> = dao.getAllLeaveTypesNow()
    suspend fun exportLeaveRequests(): List<LeaveRequest> = dao.getAllLeaveRequestsNow()
    suspend fun exportSchedules(): List<Schedule> = dao.getAllSchedulesNow()
    suspend fun exportPayrolls(): List<Payroll> = dao.getAllPayrollsNow()
    suspend fun exportStaffDocuments(): List<StaffDocument> = dao.getAllStaffDocumentsNow()
    suspend fun exportStaffTrainings(): List<StaffTraining> = dao.getAllStaffTrainingsNow()
    suspend fun exportPerformanceReviews(): List<PerformanceReview> = dao.getAllPerformanceReviewsNow()
    suspend fun exportAttendance(): List<Attendance> = dao.getAllAttendanceNow()
    suspend fun exportProductOptions(): List<ProductOption> = dao.getAllProductOptionsNow()
    suspend fun exportTableSessions(): List<TableSession> = dao.getAllTableSessionsNow()
    suspend fun exportLoyaltyCards(): List<LoyaltyCard> = dao.getAllLoyaltyCardsNow()
    suspend fun exportLoyaltyTransactions(): List<LoyaltyTransaction> = dao.getAllLoyaltyTransactionsNow()
    suspend fun exportLoyaltySettings(): List<LoyaltySetting> = dao.getAllLoyaltySettingsNow()
    suspend fun exportAIConversations(): List<AIConversation> = dao.getAllAIConversationsNow()
    suspend fun exportAIMessages(): List<AIMessage> = dao.getAllAIMessagesNow()
    suspend fun exportGuests(): List<Guest> = dao.getAllGuestsNow()
    suspend fun exportTableSections(): List<TableSection> = dao.getAllTableSectionsNow()
    suspend fun exportProductStations(): List<ProductStation> = dao.getAllProductStationsNow()
    suspend fun exportSupplierIngredientPrices(): List<SupplierIngredientPrice> = dao.getAllSupplierIngredientPricesNow()

    // Loyalty Cards
    val allLoyaltyCards = dao.getAllLoyaltyCards()

    suspend fun getCardsByCustomer(customerId: Int): List<LoyaltyCard> = dao.getCardsByCustomer(customerId)

    fun createLoyaltyCard(customerId: Int? = null, cardNumber: String, startingPoints: Double = 0.0, tier: String = "CASUAL") {
        viewModelScope.launch {
            dao.insertLoyaltyCard(
                LoyaltyCard(
                    customerId = customerId,
                    cardNumber = cardNumber,
                    pointsBalance = startingPoints,
                    tier = tier
                )
            )
        }
    }

    fun addLoyaltyPoints(cardId: Int, points: Double, orderId: Int? = null, details: String? = null) {
        viewModelScope.launch {
            val card = dao.getLoyaltyCardById(cardId)
            if (card != null) {
                val newBalance = card.pointsBalance + points
                dao.updateLoyaltyCard(card.copy(pointsBalance = newBalance, updatedAt = System.currentTimeMillis()))
                dao.insertLoyaltyTransaction(
                    LoyaltyTransaction(
                        cardId = cardId,
                        type = "EARN",
                        points = points,
                        orderId = orderId,
                        details = details
                    )
                )
            }
        }
    }

    fun redeemLoyaltyPoints(cardId: Int, points: Double, orderId: Int? = null, details: String? = null) {
        viewModelScope.launch {
            val card = dao.getLoyaltyCardById(cardId)
            if (card != null && card.pointsBalance >= points) {
                val newBalance = card.pointsBalance - points
                val newTier = when {
                    newBalance >= 1000 -> "VIP"
                    newBalance >= 500 -> "REGULAR"
                    newBalance >= 100 -> "CASUAL"
                    else -> "AT_RISK"
                }
                dao.updateLoyaltyCard(card.copy(pointsBalance = newBalance, tier = newTier, updatedAt = System.currentTimeMillis()))
                dao.insertLoyaltyTransaction(
                    LoyaltyTransaction(
                        cardId = cardId,
                        type = "REDEEM",
                        points = -points,
                        orderId = orderId,
                        details = details
                    )
                )
            }
        }
    }

    suspend fun getLoyaltyTransactions(cardId: Int): List<LoyaltyTransaction> = dao.getTransactionsByCard(cardId)

    suspend fun getLoyaltySetting(key: String, scope: String = "GLOBAL"): String? = dao.getLoyaltySetting(key, scope)

    fun setLoyaltySetting(key: String, value: String, scope: String = "GLOBAL") {
        viewModelScope.launch {
            dao.upsertLoyaltySetting(LoyaltySetting(key = key, value = value, scope = scope))
        }
    }

    // AI Conversations & Messages
    val allAIConversations = dao.getAllAIConversations()

    fun createAIConversation(title: String): Long {
        var convId = 0L
        viewModelScope.launch {
            convId = dao.insertAIConversation(AIConversation(title = title))
        }
        return convId
    }

    suspend fun getAIMessages(conversationId: Int): List<AIMessage> = dao.getAIMessages(conversationId)

    fun addAIMessage(conversationId: Int, role: String, content: String) {
        viewModelScope.launch {
            dao.insertAIMessage(AIMessage(conversationId = conversationId, role = role, content = content))
            dao.updateAIConversation(
                AIConversation(
                    id = conversationId,
                    title = "",
                    updatedAt = System.currentTimeMillis()
                )
            )
        }
    }

    suspend fun getOrderMessages(orderId: Int): List<OrderMessage> = dao.getOrderMessages(orderId)

    fun addOrderMessage(orderId: Int, text: String, senderType: String = "staff", senderName: String? = null) {
        viewModelScope.launch {
            dao.insertOrderMessage(
                OrderMessage(
                    orderId = orderId,
                    text = text,
                    senderType = senderType,
                    senderName = senderName
                )
            )
        }
    }

    suspend fun markMessagesRead(orderId: Int) {
        dao.markMessagesRead(orderId)
    }

    fun addReview(productId: Int, rating: Int, comment: String? = null, customerId: Int? = null) {
        viewModelScope.launch {
            dao.insertReview(
                Review(
                    productId = productId,
                    customerId = customerId,
                    rating = rating,
                    comment = comment
                )
            )
        }
    }

    suspend fun deleteReview(review: Review) {
        dao.deleteReview(review)
    }

    suspend fun getReviewsByProduct(productId: Int): List<Review> = dao.getReviewsByProduct(productId)

    fun addExpenseCategory(name: String, color: String? = null, icon: String? = null) {
        viewModelScope.launch {
            dao.insertExpenseCategory(
                ExpenseCategory(
                    name = name,
                    color = color,
                    icon = icon
                )
            )
        }
    }

    suspend fun updateExpenseCategory(category: ExpenseCategory) {
        dao.updateExpenseCategory(category)
    }

    suspend fun deleteExpenseCategory(category: ExpenseCategory) {
        dao.deleteExpenseCategory(category)
    }

    suspend fun logAuditEvent(eventType: String, entityType: String, entityId: Int, staffId: Int? = null, details: String? = null) {
        dao.insertAuditEvent(
            AuditEvent(
                eventType = eventType,
                entityType = entityType,
                entityId = entityId,
                staffId = staffId,
                details = details
            )
        )
    }

    // Guests
    val allTableSections = dao.getAllTableSections()

    suspend fun getGuestsForSession(tableSessionId: Int): List<Guest> = dao.getGuestsForSession(tableSessionId)

    fun addGuest(tableSessionId: Int, name: String?) {
        viewModelScope.launch {
            dao.insertGuest(Guest(tableSessionId = tableSessionId, name = name))
        }
    }

    fun updateGuestMood(guest: Guest, mood: String) {
        viewModelScope.launch {
            dao.updateGuest(guest.copy(mood = mood))
        }
    }

    fun markGuestLeft(guestId: Int) {
        viewModelScope.launch {
            dao.markGuestLeft(guestId, System.currentTimeMillis())
        }
    }

    // Table Sections
    fun saveTableSection(section: TableSection) {
        viewModelScope.launch {
            if (section.id == 0) dao.insertTableSection(section) else dao.updateTableSection(section)
        }
    }

    suspend fun deleteTableSection(section: TableSection) = dao.deleteTableSection(section)

    // Product Station routing
    fun assignProductToStation(productId: Int, stationId: Int) {
        viewModelScope.launch {
            dao.insertProductStation(ProductStation(productId = productId, stationId = stationId))
        }
    }

    suspend fun getProductStations(productId: Int): List<ProductStation> = dao.getProductStations(productId)

    suspend fun getProductsForStation(stationId: Int): List<ProductStation> = dao.getProductsForStation(stationId)

    suspend fun deleteProductStation(productId: Int, stationId: Int) = dao.deleteProductStation(productId, stationId)

    // Supplier Ingredient Pricing
    suspend fun getPricesForIngredient(ingredientId: Int): List<SupplierIngredientPrice> = dao.getPricesForIngredient(ingredientId)

    suspend fun getPricesForSupplier(supplierId: Int): List<SupplierIngredientPrice> = dao.getPricesForSupplier(supplierId)

    fun saveSupplierIngredientPrice(price: SupplierIngredientPrice) {
        viewModelScope.launch {
            dao.insertSupplierIngredientPrice(price)
        }
    }

    suspend fun deleteSupplierIngredientPrice(price: SupplierIngredientPrice) = dao.deleteSupplierIngredientPrice(price)

    // Customer Analytics
    suspend fun getCustomerOrderCount(customerId: Int): Int {
        return dao.getAllOrders().firstOrNull()?.count { it.customerName == getCustomerNameById(customerId) } ?: 0
    }

    suspend fun getCustomerTotalSpent(customerId: Int): Double {
        val name = getCustomerNameById(customerId)
        return dao.getAllOrders().firstOrNull()?.filter { it.customerName == name }?.sumOf { it.totalAmount } ?: 0.0
    }

    suspend fun getCustomerNameById(customerId: Int): String {
        // We don't have a direct relation, customers are looked up by name
        // Return empty as customers are identified by name in orders
        return ""
    }

    suspend fun getCustomerVisitFrequency(days: Int): Double {
        val cutoff = System.currentTimeMillis() - (days * 24 * 3600_000L)
        val recentOrders = dao.getAllOrders().firstOrNull()?.filter { it.createdAt >= cutoff } ?: emptyList()
        val uniqueCustomers = recentOrders.mapNotNull { it.customerName }.toSet().size
        return if (uniqueCustomers > 0) recentOrders.size.toDouble() / uniqueCustomers else 0.0
    }

    suspend fun getChurnRate(days: Int): Double {
        val cutoff = System.currentTimeMillis() - (days * 24 * 3600_000L)
        val allCustomers = dao.getAllCustomers().firstOrNull() ?: emptyList()
        val recentOrders = dao.getAllOrders().firstOrNull()?.filter { it.createdAt >= cutoff } ?: emptyList()
        val activeCustomers = recentOrders.mapNotNull { it.customerName }.toSet().size
        val totalCustomers = allCustomers.size
        return if (totalCustomers > 0) {
            ((totalCustomers - activeCustomers).toDouble() / totalCustomers * 100.0)
        } else 0.0
    }

    // Loyalty Voucher redemption
    suspend fun getVoucherRedemptionRate(): Double {
        val vouchers = dao.getActiveVouchersNow()
        if (vouchers.isEmpty()) return 0.0
        val totalPotentialUses = vouchers.sumOf { it.usageLimit }
        val actualUses = vouchers.sumOf { it.usedCount }
        return if (totalPotentialUses > 0) (actualUses.toDouble() / totalPotentialUses * 100.0) else 0.0
    }

    suspend fun getVoucherTotalSavings(): Double {
        val vouchers = dao.getActiveVouchersNow()
        return vouchers.sumOf { it.discountValue * it.usedCount }
    }

    // Export/Import extensions for new entities
    suspend fun exportReviews(): List<Review> = dao.getAllReviewsNow()
    suspend fun exportOrderMessages(orderId: Int): List<OrderMessage> = dao.getOrderMessages(orderId)
    suspend fun exportExpenseCategories(): List<ExpenseCategory> = dao.getAllExpenseCategoriesNow()
    suspend fun exportAuditEvents(): List<AuditEvent> = dao.getAllAuditEventsNow()

    suspend fun importAllData(context: Context, uri: Uri): ImportResult {
        var importedCount = 0
        var skippedCount = 0
        try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                BufferedReader(InputStreamReader(input)).use { reader ->
                    val jsonString = reader.readText()
                    val data = Json { ignoreUnknownKeys = true }.decodeFromString<ExportData>(jsonString)

                    // The whole import is one transaction: any failure rolls back so a
                    // partial snapshot is never left behind (constitution §VII).
                    db.withTransaction {
                    for (category in data.categories) {
                        dao.insertCategory(category)
                        importedCount++
                    }
                    for (product in data.products) {
                        dao.insertProduct(product)
                        importedCount++
                    }
                    // Orders merge on the business key (orderNumber). Existing orders
                    // are kept; children (items/payments/messages) are only copied for
                    // orders inserted by THIS import, so re-importing a snapshot never
                    // duplicates an order's rows.
                    val existingOrdersByNumber = (dao.getAllOrders().firstOrNull() ?: emptyList()).associateBy { it.orderNumber }
                    val orderIdMap = HashMap<Int, Int>()
                    val orderImportedNow = HashSet<Int>()
                    for (order in data.orders) {
                        val existing = dao.getOrderById(order.id) ?: existingOrdersByNumber[order.orderNumber]
                        if (existing != null) {
                            orderIdMap[order.id] = existing.id
                            skippedCount++
                        } else {
                            val newId = dao.insertOrder(order.copy(id = 0)).toInt()
                            orderIdMap[order.id] = newId
                            orderImportedNow.add(order.id)
                            importedCount++
                        }
                    }
                    for (item in data.orderItems) {
                        val orderId = orderIdMap[item.orderId]
                        if (orderId == null || !orderImportedNow.contains(item.orderId)) {
                            skippedCount++
                            continue
                        }
                        val product = dao.getAllProducts().firstOrNull()?.find { it.id == item.productId }
                        if (product != null) {
                            val orderItem = OrderItem(orderId = orderId, productId = item.productId, quantity = item.quantity, unitPrice = item.unitPrice, subtotal = item.subtotal)
                            val itemId = dao.insertOrderItem(orderItem).toInt()
                            val options = item.options.map { OptionExport(it.name, it.value) }
                            dao.insertOrderOptions(options.map { OrderOption(orderItemId = itemId, name = it.name, value = it.value) })
                            importedCount++
                        }
                    }
                    // Spec 014 T025 (bridge-schema import rules): parents
                    // (suppliers, then ingredients) are inserted before any
                    // transaction rows reference them. A purchase referencing a
                    // supplier that does not exist at the destination keeps its
                    // row but its supplier link is cleared — never dropped. A
                    // legacy row without reference fields imports unchanged.
                    for (supplier in data.suppliers) {
                        dao.insertSupplier(supplier)
                        importedCount++
                    }
                    val supplierIds = (dao.getAllSuppliers().firstOrNull() ?: emptyList()).map { it.id }.toSet()
                    for (ingredient in data.ingredients) {
                        val resolved = SnapshotImportRules.resolveLatestSupplier(ingredient) { it in supplierIds }
                        dao.insertIngredient(resolved)
                        importedCount++
                    }
                    for (recipe in data.productIngredients) {
                        dao.insertProductIngredient(recipe)
                        importedCount++
                    }
                    for (txn in data.ingredientTransactions) {
                        val resolved = SnapshotImportRules.resolveSupplierLink(txn) { it in supplierIds }
                        dao.insertIngredientTransaction(resolved.copy(id = 0))
                        importedCount++
                    }
                    for (payment in data.payments) {
                        val orderId = orderIdMap[payment.orderId]
                        if (orderId != null && orderImportedNow.contains(payment.orderId)) {
                            dao.insertPayment(payment.copy(id = 0, orderId = orderId))
                            importedCount++
                        } else {
                            skippedCount++
                        }
                    }
                    for (customer in data.customers) {
                        dao.insertCustomer(customer)
                        importedCount++
                    }
                    for (table in data.tables) {
                        dao.insertTable(table)
                        importedCount++
                    }
                    for (station in data.stations) {
                        dao.insertStation(station)
                        importedCount++
                    }
                    for (optionGroup in data.optionGroups) {
                        dao.insertOptionGroup(optionGroup)
                        importedCount++
                    }
                    for (pog in data.productOptionGroups) {
                        dao.insertProductOptionGroup(ProductOptionGroup(id = pog.id, productId = pog.productId, groupId = pog.groupId))
                        importedCount++
                    }
                    for (option in data.options) {
                        dao.insertOption(Option(id = option.id, groupId = option.groupId, name = option.name, priceDelta = option.priceDelta, sortOrder = option.sortOrder, ingredientId = option.ingredientId, ingredientQuantity = option.ingredientQuantity))
                        importedCount++
                    }
                    for (expense in data.expenses) {
                        dao.insertExpense(expense)
                        importedCount++
                    }
                    data.businessSettings?.let { settings ->
                        dao.upsertBusinessSettings(settings)
                        importedCount++
                    }
                    for (category in data.expenseCategories) {
                        dao.insertExpenseCategory(category)
                        importedCount++
                    }
                    for (staff in data.staff) {
                        dao.insertStaff(
                            if (staff.pin != null && !PinHasher.isHashed(staff.pin)) {
                                staff.copy(pin = PinHasher.hash(staff.pin))
                            } else {
                                staff
                            }
                        )
                        importedCount++
                    }
                    for (voucher in data.loyaltyVouchers) {
                        dao.insertVoucher(voucher)
                        importedCount++
                    }
                    for (review in data.reviews) {
                        dao.insertReview(review)
                        importedCount++
                    }
                    for (message in data.orderMessages) {
                        val orderId = orderIdMap[message.orderId]
                        if (orderId != null && orderImportedNow.contains(message.orderId)) {
                            dao.insertOrderMessage(message.copy(id = 0, orderId = orderId))
                            importedCount++
                        } else {
                            skippedCount++
                        }
                    }
                    for (event in data.auditEvents) {
                        dao.insertAuditEvent(event)
                        importedCount++
                    }
                    for (leaveType in data.leaveTypes) {
                        dao.insertLeaveType(leaveType)
                        importedCount++
                    }
                    for (request in data.leaveRequests) {
                        dao.insertLeaveRequest(request)
                        importedCount++
                    }
                    for (schedule in data.schedules) {
                        dao.insertSchedule(schedule)
                        importedCount++
                    }
                    for (payroll in data.payrolls) {
                        dao.insertPayroll(payroll)
                        importedCount++
                    }
                    for (doc in data.staffDocuments) {
                        dao.insertStaffDocument(doc)
                        importedCount++
                    }
                    for (training in data.staffTrainings) {
                        dao.insertStaffTraining(training)
                        importedCount++
                    }
                    for (review in data.performanceReviews) {
                        dao.insertPerformanceReview(review)
                        importedCount++
                    }
                     for (att in data.attendance) {
                         dao.insertAttendance(att)
                         importedCount++
                     }
                     for (option in data.productOptions) {
                         dao.insertProductOption(option)
                         importedCount++
                     }
                     for (session in data.tableSessions) {
                         dao.insertTableSession(session)
                         importedCount++
                     }
                     for (card in data.loyaltyCards) {
                         dao.insertLoyaltyCard(card)
                         importedCount++
                     }
                     for (transaction in data.loyaltyTransactions) {
                         dao.insertLoyaltyTransaction(transaction)
                         importedCount++
                     }
                     for (setting in data.loyaltySettings) {
                         dao.upsertLoyaltySetting(setting)
                         importedCount++
                     }
                     for (conversation in data.aiConversations) {
                         dao.insertAIConversation(conversation)
                         importedCount++
                     }
                     for (message in data.aiMessages) {
                         dao.insertAIMessage(message)
                         importedCount++
                     }
                     for (guest in data.guests) {
                         dao.insertGuest(guest)
                         importedCount++
                     }
                     for (section in data.tableSections) {
                         dao.insertTableSection(section)
                         importedCount++
                     }
                      for (productStation in data.productStations) {
                          dao.insertProductStation(productStation)
                          importedCount++
                      }
                      for (price in data.supplierIngredientPrices) {
                          dao.insertSupplierIngredientPrice(price)
                          importedCount++
                      }
                    } // end db.withTransaction
                 }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return ImportResult(success = false, message = "Import failed: ${e.message ?: e.javaClass.simpleName}")
        }
        return ImportResult(imported = importedCount, skipped = skippedCount, success = true)
    }

    data class ImportResult(val imported: Int = 0, val skipped: Int = 0, val success: Boolean = true, val message: String? = null)

    suspend fun exportAllData(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd_HHmmss", Locale.getDefault())
        val timestamp = sdf.format(Date())
        val fileName = "Pebot_Export_$timestamp.json"

        val categories = dao.getAllCategories().firstOrNull() ?: emptyList()
        val products = dao.getAllProducts().firstOrNull() ?: emptyList()
        val orders = dao.getAllOrders().firstOrNull() ?: emptyList()
        val ingredients = dao.getAllIngredients().firstOrNull() ?: emptyList()
        val productIngredients = dao.getAllProductIngredientsNow()
        val ingredientTransactions = dao.getAllIngredientTransactionsNow()
        val payments = dao.getAllPayments().firstOrNull() ?: emptyList()
        val customers = dao.getAllCustomers().firstOrNull() ?: emptyList()
        val suppliers = dao.getAllSuppliers().firstOrNull() ?: emptyList()
        val tables = dao.getAllTables().firstOrNull() ?: emptyList()
        val stations = dao.getAllStations().firstOrNull() ?: emptyList()
        val optionGroups = dao.getAllOptionGroups().firstOrNull() ?: emptyList()
        val productOptionGroups = products.flatMap { product ->
            dao.getProductOptionGroups(product.id).map { pog -> ExportedProductOptionGroup(pog.id, pog.productId, pog.groupId) }
        }
        val allOptions = optionGroups.flatMap { group ->
            dao.getOptionsByGroup(group.id).map { opt -> ExportedOption(opt.id, opt.groupId, opt.name, opt.priceDelta, opt.sortOrder, opt.ingredientId, opt.ingredientQuantity) }
        }

        val productMap = products.associateBy { it.id }

        val allOrderItems = mutableListOf<ExportedOrderItem>()
        for (order in orders) {
            val items = dao.getOrderItems(order.id)
            for (item in items) {
                val options = dao.getOrderOptions(item.id).map { opt -> OptionExport(opt.name, opt.value) }
                allOrderItems.add(
                    ExportedOrderItem(
                        orderId = order.id,
                        productId = item.productId,
                        productName = productMap[item.productId]?.name ?: "Unknown",
                        quantity = item.quantity,
                        unitPrice = item.unitPrice,
                        subtotal = item.subtotal,
                        options = options
                    )
                )
            }
        }

        val exportData = ExportData(
            version = 1,
            shopId = "tablet-001",
            exportedAt = System.currentTimeMillis(),
            categories = categories,
            products = products,
            orders = orders,
            orderItems = allOrderItems,
            ingredients = ingredients,
            productIngredients = productIngredients,
            ingredientTransactions = ingredientTransactions,
            payments = payments,
            customers = customers,
            suppliers = suppliers,
            tables = tables,
            stations = stations,
            optionGroups = optionGroups,
            productOptionGroups = productOptionGroups,
            options = allOptions,
            expenses = dao.getAllExpenses().firstOrNull() ?: emptyList(),
            expenseCategories = dao.getAllExpenseCategoriesNow(),
            businessSettings = dao.getBusinessSettingsSync(),
            staff = dao.getAllStaffNow(),
            loyaltyVouchers = dao.getActiveVouchersNow(),
            reviews = dao.getAllReviewsNow(),
            orderMessages = mutableListOf<OrderMessage>().apply {
                for (order in orders) {
                    addAll(dao.getOrderMessages(order.id))
                }
            },
            auditEvents = dao.getAllAuditEventsNow(),
            leaveTypes = dao.getAllLeaveTypesNow(),
            leaveRequests = dao.getAllLeaveRequestsNow(),
            schedules = dao.getAllSchedulesNow(),
            payrolls = dao.getAllPayrollsNow(),
            staffDocuments = dao.getAllStaffDocumentsNow(),
            staffTrainings = dao.getAllStaffTrainingsNow(),
            performanceReviews = dao.getAllPerformanceReviewsNow(),
            attendance = dao.getAllAttendanceNow(),
            productOptions = dao.getAllProductOptionsNow(),
            tableSessions = dao.getAllTableSessionsNow(),
            loyaltyCards = dao.getAllLoyaltyCardsNow(),
            loyaltyTransactions = dao.getAllLoyaltyTransactionsNow(),
            loyaltySettings = dao.getAllLoyaltySettingsNow(),
            aiConversations = dao.getAllAIConversationsNow(),
            aiMessages = dao.getAllAIMessagesNow(),
            guests = dao.getAllGuestsNow(),
            tableSections = dao.getAllTableSectionsNow(),
            productStations = dao.getAllProductStationsNow(),
            supplierIngredientPrices = dao.getAllSupplierIngredientPricesNow()
        )

        val json = Json { prettyPrint = true; encodeDefaults = true }
        val jsonString = json.encodeToString(exportData)

        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val file = java.io.File(downloadsDir, fileName)
        file.writeText(jsonString)

        dao.upsertSyncMeta(SyncMeta(lastExportAt = System.currentTimeMillis()))

        return file.absolutePath
    }

    suspend fun exportOrderHistoryCsv(uri: Uri) {
        val orders = dao.getAllOrders().firstOrNull() ?: emptyList()
        val csv = buildString {
            appendLine(orderHistoryCsvHeader)
            orders.sortedByDescending { it.createdAt }.forEach { order ->
                appendLine(listOf(
                    order.orderNumber,
                    order.customerName,
                    order.status,
                    order.totalAmount.toString(),
                    order.discountAmount.toString(),
                    order.discountRate.toString(),
                    order.discountReason.orEmpty(),
                    order.paymentMethod,
                    order.orderType,
                    order.tableId?.toString().orEmpty(),
                    order.createdAt.toString()
                ).joinToString(",", transform = ::escapeCsv))
            }
        }
        getApplication<Application>().contentResolver.openOutputStream(uri)?.use { output ->
            output.write(csv.toByteArray(Charsets.UTF_8))
        }
    }

    suspend fun writeOrderHistoryTemplate(uri: Uri) {
        getApplication<Application>().contentResolver.openOutputStream(uri)?.use { output ->
            output.write((orderHistoryCsvHeader + "\n").toByteArray(Charsets.UTF_8))
        }
    }

    suspend fun writeIngredientsTemplate(uri: Uri) {
        getApplication<Application>().contentResolver.openOutputStream(uri)?.use { output ->
            output.write((ingredientCsvHeader + "\n").toByteArray(Charsets.UTF_8))
        }
    }

    suspend fun exportIngredientsCsv(uri: Uri) {
        val ingredients = dao.getAllIngredients().firstOrNull() ?: emptyList()
        val csv = buildString {
            appendLine(ingredientCsvHeader)
            ingredients.sortedBy { it.name }.forEach { ingredient ->
                appendLine(listOf(
                    ingredient.name,
                    ingredient.category,
                    ingredient.baseUnit,
                    ingredient.currentStock.toString(),
                    ingredient.minStock.toString(),
                    ingredient.costPerUnit.toString()
                ).joinToString(",", transform = ::escapeCsv))
            }
        }
        getApplication<Application>().contentResolver.openOutputStream(uri)?.use { output ->
            output.write(csv.toByteArray(Charsets.UTF_8))
        }
    }

    suspend fun importIngredientsCsv(uri: Uri): String {
        val input = getApplication<Application>().contentResolver.openInputStream(uri)
            ?: return "Could not open the selected file."
        val rows = input.bufferedReader(Charsets.UTF_8).use { it.readLines() }
        if (rows.isEmpty()) return "The file is empty."
        val headers = parseCsvLine(rows.first()).map { it.trim() }
        if (headers != ingredientCsvHeader.split(',')) {
            return "Invalid format. Download the ingredient template first."
        }
        val existing = (dao.getAllIngredients().firstOrNull() ?: emptyList()).associateBy { it.name.trim().lowercase() }
        var imported = 0
        var skipped = 0
        rows.drop(1).filter { it.isNotBlank() }.forEach { line ->
            val values = parseCsvLine(line)
            if (values.size != headers.size) {
                skipped++
                return@forEach
            }
            val name = values[0].trim()
            val baseUnit = values[2].trim()
            val currentStock = values[3].toDoubleOrNull()
            val minStock = values[4].toDoubleOrNull()
            val costPerUnit = values[5].toDoubleOrNull()
            if (name.isBlank() || baseUnit.isBlank() || currentStock == null || minStock == null || costPerUnit == null) {
                skipped++
                return@forEach
            }
            val old = existing[name.lowercase()]
            dao.insertIngredient(Ingredient(
                id = old?.id ?: 0,
                name = name,
                category = values[1].ifBlank { "General" },
                baseUnit = baseUnit,
                currentStock = currentStock,
                minStock = minStock,
                costPerUnit = costPerUnit,
                updatedAt = System.currentTimeMillis()
            ))
            imported++
        }
        return "Imported $imported ingredient(s); skipped $skipped row(s)."
    }

    suspend fun importOrderHistoryCsv(uri: Uri): String {
        val input = getApplication<Application>().contentResolver.openInputStream(uri)
            ?: return "Could not open the selected file."
        val rows = input.bufferedReader(Charsets.UTF_8).use { reader -> reader.readLines() }
        if (rows.isEmpty()) return "The file is empty."
        val headers = parseCsvLine(rows.first()).map { it.trim() }
        if (headers != orderHistoryCsvHeader.split(',')) {
            return "Invalid format. Download the order history template first."
        }
        val existingNumbers = (dao.getAllOrders().firstOrNull() ?: emptyList()).map { it.orderNumber }.toMutableSet()
        var imported = 0
        var skipped = 0
        rows.drop(1).filter { it.isNotBlank() }.forEach { line ->
            val values = parseCsvLine(line)
            if (values.size != headers.size) {
                skipped++
                return@forEach
            }
            val orderNumber = values[0].trim()
            val total = values[3].toDoubleOrNull()
            val createdAt = values[10].toLongOrNull()
            if (orderNumber.isBlank() || total == null || createdAt == null || existingNumbers.contains(orderNumber)) {
                skipped++
                return@forEach
            }
            dao.insertOrder(Order(
                orderNumber = orderNumber,
                customerName = values[1].ifBlank { "Walk-in Customer" },
                status = values[2].ifBlank { "COMPLETED" },
                totalAmount = total,
                discountAmount = values[4].toDoubleOrNull() ?: 0.0,
                discountRate = values[5].toDoubleOrNull() ?: 0.0,
                discountReason = values[6].ifBlank { null },
                paymentMethod = values[7].ifBlank { "CASH" },
                orderType = values[8].ifBlank { "DINE_IN" },
                tableId = values[9].toIntOrNull(),
                createdAt = createdAt
            ))
            existingNumbers.add(orderNumber)
            imported++
        }
        return "Imported $imported order(s); skipped $skipped row(s)."
    }

    private fun escapeCsv(value: String): String {
        return if (value.contains(',') || value.contains('"') || value.contains('\n')) {
            "\"${value.replace("\"", "\"\"")}\""
        } else value
    }

    private fun parseCsvLine(line: String): List<String> {
        val values = mutableListOf<String>()
        val value = StringBuilder()
        var quoted = false
        var index = 0
        while (index < line.length) {
            val character = line[index]
            when {
                character == '"' && quoted && index + 1 < line.length && line[index + 1] == '"' -> {
                    value.append('"')
                    index++
                }
                character == '"' -> quoted = !quoted
                character == ',' && !quoted -> {
                    values.add(value.toString())
                    value.clear()
                }
                else -> value.append(character)
            }
            index++
        }
        values.add(value.toString())
        return values
    }


    suspend fun calculateOrderCOGS(orderId: Int): Double {
        val items = dao.getOrderItems(orderId)
        val ingredients = dao.getAllIngredients().firstOrNull() ?: emptyList()
        val ingredientMap = ingredients.associateBy { it.id }
        var totalCOGS = 0.0
        items.forEach { item ->
            val recipeItems = dao.getProductIngredients(item.productId)
            val itemCOGS = recipeItems.sumOf { recipe ->
                ingredientMap[recipe.ingredientId]?.costPerUnit?.times(recipe.quantity) ?: 0.0
            }
            totalCOGS += itemCOGS * item.quantity
        }
        return totalCOGS
    }

    suspend fun calculateOrderProfit(orderId: Int): Double {
        val order = dao.getOrderById(orderId) ?: return 0.0
        return order.totalAmount - calculateOrderCOGS(orderId)
    }

    suspend fun calculatePeriodMetrics(orders: List<Order>, periodStart: Long? = null, periodEnd: Long? = null): PeriodMetrics {
        val totalRevenue = orders.sumOf { it.totalAmount }
        val totalCOGS = orders.sumOf { calculateOrderCOGS(it.id) }
        val expenseStart = periodStart ?: orders.minOfOrNull { it.createdAt } ?: 0L
        val expenseEnd = periodEnd ?: orders.maxOfOrNull { it.createdAt } ?: System.currentTimeMillis()
        val expenses = dao.getAllExpenses().firstOrNull()?.filter { it.createdAt in expenseStart..expenseEnd }?.sumOf { it.amount } ?: 0.0
        val grossProfit = totalRevenue - totalCOGS
        return PeriodMetrics(totalRevenue, totalCOGS, expenses, grossProfit, grossProfit - expenses)
    }

    suspend fun calculateProductProfitability(orders: List<Order>): List<ProductProfitInfo> {
        val products = dao.getAllProducts().firstOrNull()?.associateBy { it.id } ?: emptyMap()
        val ingredients = dao.getAllIngredients().firstOrNull()?.associateBy { it.id } ?: emptyMap()
        val totals = mutableMapOf<Int, ProductProfitInfo>()
        orders.forEach { order ->
            dao.getOrderItems(order.id).forEach { item ->
                val product = products[item.productId] ?: return@forEach
                val recipeCost = dao.getProductIngredients(item.productId).sumOf { recipe ->
                    ingredients[recipe.ingredientId]?.costPerUnit?.times(recipe.quantity) ?: 0.0
                }
                val unitCost = if (recipeCost > 0.0) recipeCost else product.capitalCost
                val cost = unitCost * item.quantity
                val current = totals[item.productId]
                totals[item.productId] = if (current == null) {
                    ProductProfitInfo(product.name, item.quantity, item.subtotal, cost, unitCost = unitCost)
                } else {
                    current.copy(quantity = current.quantity + item.quantity, revenue = current.revenue + item.subtotal, cogs = current.cogs + cost)
                }
            }
        }
        return totals.values.map { info ->
            val profit = info.revenue - info.cogs
            info.copy(profit = profit, marginPercent = if (info.revenue > 0.0) profit / info.revenue * 100.0 else 0.0)
        }.sortedByDescending { it.profit }
    }

    suspend fun calculateIngredientSpend(orders: List<Order>): List<IngredientSpendInfo> {
        val ingredients = dao.getAllIngredients().firstOrNull()?.associateBy { it.id } ?: emptyMap()
        val spend = mutableMapOf<Int, Double>()
        orders.forEach { order ->
            dao.getOrderItems(order.id).forEach { item ->
                dao.getProductIngredients(item.productId).forEach { recipe ->
                    spend[recipe.ingredientId] = (spend[recipe.ingredientId] ?: 0.0) +
                        (ingredients[recipe.ingredientId]?.costPerUnit ?: 0.0) * recipe.quantity * item.quantity
                }
            }
        }
        return spend.mapNotNull { (ingredientId, amount) ->
            ingredients[ingredientId]?.let { IngredientSpendInfo(it.name, amount, it.baseUnit) }
        }.sortedByDescending { it.amount }
    }

    suspend fun calculateIngredientSpendTrend(orders: List<Order>): List<IngredientSpendTrendPoint> {
        return orders.groupBy { order ->
            Calendar.getInstance().apply {
                timeInMillis = order.createdAt
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
        }.toSortedMap().map { (day, dayOrders) ->
            IngredientSpendTrendPoint(day, calculateIngredientSpend(dayOrders).sumOf { it.amount })
        }
    }

    suspend fun getPeakHour(orders: List<Order>): Pair<String, Int>? {
        if (orders.isEmpty()) return null
        val hourCounts = orders.groupingBy { order ->
            Calendar.getInstance().apply { timeInMillis = order.createdAt }.get(Calendar.HOUR_OF_DAY)
        }.eachCount()
        val peak = hourCounts.maxByOrNull { it.value } ?: return null
        return "${String.format("%02d", peak.key)}:00" to peak.value
    }

    suspend fun getPeakProduct(orders: List<Order>): Pair<String, Double>? {
        if (orders.isEmpty()) return null
        val products = dao.getAllProducts().firstOrNull()?.associateBy { it.id } ?: emptyMap()
        val sales = orders.flatMap { dao.getOrderItems(it.id) }.groupBy { it.productId }
            .mapValues { (_, items) -> items.sumOf { it.subtotal } }
        val peak = sales.maxByOrNull { it.value } ?: return null
        return (products[peak.key]?.name ?: "Unknown") to peak.value
    }
}

private const val orderHistoryCsvHeader = "orderNumber,customerName,status,totalAmount,discountAmount,discountRate,discountReason,paymentMethod,orderType,tableId,createdAt"
private const val ingredientCsvHeader = "name,category,baseUnit,currentStock,minStock,costPerUnit"

/** Compact decimal rendering for audit-detail text (no locale grouping). */
private fun trimNumber(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString() else "%.2f".format(value)

@Serializable
data class ExportData(
    val version: Int,
    val shopId: String,
    val exportedAt: Long,
    val categories: List<Category>,
    val products: List<Product>,
    val orders: List<Order>,
    val orderItems: List<ExportedOrderItem>,
    val ingredients: List<Ingredient>,
    val payments: List<Payment>,
    val customers: List<Customer>,
    val suppliers: List<Supplier>,
    val tables: List<CafeTable>,
    val stations: List<Station>,
    val optionGroups: List<OptionGroup>,
    val productOptionGroups: List<ExportedProductOptionGroup>,
    val options: List<ExportedOption>,
    val expenses: List<Expense>,
    val expenseCategories: List<ExpenseCategory> = emptyList(),
    val businessSettings: BusinessSettings? = null,
    val staff: List<Staff> = emptyList(),
    val loyaltyVouchers: List<LoyaltyVoucher> = emptyList(),
    val reviews: List<Review> = emptyList(),
    val orderMessages: List<OrderMessage> = emptyList(),
    val auditEvents: List<AuditEvent> = emptyList(),
    val leaveTypes: List<LeaveType> = emptyList(),
    val leaveRequests: List<LeaveRequest> = emptyList(),
    val schedules: List<Schedule> = emptyList(),
    val payrolls: List<Payroll> = emptyList(),
    val staffDocuments: List<StaffDocument> = emptyList(),
    val staffTrainings: List<StaffTraining> = emptyList(),
    val performanceReviews: List<PerformanceReview> = emptyList(),
    val attendance: List<Attendance> = emptyList(),
    val productOptions: List<ProductOption> = emptyList(),
    val tableSessions: List<TableSession> = emptyList(),
    val loyaltyCards: List<LoyaltyCard> = emptyList(),
    val loyaltyTransactions: List<LoyaltyTransaction> = emptyList(),
    val loyaltySettings: List<LoyaltySetting> = emptyList(),
    val aiConversations: List<AIConversation> = emptyList(),
    val aiMessages: List<AIMessage> = emptyList(),
    val guests: List<Guest> = emptyList(),
    val tableSections: List<TableSection> = emptyList(),
    val productStations: List<ProductStation> = emptyList(),
    val productIngredients: List<ProductIngredient> = emptyList(),
    val ingredientTransactions: List<IngredientTransaction> = emptyList(),
    val supplierIngredientPrices: List<SupplierIngredientPrice> = emptyList()
)

@Serializable
data class ExportedOrderItem(
    val orderId: Int,
    val productId: Int,
    val productName: String,
    val quantity: Int,
    val unitPrice: Double,
    val subtotal: Double,
    val options: List<OptionExport> = emptyList()
)

@Serializable
data class ExportedProductOptionGroup(
    val id: Int,
    val productId: Int,
    val groupId: Int
)

@Serializable
data class ExportedOption(
    val id: Int,
    val groupId: Int,
    val name: String,
    val priceDelta: Double,
    val sortOrder: Int,
    // Ingredient link: choosing this option consumes `ingredientQuantity` of
    // `ingredientId`. Null = the option only adds price, no stock movement.
    val ingredientId: Int? = null,
    val ingredientQuantity: Double = 0.0
)

@Serializable
data class OptionExport(
    val name: String,
    val value: String
)

data class CartItem(
    val product: Product,
    var quantity: Int,
    val selectedOptions: List<Pair<String, String>> = emptyList(),
    val priceDelta: Double = 0.0
)

data class PeriodMetrics(
    val totalRevenue: Double,
    val totalCOGS: Double,
    val totalExpenses: Double,
    val grossProfit: Double,
    val netProfit: Double
)

data class ProductProfitInfo(
    val name: String,
    val quantity: Int,
    val revenue: Double,
    val cogs: Double,
    val unitCost: Double = 0.0,
    val profit: Double = 0.0,
    val marginPercent: Double = 0.0
)

data class IngredientSpendInfo(
    val name: String,
    val amount: Double,
    val unit: String
)

data class IngredientSpendTrendPoint(
    val day: Long,
    val amount: Double
)

data class ProductCapacityInfo(
    val productName: String,
    val producibleUnits: Int,
    val limitingIngredient: String
)
