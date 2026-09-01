package com.cafeos.tablet.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface CafeDao {
    // Categories
    @Query("SELECT * FROM Category ORDER BY sortOrder ASC")
    fun getAllCategories(): Flow<List<Category>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategory(category: Category)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategories(categories: List<Category>)

    @Update
    suspend fun updateCategory(category: Category)

    @Delete
    suspend fun deleteCategory(category: Category)

    // Products
    @Query("SELECT * FROM Product WHERE categoryId = :categoryId AND available = 1")
    fun getProductsByCategory(categoryId: Int): Flow<List<Product>>

    @Query("SELECT * FROM Product ORDER BY name ASC")
    fun getAllProducts(): Flow<List<Product>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProduct(product: Product)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProducts(products: List<Product>)

    @Update
    suspend fun updateProduct(product: Product)

    @Delete
    suspend fun deleteProduct(product: Product)

    // Product Ingredients (Recipes)
    @Query("SELECT * FROM ProductIngredient WHERE productId = :productId")
    suspend fun getProductIngredients(productId: Int): List<ProductIngredient>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProductIngredient(productIngredient: ProductIngredient)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProductIngredients(productIngredients: List<ProductIngredient>)

    @Delete
    suspend fun deleteProductIngredient(productIngredient: ProductIngredient)

    @Query("DELETE FROM ProductIngredient WHERE productId = :productId")
    suspend fun deleteProductIngredientsByProduct(productId: Int)

    // Option Groups
    @Query("SELECT * FROM OptionGroup ORDER BY sortOrder ASC")
    fun getAllOptionGroups(): Flow<List<OptionGroup>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOptionGroup(optionGroup: OptionGroup)

    @Update
    suspend fun updateOptionGroup(optionGroup: OptionGroup)

    @Delete
    suspend fun deleteOptionGroup(optionGroup: OptionGroup)

    // Product Option Groups
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProductOptionGroup(productOptionGroup: ProductOptionGroup)

    @Query("SELECT * FROM ProductOptionGroup WHERE productId = :productId")
    suspend fun getProductOptionGroups(productId: Int): List<ProductOptionGroup>

    @Query("DELETE FROM ProductOptionGroup WHERE productId = :productId")
    suspend fun deleteProductOptionGroupsByProduct(productId: Int)

    // Options
    @Query("SELECT * FROM Option ORDER BY groupId ASC, sortOrder ASC")
    fun getAllOptions(): Flow<List<Option>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOption(option: Option)

    @Update
    suspend fun updateOption(option: Option)

    @Delete
    suspend fun deleteOption(option: Option)

    @Query("SELECT * FROM Option WHERE groupId = :groupId ORDER BY sortOrder ASC")
    suspend fun getOptionsByGroup(groupId: Int): List<Option>

    // Orders
    @Insert
    suspend fun insertOrder(order: Order): Long

    @Insert
    suspend fun insertOrderItem(item: OrderItem): Long

    @Insert
    suspend fun insertOrderItems(items: List<OrderItem>)

    @Transaction
    @Query("SELECT * FROM Orders ORDER BY createdAt DESC")
    fun getAllOrders(): Flow<List<Order>>

    @Query("SELECT * FROM Orders WHERE id = :orderId")
    suspend fun getOrderById(orderId: Int): Order?

    @Update
    suspend fun updateOrder(order: Order)

    @Query("SELECT * FROM OrderItem WHERE orderId = :orderId")
    suspend fun getOrderItems(orderId: Int): List<OrderItem>

    @Query("SELECT * FROM OrderOption WHERE orderItemId = :orderItemId")
    suspend fun getOrderOptions(orderItemId: Int): List<OrderOption>

    @Query("SELECT * FROM Orders WHERE createdAt >= :since")
    fun getOrdersSince(since: Long): Flow<List<Order>>

    // Order Options
    @Insert
    suspend fun insertOrderOption(option: OrderOption)

    @Insert
    suspend fun insertOrderOptions(options: List<OrderOption>)

    // Payments
    @Insert
    suspend fun insertPayment(payment: Payment): Long

    @Query("SELECT * FROM Payment WHERE orderId = :orderId")
    suspend fun getPaymentsForOrder(orderId: Int): List<Payment>

    @Query("SELECT * FROM Payment ORDER BY createdAt DESC")
    fun getAllPayments(): Flow<List<Payment>>

    // Inventory
    @Query("SELECT * FROM Ingredient ORDER BY name ASC")
    fun getAllIngredients(): Flow<List<Ingredient>>

    @Query("SELECT * FROM Ingredient WHERE id = :id")
    suspend fun getIngredientSync(id: Int): Ingredient?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertIngredient(ingredient: Ingredient)

    @Update
    suspend fun updateIngredient(ingredient: Ingredient)

    @Delete
    suspend fun deleteIngredient(ingredient: Ingredient)

    @Insert
    suspend fun insertIngredientTransaction(transaction: IngredientTransaction)

    @Insert
    suspend fun insertIngredientTransactions(transactions: List<IngredientTransaction>)

    // Sync
    @Query("SELECT * FROM SyncMeta WHERE id = 1")
    suspend fun getSyncMeta(): SyncMeta?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSyncMeta(meta: SyncMeta)

    // Customers
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCustomer(customer: Customer)

    @Query("SELECT * FROM Customer ORDER BY name ASC")
    fun getAllCustomers(): Flow<List<Customer>>

    @Query("UPDATE Customer SET loyaltyPoints = :points WHERE id = :customerId")
    suspend fun updateCustomerPoints(customerId: Int, points: Int)

    // Suppliers
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSupplier(supplier: Supplier)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSuppliers(suppliers: List<Supplier>)

    @Query("SELECT * FROM Supplier ORDER BY name ASC")
    fun getAllSuppliers(): Flow<List<Supplier>>

    @Query("SELECT * FROM Supplier WHERE id = :id")
    suspend fun getSupplier(id: Int): Supplier?

    @Update
    suspend fun updateSupplier(supplier: Supplier)

    @Delete
    suspend fun deleteSupplier(supplier: Supplier)

    // Tables
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTable(table: CafeTable)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTables(tables: List<CafeTable>)

    @Query("SELECT * FROM CafeTable ORDER BY name ASC")
    fun getAllTables(): Flow<List<CafeTable>>

    @Query("SELECT * FROM CafeTable WHERE id = :id")
    suspend fun getTable(id: Int): CafeTable?

    @Update
    suspend fun updateTable(table: CafeTable)

    @Delete
    suspend fun deleteTable(table: CafeTable)

    // Stations
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStation(station: Station)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStations(stations: List<Station>)

    @Query("SELECT * FROM Station ORDER BY name ASC")
    fun getAllStations(): Flow<List<Station>>

    @Query("SELECT * FROM Station WHERE id = :id")
    suspend fun getStation(id: Int): Station?

    @Update
    suspend fun updateStation(station: Station)

    @Delete
    suspend fun deleteStation(station: Station)

    // Production Capacity
    @Query("SELECT i.id as ingredientId, i.name, i.currentStock, i.minStock, i.baseUnit, i.costPerUnit, SUM(pi.quantity) as totalDemand FROM Ingredient i LEFT JOIN ProductIngredient pi ON i.id = pi.ingredientId GROUP BY i.id")
    fun getProductionCapacity(): Flow<List<ProductionCapacity>>

    @Query("SELECT pi.productId, p.name as productName, SUM(pi.quantity) as totalQty FROM ProductIngredient pi JOIN Product p ON pi.productId = p.id GROUP BY pi.productId")
    fun getProductRecipeTotals(): Flow<List<ProductRecipeTotal>>

    // Analytics Extras
    @Query("SELECT SUM(totalAmount) FROM Orders WHERE createdAt >= :startOfDay")
    fun getDailySales(startOfDay: Long): Flow<Double?>

    @Query("SELECT productId, SUM(quantity) as totalQty FROM OrderItem GROUP BY productId ORDER BY totalQty DESC LIMIT 5")
    fun getTopSellingProducts(): Flow<List<ProductSales>>

    @Query("SELECT COUNT(*) FROM Orders WHERE createdAt >= :startOfDay")
    fun getOrderCount(startOfDay: Long): Flow<Int>

    @Query("SELECT AVG(totalAmount) FROM Orders WHERE createdAt >= :startOfDay")
    fun getAverageOrderValue(startOfDay: Long): Flow<Double>

    @Query("SELECT paymentMethod, SUM(totalAmount) as total FROM Orders WHERE createdAt >= :startOfDay GROUP BY paymentMethod")
    fun getSalesByPaymentMethod(startOfDay: Long): Flow<List<PaymentMethodSales>>

    @Query("SELECT c.name, SUM(oi.quantity * oi.unitPrice) as total FROM OrderItem oi JOIN Product p ON oi.productId = p.id JOIN Category c ON p.categoryId = c.id JOIN Orders o ON oi.orderId = o.id WHERE o.createdAt >= :startOfDay GROUP BY c.id ORDER BY total DESC")
    fun getSalesByCategory(startOfDay: Long): Flow<List<CategorySales>>

    @Query("SELECT * FROM Product WHERE name LIKE '%' || :query || '%' ESCAPE '\\' ORDER BY name ASC")
    fun searchProducts(query: String): Flow<List<Product>>

    // Inventory Transactions
    @Query("SELECT * FROM IngredientTransaction WHERE ingredientId = :ingredientId ORDER BY createdAt DESC")
    fun getTransactionsForIngredient(ingredientId: Int): Flow<List<IngredientTransaction>>

    @Query("SELECT * FROM IngredientTransaction WHERE type = 'PURCHASE' ORDER BY createdAt DESC")
    fun getAllPurchases(): Flow<List<IngredientTransaction>>

    @Query("SELECT * FROM IngredientTransaction ORDER BY createdAt DESC")
    fun getAllTransactions(): Flow<List<IngredientTransaction>>

    // Expenses
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: Expense)

    @Query("SELECT * FROM Expense ORDER BY createdAt DESC")
    fun getAllExpenses(): Flow<List<Expense>>

    @Query("SELECT * FROM Expense WHERE :start <= createdAt AND createdAt <= :end ORDER BY createdAt DESC")
    fun getExpensesByDateRange(start: Long, end: Long): Flow<List<Expense>>

    @Query("SELECT category, SUM(amount) as total FROM Expense WHERE createdAt >= :startOfDay GROUP BY category")
    fun getExpenseByCategory(startOfDay: Long): Flow<List<ExpenseCategoryTotal>>

    @Update
    suspend fun updateExpense(expense: Expense)

    @Delete
    suspend fun deleteExpense(expense: Expense)

    // Order Status Update
    @Query("UPDATE Orders SET status = :status WHERE id = :orderId")
    suspend fun updateOrderStatus(orderId: Int, status: String)

    // BIR Receipt Numbering
    @Query("SELECT lastReceiptNumber FROM BusinessSettings WHERE id = 1")
    suspend fun getLastReceiptNumber(): Int

    @Query("UPDATE BusinessSettings SET lastReceiptNumber = :number WHERE id = 1")
    suspend fun updateLastReceiptNumber(number: Int)

    // Business Settings
    @Query("SELECT * FROM BusinessSettings WHERE id = 1")
    fun getBusinessSettings(): Flow<BusinessSettings?>

    @Query("SELECT * FROM BusinessSettings WHERE id = 1")
    suspend fun getBusinessSettingsSync(): BusinessSettings?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertBusinessSettings(settings: BusinessSettings)

    // Staff
    @Query("SELECT * FROM Staff ORDER BY name ASC")
    fun getAllStaff(): Flow<List<Staff>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStaff(staff: Staff)

    @Update
    suspend fun updateStaff(staff: Staff)

    @Delete
    suspend fun deleteStaff(staff: Staff)

    @Query("SELECT * FROM Staff WHERE pin = :pin LIMIT 1")
    suspend fun getStaffByPin(pin: String): Staff?

    @Query("SELECT COUNT(*) FROM Staff")
    suspend fun getAllStaffCount(): Int

    // Loyalty Vouchers
    @Query("SELECT * FROM Staff ORDER BY name ASC")
    suspend fun getAllStaffNow(): List<Staff>

    @Query("SELECT * FROM LoyaltyVoucher WHERE active = 1 AND endDate >= :now ORDER BY createdAt DESC")
    fun getActiveVouchers(now: Long = System.currentTimeMillis()): Flow<List<LoyaltyVoucher>>

    @Query("SELECT * FROM LoyaltyVoucher WHERE active = 1 AND endDate >= :now ORDER BY createdAt DESC")
    suspend fun getActiveVouchersNow(now: Long = System.currentTimeMillis()): List<LoyaltyVoucher>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVoucher(voucher: LoyaltyVoucher)

    @Update
    suspend fun updateVoucher(voucher: LoyaltyVoucher)

    @Delete
    suspend fun deleteVoucher(voucher: LoyaltyVoucher)

    // Order Messages
    @Query("SELECT * FROM OrderMessage WHERE orderId = :orderId ORDER BY createdAt ASC")
    suspend fun getOrderMessages(orderId: Int): List<OrderMessage>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrderMessage(message: OrderMessage): Long

    @Query("UPDATE OrderMessage SET isRead = 1 WHERE orderId = :orderId AND isRead = 0")
    suspend fun markMessagesRead(orderId: Int)

    // Reviews
    @Query("SELECT * FROM Review ORDER BY createdAt DESC")
    fun getAllReviews(): Flow<List<Review>>

    @Query("SELECT * FROM Review WHERE productId = :productId ORDER BY createdAt DESC")
    suspend fun getReviewsByProduct(productId: Int): List<Review>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReview(review: Review)

    @Delete
    suspend fun deleteReview(review: Review)

    // Expense Categories
    @Query("SELECT * FROM ExpenseCategory ORDER BY name ASC")
    fun getAllExpenseCategories(): Flow<List<ExpenseCategory>>

    @Query("SELECT * FROM ExpenseCategory ORDER BY name ASC")
    suspend fun getAllExpenseCategoriesNow(): List<ExpenseCategory>

    @Query("SELECT * FROM Review ORDER BY createdAt DESC")
    suspend fun getAllReviewsNow(): List<Review>

    @Query("SELECT * FROM AuditEvent ORDER BY createdAt DESC")
    suspend fun getAllAuditEventsNow(): List<AuditEvent>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpenseCategory(category: ExpenseCategory)

    @Update
    suspend fun updateExpenseCategory(category: ExpenseCategory)

    @Delete
    suspend fun deleteExpenseCategory(category: ExpenseCategory)

    // Audit Events (append-only: INSERT only, no UPDATE/DELETE)
    @Query("SELECT * FROM AuditEvent ORDER BY createdAt DESC LIMIT 100")
    fun getRecentAuditEvents(): Flow<List<AuditEvent>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAuditEvent(event: AuditEvent)

    @Query("SELECT COUNT(*) FROM AuditEvent")
    suspend fun getAuditEventCount(): Int

    // Attendance
    @Query("SELECT * FROM Attendance WHERE date >= :start AND date <= :end ORDER BY date DESC")
    suspend fun getAttendanceRange(start: Long, end: Long): List<Attendance>

    @Query("SELECT * FROM Attendance WHERE staffId = :staffId AND date >= :start AND date <= :end ORDER BY date DESC")
    suspend fun getStaffAttendanceRange(staffId: Int, start: Long, end: Long): List<Attendance>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendance(attendance: Attendance)

    @Update
    suspend fun updateAttendance(attendance: Attendance)

    @Query("UPDATE Attendance SET clockOut = :clockOut, breakStart = :breakStart, breakEnd = :breakEnd WHERE id = :id")
    suspend fun updateAttendanceClockOut(id: Int, clockOut: Long, breakStart: Long?, breakEnd: Long?)

    // Leave Types
    @Query("SELECT * FROM LeaveType ORDER BY name ASC")
    fun getAllLeaveTypes(): Flow<List<LeaveType>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLeaveType(leaveType: LeaveType)

    @Update
    suspend fun updateLeaveType(leaveType: LeaveType)

    @Delete
    suspend fun deleteLeaveType(leaveType: LeaveType)

    // Leave Requests
    @Query("SELECT * FROM LeaveRequest WHERE status = 'PENDING' ORDER BY createdAt DESC")
    fun getPendingLeaveRequests(): Flow<List<LeaveRequest>>

    @Query("SELECT * FROM LeaveRequest WHERE staffId = :staffId ORDER BY createdAt DESC")
    suspend fun getStaffLeaveRequests(staffId: Int): List<LeaveRequest>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLeaveRequest(request: LeaveRequest)

    @Update
    suspend fun updateLeaveRequest(request: LeaveRequest)

    @Query("SELECT * FROM LeaveRequest ORDER BY createdAt DESC LIMIT 100")
    suspend fun getAllLeaveRequestsNow(): List<LeaveRequest>

    // Schedules
    @Query("SELECT * FROM Schedule WHERE staffId = :staffId ORDER BY dayOfWeek ASC")
    suspend fun getStaffSchedules(staffId: Int): List<Schedule>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSchedule(schedule: Schedule)

    @Update
    suspend fun updateSchedule(schedule: Schedule)

    @Delete
    suspend fun deleteSchedule(schedule: Schedule)

    @Query("SELECT * FROM Schedule ORDER BY staffId, dayOfWeek ASC")
    suspend fun getAllSchedulesNow(): List<Schedule>

    // Payroll
    @Query("SELECT * FROM Payroll WHERE status = 'PENDING' ORDER BY createdAt DESC")
    fun getPendingPayrolls(): Flow<List<Payroll>>

    @Query("SELECT * FROM Payroll WHERE staffId = :staffId ORDER BY createdAt DESC")
    suspend fun getStaffPayrolls(staffId: Int): List<Payroll>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayroll(payroll: Payroll)

    @Update
    suspend fun updatePayroll(payroll: Payroll)

    @Query("SELECT * FROM Payroll ORDER BY createdAt DESC")
    suspend fun getAllPayrollsNow(): List<Payroll>

    // Staff Documents
    @Query("SELECT * FROM StaffDocument WHERE staffId = :staffId ORDER BY uploadedAt DESC")
    suspend fun getStaffDocuments(staffId: Int): List<StaffDocument>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStaffDocument(document: StaffDocument)

    @Delete
    suspend fun deleteStaffDocument(document: StaffDocument)

    @Query("SELECT * FROM StaffDocument ORDER BY uploadedAt DESC")
    suspend fun getAllStaffDocumentsNow(): List<StaffDocument>

    // Staff Training
    @Query("SELECT * FROM StaffTraining WHERE staffId = :staffId ORDER BY createdAt DESC")
    suspend fun getStaffTrainings(staffId: Int): List<StaffTraining>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStaffTraining(training: StaffTraining)

    @Update
    suspend fun updateStaffTraining(training: StaffTraining)

    @Delete
    suspend fun deleteStaffTraining(training: StaffTraining)

    @Query("SELECT * FROM StaffTraining ORDER BY createdAt DESC")
    suspend fun getAllStaffTrainingsNow(): List<StaffTraining>

    // Performance Reviews
    @Query("SELECT * FROM PerformanceReview WHERE staffId = :staffId ORDER BY date DESC")
    suspend fun getStaffReviews(staffId: Int): List<PerformanceReview>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPerformanceReview(review: PerformanceReview)

    @Update
    suspend fun updatePerformanceReview(review: PerformanceReview)

    @Query("SELECT * FROM PerformanceReview ORDER BY date DESC LIMIT 100")
    suspend fun getAllPerformanceReviewsNow(): List<PerformanceReview>

    @Query("SELECT * FROM Attendance ORDER BY date DESC")
    suspend fun getAllAttendanceNow(): List<Attendance>

    @Query("SELECT * FROM LeaveType ORDER BY name ASC")
    suspend fun getAllLeaveTypesNow(): List<LeaveType>

    @Query("SELECT * FROM LeaveRequest ORDER BY createdAt DESC")
    suspend fun getAllLeaveRequestsNow(): List<LeaveRequest>

    @Query("SELECT * FROM Schedule ORDER BY staffId, dayOfWeek ASC")
    suspend fun getAllSchedulesNow(): List<Schedule>

    @Query("SELECT * FROM Payroll ORDER BY createdAt DESC")
    suspend fun getAllPayrollsNow(): List<Payroll>

    @Query("SELECT * FROM StaffDocument ORDER BY uploadedAt DESC")
    suspend fun getAllStaffDocumentsNow(): List<StaffDocument>

    @Query("SELECT * FROM StaffTraining ORDER BY createdAt DESC")
    suspend fun getAllStaffTrainingsNow(): List<StaffTraining>
}

data class ExpenseCategoryTotal(
    val category: String,
    val total: Double
)

data class ProductSales(
    val productId: Int,
    val totalQty: Int
)

data class ProductionCapacity(
    val ingredientId: Int,
    val name: String,
    val currentStock: Double,
    val minStock: Double,
    val baseUnit: String,
    val costPerUnit: Double,
    val totalDemand: Double?
)

data class ProductRecipeTotal(
    val productId: Int,
    val productName: String,
    val totalQty: Double
)

data class PaymentMethodSales(
    val paymentMethod: String,
    val total: Double
)

data class CategorySales(
    val name: String,
    val total: Double
)
