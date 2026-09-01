package com.cafeos.tablet.ui

import android.app.Application
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.Settings
import androidx.compose.runtime.mutableStateListOf
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cafeos.tablet.data.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
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
    private val syncManager = SocketSyncManager(application)
    val receiptPrinter = ReceiptPrinter(application)

    val isConnectedToSync: StateFlow<Boolean> = syncManager.isConnected
    val orderSyncEvent: StateFlow<OrderSyncEvent?> = syncManager.orderUpdates
    val inventorySyncEvent: StateFlow<InventorySyncEvent?> = syncManager.inventoryUpdates

    fun initializeSync(serverUrl: String) {
        syncManager.connect(serverUrl)
    }

    fun disconnectSync() {
        syncManager.disconnect()
    }

    fun clearOrderSyncEvent() { syncManager.clearOrderUpdate() }
    fun clearInventorySyncEvent() { syncManager.clearInventoryUpdate() }

    fun requestFullSync() {
        syncManager.requestFullSync()
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
    }

    fun setPaymentMethod(method: String) {
        _paymentMethod.value = method
    }

    fun setAmountTendered(amount: String) {
        _amountTendered.value = amount
    }

    fun setSelectedTableId(id: Int?) {
        _selectedTableId.value = id
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
        when (type) {
            "PWD" -> _discountRate.value = 0.20
            "STUDENT" -> _discountRate.value = 0.20
            "VOUCHER" -> _discountRate.value = 0.0
            else -> _discountRate.value = 0.0
        }
        calculateTotals()
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
            val total = _finalTotal.value
            val subtotal = _subtotalAmount.value
            val nextReceipt = getNextReceiptNumber()
            val order = Order(
                orderNumber = nextReceipt,
                customerName = _customerName.value.ifBlank { "Walk-in Customer" },
                status = "PENDING",
                totalAmount = total,
                discountAmount = subtotal - total,
                discountRate = _discountRate.value,
                 discountReason = when (_discountType.value) {
                    "PWD" -> "PWD_DISCOUNT"
                    "STUDENT" -> "STUDENT_DISCOUNT"
                    "VOUCHER" -> _selectedVoucher.value?.code
                    else -> null
                },
                paymentMethod = _paymentMethod.value,
                orderType = _orderType.value,
                tableId = _selectedTableId.value,
                barcodeValue = nextReceipt
            )
            val orderId = dao.insertOrder(order).toInt()

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
                    OrderOption(
                        orderItemId = orderItemId,
                        name = name,
                        value = value,
                        priceDelta = 0.0
                    )
                }
                dao.insertOrderOptions(options)
                orderItem
            }

            val tendered = _amountTendered.value.toDoubleOrNull() ?: total
            val change = (tendered - total).coerceAtLeast(0.0)
            dao.insertPayment(
                Payment(
                    orderId = orderId,
                    method = _paymentMethod.value,
                    amountTendered = tendered,
                    change = change,
                    screenshotPath = _screenshotPath.value
                )
            )

            _placedOrder.value = order
            syncManager.handleOrderPlaced(order)
            _cartItems.clear()
            _totalAmount.value = 0.0
            _subtotalAmount.value = 0.0
            _finalTotal.value = 0.0
            _customerName.value = ""
            _amountTendered.value = ""
            _showCheckout.value = false
            _paymentMethod.value = "CASH"
            _orderType.value = "DINE_IN"
             _discountType.value = "NONE"
            _selectedVoucher.value = null
            _discountRate.value = 0.0
            _selectedTableId.value = null
            _screenshotPath.value = null
        }
    }

    fun updateOrderStatus(orderId: Int, newStatus: String) {
        viewModelScope.launch {
            val order = dao.getOrderById(orderId)
            order?.let {
                dao.updateOrder(it.copy(status = newStatus))
                syncManager.handleOrderPlaced(it.copy(status = newStatus))
            }
        }
    }

    suspend fun getOrderById(orderId: Int) = dao.getOrderById(orderId)

    suspend fun getOrderItemsSync(orderId: Int): List<OrderItem> = dao.getOrderItems(orderId)

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

    fun deleteProduct(product: Product) {
        viewModelScope.launch {
            dao.deleteProduct(product)
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
    }

    suspend fun getNextReceiptNumber(): String {
        val settings = dao.getBusinessSettingsSync() ?: BusinessSettings()
        val lastNum = dao.getLastReceiptNumber()
        val next = lastNum + 1
        dao.updateLastReceiptNumber(next)
        return "${settings.receiptPrefix}-${next.toString().padStart(6, '0')}"
    }

    suspend fun purchaseIngredient(ingredientId: Int, quantity: Double, unitCost: Double, supplierId: Int? = null, notes: String? = null) {
        val ingredient = dao.getIngredientSync(ingredientId) ?: return
        val newStock = ingredient.currentStock + quantity
        dao.updateIngredient(ingredient.copy(currentStock = newStock, costPerUnit = unitCost))
        dao.insertIngredientTransaction(
            IngredientTransaction(
                ingredientId = ingredientId,
                type = "PURCHASE",
                quantity = quantity,
                notes = notes,
                createdAt = System.currentTimeMillis()
            )
        )
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

    suspend fun saveSupplier(supplier: Supplier) {
        if (supplier.id == 0) dao.insertSupplier(supplier) else dao.updateSupplier(supplier)
    }

    suspend fun deleteSupplier(supplier: Supplier) = dao.deleteSupplier(supplier)

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
        if (staff.id == 0) dao.insertStaff(staff) else dao.updateStaff(staff)
    }

    suspend fun deleteStaff(staff: Staff) = dao.deleteStaff(staff)

    suspend fun authenticateStaff(pin: String): Staff? {
        val staff = dao.getStaffByPin(pin)
        if (staff != null && staff.active) {
            return staff
        }
        // Master setup PIN fallback: Create Admin if 123456 is used but not found
        if (pin == "123456") {
            val admin = Staff(
                id = 0,
                name = "Admin",
                pin = "123456",
                role = "ADMIN",
                active = true
            )
            dao.insertStaff(admin)
            return admin
        }
        return null
    }

    fun saveVoucher(voucher: LoyaltyVoucher) {
        viewModelScope.launch {
            if (voucher.id == 0) dao.insertVoucher(voucher) else dao.updateVoucher(voucher)
        }
    }

    suspend fun deleteVoucher(voucher: LoyaltyVoucher) = dao.deleteVoucher(voucher)

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
                        pagibig: Double = 0.0, tax: Double = 0.0, deductions: Double = 0.0) {
        viewModelScope.launch {
            val totalDeductions = sss + philhealth + pagibig + tax + deductions
            val netPay = baseSalary + overtimePay - totalDeductions
            dao.insertPayroll(
                Payroll(
                    staffId = staffId, periodStart = periodStart, periodEnd = periodEnd,
                    baseSalary = baseSalary, overtimePay = overtimePay, deductions = deductions,
                    sss = sss, philhealth = philhealth, pagibig = pagibig, tax = tax,
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

    fun addOrderMessage(orderId: Int, text: String, senderType: String = "STAFF", senderName: String? = null) {
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

                    for (category in data.categories) {
                        dao.insertCategory(category)
                        importedCount++
                    }
                    for (product in data.products) {
                        dao.insertProduct(product)
                        importedCount++
                    }
                    for (order in data.orders) {
                        val existing = dao.getOrderById(order.id)
                        if (existing == null) {
                            dao.insertOrder(order)
                            importedCount++
                        } else {
                            skippedCount++
                        }
                    }
                    for (item in data.orderItems) {
                        val order = dao.getOrderById(item.orderId)
                        if (order != null) {
                            val product = dao.getAllProducts().firstOrNull()?.find { it.id == item.productId }
                            if (product != null) {
                                val orderItem = OrderItem(orderId = item.orderId, productId = item.productId, quantity = item.quantity, unitPrice = item.unitPrice, subtotal = item.subtotal)
                                val itemId = dao.insertOrderItem(orderItem).toInt()
                                val options = item.options.map { OptionExport(it.name, it.value) }
                                dao.insertOrderOptions(options.map { OrderOption(orderItemId = itemId, name = it.name, value = it.value) })
                            }
                        }
                    }
                    for (ingredient in data.ingredients) {
                        dao.insertIngredient(ingredient)
                        importedCount++
                    }
                    for (payment in data.payments) {
                        dao.insertPayment(payment)
                        importedCount++
                    }
                    for (customer in data.customers) {
                        dao.insertCustomer(customer)
                        importedCount++
                    }
                    for (supplier in data.suppliers) {
                        dao.insertSupplier(supplier)
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
                        dao.insertOption(Option(id = option.id, groupId = option.groupId, name = option.name, priceDelta = option.priceDelta, sortOrder = option.sortOrder))
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
                        dao.insertStaff(staff)
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
                        dao.insertOrderMessage(message)
                        importedCount++
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
                 }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return ImportResult(imported = importedCount, skipped = skippedCount)
    }

    data class ImportResult(val imported: Int = 0, val skipped: Int = 0)

    suspend fun exportAllData(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd_HHmmss", Locale.getDefault())
        val timestamp = sdf.format(Date())
        val fileName = "Pebot_Export_$timestamp.json"

        val categories = dao.getAllCategories().firstOrNull() ?: emptyList()
        val products = dao.getAllProducts().firstOrNull() ?: emptyList()
        val orders = dao.getAllOrders().firstOrNull() ?: emptyList()
        val ingredients = dao.getAllIngredients().firstOrNull() ?: emptyList()
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
            dao.getOptionsByGroup(group.id).map { opt -> ExportedOption(opt.id, opt.groupId, opt.name, opt.priceDelta, opt.sortOrder) }
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
}

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
    val sortOrder: Int
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
