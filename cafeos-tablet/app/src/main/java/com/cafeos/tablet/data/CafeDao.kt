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
    suspend fun insertProduct(product: Product): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProducts(products: List<Product>): List<Long>

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

    @Query("DELETE FROM ProductIngredient WHERE productId = :productId")
    suspend fun clearProductIngredients(productId: Int)

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

    @Query("SELECT * FROM OptionGroup WHERE name = :name")
    suspend fun getOptionGroupsByName(name: String): List<OptionGroup>

    @Query("SELECT * FROM OptionGroup WHERE id = :groupId")
    suspend fun getOptionGroup(groupId: Int): OptionGroup?

    @Query("SELECT * FROM Option ORDER BY groupId ASC, sortOrder ASC")
    suspend fun getAllOptionsNow(): List<Option>

    @Query("SELECT name FROM OptionGroup WHERE id = :groupId")
    suspend fun getOptionGroupName(groupId: Int): String?

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
    suspend fun insertIngredientTransaction(transaction: IngredientTransaction): Long

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

    @Query("SELECT COALESCE(SUM(oi.quantity), 0) FROM OrderItem oi JOIN Orders o ON oi.orderId = o.id WHERE o.createdAt >= :start AND o.createdAt <= :end AND o.status != 'CANCELLED'")
    fun getProductUnitCount(start: Long, end: Long): Flow<Int>

    @Query("SELECT COALESCE(SUM(oi.quantity), 0) FROM OrderItem oi JOIN Orders o ON oi.orderId = o.id WHERE o.createdAt >= :start AND o.createdAt <= :end AND o.status != 'CANCELLED'")
    suspend fun getProductUnitCountNow(start: Long, end: Long): Int

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

    // Spec 014: full ledger of one ingredient in row-id (ledger) order for the
    // pure void-reversal decision (T026/T028) — latest/previous are computed by
    // VoidReversal over PURCHASE rows, never over VOID rows.
    @Query("SELECT * FROM IngredientTransaction WHERE ingredientId = :ingredientId ORDER BY id ASC")
    suspend fun getIngredientLedgerSync(ingredientId: Int): List<IngredientTransaction>

    // Spec 014: latest supplier (non-void purchase supplier link) for an ingredient.
    @Query("SELECT referenceId FROM IngredientTransaction WHERE ingredientId = :ingredientId AND type = 'PURCHASE' AND referenceType = 'supplier' AND referenceId IS NOT NULL ORDER BY id DESC LIMIT 1")
    suspend fun latestSupplierIdForIngredient(ingredientId: Int): Int?

    // Spec 014 (supplier-delete safety, T032): latest supplier from the remaining
    // non-void purchase history, EXCLUDING a specific (about-to-be-deleted)
    // supplier — so an ingredient falls back to its prior supplier or none,
    // never re-points at a removed id.
    @Query("SELECT referenceId FROM IngredientTransaction WHERE ingredientId = :ingredientId AND type = 'PURCHASE' AND referenceType = 'supplier' AND referenceId IS NOT NULL AND referenceId != :excludeSupplierId ORDER BY id DESC LIMIT 1")
    suspend fun latestSupplierIdForIngredientExcluding(ingredientId: Int, excludeSupplierId: Int): Int?

    // Spec 014: unit cost of the purchase immediately before :beforeId (row-id
    // order = ledger order) for trend math.
    @Query("SELECT unitCost FROM IngredientTransaction WHERE ingredientId = :ingredientId AND type = 'PURCHASE' AND id < :beforeId AND unitCost IS NOT NULL ORDER BY id DESC LIMIT 1")
    suspend fun previousPurchaseUnitCost(ingredientId: Int, beforeId: Int): Double?

    // Spec 014: all purchases from one supplier, ledger order (for the supplier page).
    @Query("SELECT * FROM IngredientTransaction WHERE type = 'PURCHASE' AND referenceType = 'supplier' AND referenceId = :supplierId ORDER BY id ASC")
    suspend fun purchasesForSupplier(supplierId: Int): List<IngredientTransaction>

    // Spec 014 void support: the newest PURCHASE row id for an ingredient.
    @Query("SELECT id FROM IngredientTransaction WHERE ingredientId = :ingredientId AND type = 'PURCHASE' ORDER BY id DESC LIMIT 1")
    suspend fun latestPurchaseRowId(ingredientId: Int): Int?

    // Spec 014 void support: supplier of the newest supplier-linked purchase BEFORE :beforeId.
    @Query("SELECT referenceId FROM IngredientTransaction WHERE ingredientId = :ingredientId AND type = 'PURCHASE' AND referenceType = 'supplier' AND referenceId IS NOT NULL AND id < :beforeId ORDER BY id DESC LIMIT 1")
    suspend fun previousPurchaseSupplierId(ingredientId: Int, beforeId: Int): Int?

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

    // Highest numeric suffix already used for a receipt prefix (e.g. "INV-000007"
    // under prefix "INV"). Used together with the counter so numbering never
    // collides with orders that exist but predate/outran the stored counter
    // (imports, restores, pre-counter builds).
    @Query("SELECT COALESCE(MAX(CAST(SUBSTR(orderNumber, :skipLen) AS INTEGER)), 0) FROM Orders WHERE orderNumber LIKE :likePattern")
    suspend fun getMaxReceiptSuffix(likePattern: String, skipLen: Int): Int

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

    @Query("SELECT COUNT(*) FROM Staff")
    suspend fun getAllStaffCount(): Int

    // Loyalty Vouchers
    @Query("SELECT * FROM Staff ORDER BY name ASC")
    suspend fun getAllStaffNow(): List<Staff>

    @Query("SELECT * FROM LoyaltyVoucher WHERE active = 1 AND endDate >= :now AND (usageLimit <= 0 OR usedCount < usageLimit) ORDER BY createdAt DESC")
    fun getActiveVouchers(now: Long = System.currentTimeMillis()): Flow<List<LoyaltyVoucher>>

    @Query("SELECT * FROM LoyaltyVoucher WHERE active = 1 AND endDate >= :now AND (usageLimit <= 0 OR usedCount < usageLimit) ORDER BY createdAt DESC")
    suspend fun getActiveVouchersNow(now: Long = System.currentTimeMillis()): List<LoyaltyVoucher>

    @Query("SELECT * FROM LoyaltyVoucher ORDER BY createdAt DESC")
    suspend fun getAllVouchersNow(): List<LoyaltyVoucher>

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

    // Product Options (product-specific option price deltas)
    @Query("SELECT * FROM ProductOption WHERE productId = :productId")
    suspend fun getProductOptions(productId: Int): List<ProductOption>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProductOption(option: ProductOption)

    @Update
    suspend fun updateProductOption(option: ProductOption)

    @Delete
    suspend fun deleteProductOption(option: ProductOption)

    @Query("DELETE FROM ProductOption WHERE productId = :productId")
    suspend fun deleteProductOptionsByProduct(productId: Int)

    @Query("SELECT * FROM ProductOption")
    suspend fun getAllProductOptionsNow(): List<ProductOption>

    @Query("SELECT * FROM ProductIngredient")
    suspend fun getAllProductIngredientsNow(): List<ProductIngredient>

    @Query("SELECT * FROM IngredientTransaction")
    suspend fun getAllIngredientTransactionsNow(): List<IngredientTransaction>

    // Table Sessions
    @Query("SELECT * FROM TableSession WHERE status = 'OCCUPIED' ORDER BY startedAt DESC")
    fun getActiveTableSessions(): Flow<List<TableSession>>

    @Query("SELECT * FROM TableSession WHERE tableId = :tableId ORDER BY startedAt DESC LIMIT 1")
    suspend fun getTableSessions(tableId: Int): List<TableSession>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTableSession(session: TableSession)

    @Update
    suspend fun updateTableSession(session: TableSession)

    @Query("UPDATE TableSession SET endedAt = :endedAt, status = 'CLOSED' WHERE id = :id")
    suspend fun closeTableSession(id: Int, endedAt: Long)

    @Query("SELECT * FROM TableSession ORDER BY startedAt DESC")
    suspend fun getAllTableSessionsNow(): List<TableSession>

    // Loyalty Cards
    @Query("SELECT * FROM LoyaltyCard WHERE id = :cardId LIMIT 1")
    suspend fun getLoyaltyCardById(cardId: Int): LoyaltyCard?

    @Query("SELECT * FROM LoyaltyCard ORDER BY cardNumber ASC")
    fun getAllLoyaltyCards(): Flow<List<LoyaltyCard>>

    @Query("SELECT * FROM LoyaltyCard WHERE customerId = :customerId")
    suspend fun getCardsByCustomer(customerId: Int): List<LoyaltyCard>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLoyaltyCard(card: LoyaltyCard)

    @Update
    suspend fun updateLoyaltyCard(card: LoyaltyCard)

    @Delete
    suspend fun deleteLoyaltyCard(card: LoyaltyCard)

    @Query("SELECT * FROM LoyaltyCard ORDER BY createdAt DESC")
    suspend fun getAllLoyaltyCardsNow(): List<LoyaltyCard>

    // Loyalty Transactions
    @Query("SELECT * FROM LoyaltyTransaction WHERE cardId = :cardId ORDER BY createdAt DESC")
    suspend fun getTransactionsByCard(cardId: Int): List<LoyaltyTransaction>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLoyaltyTransaction(transaction: LoyaltyTransaction)

    @Query("SELECT * FROM LoyaltyTransaction ORDER BY createdAt DESC")
    suspend fun getAllLoyaltyTransactionsNow(): List<LoyaltyTransaction>

    // Loyalty Settings (key-value store)
    @Query("SELECT value FROM LoyaltySetting WHERE key = :key AND scope = :scope LIMIT 1")
    suspend fun getLoyaltySetting(key: String, scope: String = "GLOBAL"): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLoyaltySetting(setting: LoyaltySetting)

    @Query("SELECT * FROM LoyaltySetting ORDER BY key ASC")
    suspend fun getAllLoyaltySettingsNow(): List<LoyaltySetting>

    @Query("SELECT * FROM LoyaltySetting ORDER BY key ASC")
    fun getAllLoyaltySettings(): Flow<List<LoyaltySetting>>

    @Delete
    suspend fun deleteLoyaltySetting(setting: LoyaltySetting)

    // AI Conversations
    @Query("SELECT * FROM AIConversation ORDER BY updatedAt DESC")
    fun getAllAIConversations(): Flow<List<AIConversation>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAIConversation(conversation: AIConversation): Long

    @Update
    suspend fun updateAIConversation(conversation: AIConversation)

    @Query("SELECT * FROM AIConversation ORDER BY createdAt DESC")
    suspend fun getAllAIConversationsNow(): List<AIConversation>

    // AI Messages
    @Query("SELECT * FROM AIMessage WHERE conversationId = :conversationId ORDER BY timestamp ASC")
    suspend fun getAIMessages(conversationId: Int): List<AIMessage>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAIMessage(message: AIMessage)

    @Query("SELECT * FROM AIMessage ORDER BY timestamp DESC")
    suspend fun getAllAIMessagesNow(): List<AIMessage>

    // Low Stock Alerts
    @Query("SELECT * FROM Ingredient WHERE currentStock <= minStock AND minStock > 0 ORDER BY name ASC")
    fun getLowStockIngredients(): Flow<List<Ingredient>>

    // Guests
    @Query("SELECT * FROM Guest WHERE tableSessionId = :tableSessionId ORDER BY joinedAt ASC")
    suspend fun getGuestsForSession(tableSessionId: Int): List<Guest>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGuest(guest: Guest)

    @Update
    suspend fun updateGuest(guest: Guest)

    @Query("UPDATE Guest SET leftAt = :leftAt WHERE id = :id")
    suspend fun markGuestLeft(id: Int, leftAt: Long)

    @Query("SELECT * FROM Guest ORDER BY joinedAt DESC")
    suspend fun getAllGuestsNow(): List<Guest>

    // Table Sections
    @Query("SELECT * FROM TableSection ORDER BY floorNumber ASC, name ASC")
    fun getAllTableSections(): Flow<List<TableSection>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTableSection(section: TableSection)

    @Update
    suspend fun updateTableSection(section: TableSection)

    @Delete
    suspend fun deleteTableSection(section: TableSection)

    @Query("SELECT * FROM TableSection ORDER BY floorNumber ASC, name ASC")
    suspend fun getAllTableSectionsNow(): List<TableSection>

    // Product Station routing
    @Query("SELECT * FROM ProductStation WHERE productId = :productId")
    suspend fun getProductStations(productId: Int): List<ProductStation>

    @Query("SELECT * FROM ProductStation WHERE stationId = :stationId")
    suspend fun getProductsForStation(stationId: Int): List<ProductStation>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProductStation(productStation: ProductStation)

    @Query("DELETE FROM ProductStation WHERE productId = :productId")
    suspend fun deleteProductStations(productId: Int)

    @Query("DELETE FROM ProductStation WHERE productId = :productId AND stationId = :stationId")
    suspend fun deleteProductStation(productId: Int, stationId: Int)

    @Query("SELECT * FROM ProductStation")
    suspend fun getAllProductStationsNow(): List<ProductStation>

    // Supplier Ingredient Prices
    @Query("SELECT * FROM SupplierIngredientPrice WHERE ingredientId = :ingredientId")
    suspend fun getPricesForIngredient(ingredientId: Int): List<SupplierIngredientPrice>

    @Query("SELECT * FROM SupplierIngredientPrice WHERE supplierId = :supplierId")
    suspend fun getPricesForSupplier(supplierId: Int): List<SupplierIngredientPrice>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSupplierIngredientPrice(price: SupplierIngredientPrice)

    @Update
    suspend fun updateSupplierIngredientPrice(price: SupplierIngredientPrice)

    @Delete
    suspend fun deleteSupplierIngredientPrice(price: SupplierIngredientPrice)

    @Query("SELECT * FROM SupplierIngredientPrice")
    suspend fun getAllSupplierIngredientPricesNow(): List<SupplierIngredientPrice>

    // ── Outbox queue (tablet → PC ledger bridge, spec 013 Phase 2) ──────────────
    @Insert
    suspend fun insertOutbox(entry: OutboxEntry): Long

    @Query("SELECT * FROM OutboxQueue WHERE state IN ('PENDING','FAILED') ORDER BY id ASC")
    fun getPendingOutbox(): Flow<List<OutboxEntry>>

    @Query("SELECT * FROM OutboxQueue WHERE state IN ('PENDING','FAILED') ORDER BY id ASC")
    suspend fun getPendingOutboxNow(): List<OutboxEntry>

    @Update
    suspend fun updateOutbox(entry: OutboxEntry)

    @Query("UPDATE OutboxQueue SET state = 'SYNCED', updatedAt = :now WHERE id = :id")
    suspend fun markOutboxSynced(id: Int, now: Long = System.currentTimeMillis())

    @Query("DELETE FROM OutboxQueue WHERE state = 'SYNCED'")
    suspend fun clearSyncedOutbox()

    @Query("SELECT COUNT(*) FROM OutboxQueue WHERE state IN ('PENDING','FAILED')")
    suspend fun countPendingOutbox(): Int
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
