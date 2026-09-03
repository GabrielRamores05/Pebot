package com.cafeos.tablet.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.PrimaryKey
import androidx.room.Index
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "Category")
data class Category(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val icon: String? = null,
    val sortOrder: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "Product",
    foreignKeys = [
        ForeignKey(
            entity = Category::class,
            parentColumns = ["id"],
            childColumns = ["categoryId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["categoryId"])]
)
data class Product(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val description: String? = null,
    val price: Double,
    val imageUrl: String? = null,
    val available: Boolean = true,
    val categoryId: Int,
    val capitalCost: Double = 0.0,
    val marginType: String = "PERCENTAGE",
    val marginValue: Double = 30.0,
    val vatExempt: Boolean = false,
    val prepTimeMinutes: Int = 5,
    val stationType: String = "general",
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "ProductIngredient",
    primaryKeys = ["productId", "ingredientId"],
    foreignKeys = [
        ForeignKey(entity = Product::class, parentColumns = ["id"], childColumns = ["productId"], onDelete = ForeignKey.CASCADE),
        ForeignKey(entity = Ingredient::class, parentColumns = ["id"], childColumns = ["ingredientId"], onDelete = ForeignKey.CASCADE)
    ],
    indices = [Index(value = ["productId"]), Index(value = ["ingredientId"])]
)
data class ProductIngredient(
    val productId: Int,
    val ingredientId: Int,
    val quantity: Double,
    val required: Boolean = true
)

@Serializable
@Entity(
    tableName = "Orders",
    indices = [Index(value = ["orderNumber"], unique = true)]
)
data class Order(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderNumber: String,
    val customerName: String,
    val status: String = "PENDING", // PENDING, PREPARING, COMPLETED, CANCELLED
    val totalAmount: Double,
    val discountAmount: Double = 0.0,
    // Non-null on the tablet (0.0 = none); the sync layer maps 0.0 <-> null for
    // the Windows schema where discountRate is nullable.
    val discountRate: Double = 0.0,
    val discountReason: String? = null,
    val paymentMethod: String = "CASH", // CASH, GCASH, PAYMAYA
    val orderType: String = "DINE_IN", // DINE_IN, TAKEOUT, DELIVERY
    val tableId: Int? = null,
    val tableLocation: String? = null,
    val deliveryAddress: String? = null,
    val notes: String? = null,
    val loyaltyCustomerName: String? = null,
    val loyaltyPromo: Boolean = false,
    val queueNumber: Int? = null,
    val barcodeValue: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "OrderItem",
    foreignKeys = [
        ForeignKey(
            entity = Order::class,
            parentColumns = ["id"],
            childColumns = ["orderId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = Product::class,
            parentColumns = ["id"],
            childColumns = ["productId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [Index(value = ["orderId"]), Index(value = ["productId"])]
)
data class OrderItem(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderId: Int,
    val productId: Int,
    val quantity: Int,
    val unitPrice: Double,
    val subtotal: Double,
    val notes: String? = null
)

@Serializable
@Entity(tableName = "Ingredient")
data class Ingredient(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val category: String = "General",
    val baseUnit: String, // g, ml, pcs
    val currentStock: Double = 0.0,
    val minStock: Double = 0.0,
    val costPerUnit: Double = 0.0,
    // Latest supplier of this ingredient (spec 014). Written inside the same
    // transaction as a purchase; null = never purchased. Not a hard FK so the
    // supplier can be deleted without breaking history — deletion recomputes it.
    val lastSupplierId: Int? = null,
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "IngredientTransaction",
    foreignKeys = [
        ForeignKey(
            entity = Ingredient::class,
            parentColumns = ["id"],
            childColumns = ["ingredientId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["ingredientId"])]
)
data class IngredientTransaction(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val ingredientId: Int,
    val type: String, // PURCHASE, USAGE, ADJUSTMENT, OPENING, VOID_PURCHASE
    val quantity: Double,
    val referenceId: Int? = null,
    val referenceType: String? = null, // "supplier" | "void-of" | "batch" | "order" | null
    // Purchase detail (spec 014): the unit the amount was entered in, the total
    // pesos paid, and the per-base-unit cost at purchase time (display + trends).
    val purchaseUnit: String? = null,
    val purchaseCost: Double? = null,
    val unitCost: Double? = null,
    val notes: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "OrderOption")
data class OrderOption(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderItemId: Int,
    val name: String,        // "Size", "Extra Shot"
    val value: String,       // "Large", "Oat Milk"
    val priceDelta: Double = 0.0,
    val ingredientId: Int? = null,
    val ingredientQuantity: Double = 0.0
)

@Serializable
@Entity(
    tableName = "Payment",
    indices = [Index(value = ["orderId"])]
)
data class Payment(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderId: Int,
    val method: String,      // CASH, GCASH, PAYMAYA
    val amount: Double = 0.0,
    val amountTendered: Double,
    val change: Double = 0.0,
    val screenshotPath: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "SyncMeta")
data class SyncMeta(
    @PrimaryKey val id: Int = 1,
    val lastExportAt: Long = 0,
    val lastImportAt: Long = 0,
    val exportVersion: Int = 1
)

@Serializable
@Entity(tableName = "Customer")
data class Customer(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val contact: String? = null,
    val loyaltyPoints: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "Supplier")
data class Supplier(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val contactPerson: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val address: String? = null,
    val notes: String? = null,
    val status: String = "ACTIVE",
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "SupplierIngredientPrice",
    foreignKeys = [
        ForeignKey(entity = Supplier::class, parentColumns = ["id"], childColumns = ["supplierId"], onDelete = ForeignKey.CASCADE),
        ForeignKey(entity = Ingredient::class, parentColumns = ["id"], childColumns = ["ingredientId"], onDelete = ForeignKey.CASCADE)
    ],
    indices = [Index(value = ["supplierId"]), Index(value = ["ingredientId"])]
)
data class SupplierIngredientPrice(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val supplierId: Int,
    val ingredientId: Int,
    val unitPrice: Double,
    val notes: String? = null,
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "CafeTable")
data class CafeTable(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val slug: String? = null,
    val capacity: Int = 4,
    val currentOccupants: Int = 0,
    val status: String = "AVAILABLE", // AVAILABLE, OCCUPIED, NEEDS_CLEANING
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "Station")
data class Station(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val stationType: String,
    val emoji: String? = null,
    val active: Boolean = true,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "OptionGroup")
data class OptionGroup(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val selectionType: String = "single",
    val sortOrder: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "ProductOptionGroup")
data class ProductOptionGroup(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val productId: Int,
    val groupId: Int
)

@Serializable
@Entity(tableName = "Option")
data class Option(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val groupId: Int,
    val name: String,
    val priceDelta: Double = 0.0,
    val sortOrder: Int = 0,
    val ingredientId: Int? = null,
    val ingredientQuantity: Double = 0.0
)

@Serializable
@Entity(tableName = "Expense")
data class Expense(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val category: String,
    val categoryId: Int? = null,
    val supplierId: Int? = null,
    val amount: Double,
    val notes: String? = null,
    val paidBy: String? = null,
    val paymentMethod: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "BusinessSettings")
data class BusinessSettings(
    @PrimaryKey val id: Int = 1,
    val shopName: String = "Pebot",
    val address: String? = null,
    val tin: String? = null,
    val branchCode: String? = null,
    val vatRate: Double = 12.0,
    val receiptPrefix: String = "INV",
    val lastReceiptNumber: Int = 0,
    val footerMessage: String = "Thank you for your visit!",
    val loyaltyEnabled: Boolean = true,
    val studentPwdDiscountRate: Double = 20.0,
    val gcashAccountName: String? = null,
    val gcashQrPath: String? = null,
    val paymayaAccountName: String? = null,
    val paymayaQrPath: String? = null,
    val aiApiKey: String? = null,
    val aiModel: String? = null,
    val aiSystemPrompt: String? = null,
    val aiFolderAccess: Boolean = false,
    val aiReadBirPricing: Boolean = false,
    val voiceEnabled: Boolean = true,
    val voiceVolume: Float = 1.0f,
    val voiceSpeed: Float = 1.0f,
    val voiceOrderMessage: String = "New order {order} for {customer} received at {table}.",
    val voiceQuotaMessage: String = "Congratulations! Daily quota reached: {current} of {target}.",
    val dailyQuotaMode: String = "ORDERS",
    val dailyQuotaTarget: Double = 0.0,
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "Staff")
data class Staff(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val role: String = "STAFF", // ADMIN, STAFF, KITCHEN (Windows vocabulary)
    val email: String? = null,
    val phone: String? = null,
    val pin: String? = null,
    val active: Boolean = true,
    val permissions: String = "",
    val profitShareRate: Double = 0.0,
    // Windows User HR profile fields (tablet parity)
    val address: String? = null,
    val dateOfBirth: Long? = null,
    val hireDate: Long? = null,
    val position: String? = null,
    val department: String? = null,
    val profilePhoto: String? = null,
    val emergencyContactName: String? = null,
    val emergencyContactPhone: String? = null,
    val hourlyRate: Double? = null,
    val monthlySalary: Double? = null,
    val paymentType: String? = null, // HOURLY, SALARIED
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "LoyaltyVoucher")
data class LoyaltyVoucher(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val code: String,
    val type: String = "PROMO",
    val discountType: String = "PERCENTAGE",
    val discountValue: Double = 0.0,
    val minOrderAmount: Double = 0.0,
    val maxDiscount: Double = 0.0,
    val usageLimit: Int = 0,
    val usedCount: Int = 0,
     val startDate: Long = System.currentTimeMillis(),
     val endDate: Long = System.currentTimeMillis(),
     val active: Boolean = true,
     val createdAt: Long = System.currentTimeMillis()
 )

@Serializable
@Entity(
    tableName = "LoyaltyCard",
    indices = [Index(value = ["customerId"]), Index(value = ["cardNumber"])]
)
data class LoyaltyCard(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val customerId: Int? = null,
    val cardNumber: String,
    val pointsBalance: Double = 0.0,
    val tier: String = "CASUAL",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "LoyaltyTransaction",
    indices = [Index(value = ["cardId"]), Index(value = ["orderId"])]
)
data class LoyaltyTransaction(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val cardId: Int,
    val type: String,
    val points: Double,
    val orderId: Int? = null,
    val details: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "LoyaltySetting")
data class LoyaltySetting(
    @PrimaryKey val key: String,
    val value: String,
    val scope: String = "GLOBAL"
)

@Serializable
@Entity(
    tableName = "AIConversation",
    indices = [Index(value = ["createdAt"])]
)
data class AIConversation(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val title: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "AIMessage",
    indices = [Index(value = ["conversationId"])]
)
data class AIMessage(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val conversationId: Int,
    val role: String, // "user" or "assistant"
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "ProductOption",
    indices = [Index(value = ["productId"]), Index(value = ["optionId"])]
)
data class ProductOption(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val productId: Int,
    val optionId: Int,
    val priceDelta: Double = 0.0
)

@Serializable
@Entity(
    tableName = "TableSession",
    indices = [Index(value = ["tableId"]), Index(value = ["orderId"])]
)
data class TableSession(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val tableId: Int,
    val orderId: Int? = null,
    val startedAt: Long,
    val endedAt: Long? = null,
    val status: String = "OCCUPIED",
    val guestCount: Int = 0
)

@Serializable
@Entity(tableName = "Attendance")
data class Attendance(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val staffId: Int,
    val clockIn: Long,
    val clockOut: Long? = null,
    val breakStart: Long? = null,
    val breakEnd: Long? = null,
    val date: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "LeaveType")
data class LeaveType(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val requiresFile: Boolean = false
)

@Serializable
@Entity(
    tableName = "LeaveRequest",
    indices = [Index(value = ["staffId"])]
)
data class LeaveRequest(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val staffId: Int,
    val typeId: Int? = null,
    val type: String = "ANNUAL",
    val startDate: Long,
    val endDate: Long,
    val status: String = "PENDING",
    val reason: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "Schedule",
    indices = [Index(value = ["staffId"])]
)
data class Schedule(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val staffId: Int,
    val dayOfWeek: Int,
    val shiftStart: String,
    val shiftEnd: String,
    val role: String? = null
)

@Serializable
@Entity(
    tableName = "Payroll",
    indices = [Index(value = ["staffId"])]
)
data class Payroll(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val staffId: Int,
    val periodStart: Long,
    val periodEnd: Long,
    val baseSalary: Double,
    val overtimePay: Double = 0.0,
    val deductions: Double = 0.0,
    val sss: Double = 0.0,
    val philhealth: Double = 0.0,
    val pagibig: Double = 0.0,
    val tax: Double = 0.0,
    val profitShareAmount: Double = 0.0,
    val netPay: Double = 0.0,
    val status: String = "PENDING",
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "StaffDocument",
    indices = [Index(value = ["staffId"])]
)
data class StaffDocument(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val staffId: Int,
    val title: String,
    val fileUri: String,
    val fileType: String? = null,
    val uploadedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "StaffTraining",
    indices = [Index(value = ["staffId"])]
)
data class StaffTraining(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val staffId: Int,
    val program: String,
    val completed: Boolean = false,
    val certifiedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "PerformanceReview",
    indices = [Index(value = ["staffId"])]
)
data class PerformanceReview(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val staffId: Int,
    val reviewerId: Int? = null,
    val score: Int,
    val comments: String? = null,
    val date: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "OrderMessage")
data class OrderMessage(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderId: Int,
    val type: String = "text", // "text", "voice" (voice: text holds the audio URL)
    val text: String,
    val senderType: String = "customer", // "customer" or "staff" (Windows vocabulary)
    val senderName: String? = null,
    val isRead: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "Review")
data class Review(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val productId: Int,
    val customerId: Int? = null,
    val customerName: String? = null,
    val rating: Int,
    val comment: String? = null,
    val tasteSuggestion: String? = null,
    val imageUrl: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "ExpenseCategory")
data class ExpenseCategory(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val color: String? = null,
    val icon: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "AuditEvent",
    indices = [Index(value = ["entityType", "entityId"])]
)
data class AuditEvent(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val eventType: String,
    val entityType: String,
    val entityId: Int,
    val staffId: Int? = null,
    val details: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "Guest",
    indices = [Index(value = ["tableSessionId"])]
)
data class Guest(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val tableSessionId: Int,
    val name: String? = null,
    val mood: String? = null,
    val joinedAt: Long = System.currentTimeMillis(),
    val leftAt: Long? = null
)

@Serializable
@Entity(
    tableName = "TableSection",
    indices = [Index(value = ["name"])]
)
data class TableSection(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val tableIds: String,
    val floorNumber: Int = 1,
    val createdAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(
    tableName = "ProductStation",
    primaryKeys = ["productId", "stationId"],
    foreignKeys = [
        ForeignKey(entity = Product::class, parentColumns = ["id"], childColumns = ["productId"], onDelete = ForeignKey.CASCADE),
        ForeignKey(entity = Station::class, parentColumns = ["id"], childColumns = ["stationId"], onDelete = ForeignKey.CASCADE)
    ],
    indices = [Index(value = ["productId"]), Index(value = ["stationId"])]
)
data class ProductStation(
    val productId: Int,
    val stationId: Int
)

/**
 * Outbound queue for the tablet → PC ledger bridge (spec 013 Phase 2).
 * Every value-changing action made while the PC is unreachable is appended here
 * and flushed idempotently on reconnect (PC merges by entityKey / orderNumber).
 */
@Serializable
@Entity(
    tableName = "OutboxQueue",
    indices = [Index(value = ["state"]), Index(value = ["createdAt"])]
)
data class OutboxEntry(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val eventType: String,      // ORDER_PLACED, ORDER_STATUS, STOCK_ADJUST, ATTENDANCE, AUDIT
    val entityKey: String,      // idempotency key: orderNumber or "type:key"
    val payloadJson: String,
    val state: String = "PENDING", // PENDING, SENDING, SYNCED, FAILED
    val attempts: Int = 0,
    val lastError: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

/** One ingredient row on the supplier page (spec 014, US3), not a DB table. */
data class SupplierIngredientTrend(
    val ingredientName: String,
    val baseUnit: String,
    val latestUnitCost: Double?,
    val previousUnitCost: Double?,
    val change: PriceChange?,
    val purchaseCount: Int,
    val lastPurchaseDate: Long?
)
