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
@Entity(tableName = "Orders")
data class Order(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderNumber: String,
    val customerName: String,
    val status: String = "PENDING", // PENDING, PREPARING, COMPLETED, CANCELLED
    val totalAmount: Double,
    val discountAmount: Double = 0.0,
    val discountRate: Double = 0.0,
    val discountReason: String? = null,
    val paymentMethod: String = "CASH", // CASH, GCASH, PAYMAYA
    val orderType: String = "DINE_IN",
    val tableId: Int? = null,
    val barcodeValue: String? = null,
    val createdAt: Long = System.currentTimeMillis()
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
    val type: String, // PURCHASE, USAGE, ADJUSTMENT
    val quantity: Double,
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
    val priceDelta: Double = 0.0
)

@Serializable
@Entity(tableName = "Payment")
data class Payment(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderId: Int,
    val method: String,      // CASH, GCASH, PAYMAYA
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
@Entity(tableName = "CafeTable")
data class CafeTable(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val capacity: Int = 4,
    val currentOccupants: Int = 0,
    val status: String = "AVAILABLE",
    val createdAt: Long = System.currentTimeMillis()
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
    val sortOrder: Int = 0
)

@Serializable
@Entity(tableName = "Expense")
data class Expense(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val category: String,
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
    val gcashAccountName: String? = null,
    val gcashQrPath: String? = null,
    val paymayaAccountName: String? = null,
    val paymayaQrPath: String? = null,
    val voiceEnabled: Boolean = true,
    val voiceVolume: Float = 1.0f,
    val voiceSpeed: Float = 1.0f,
    val updatedAt: Long = System.currentTimeMillis()
)

@Serializable
@Entity(tableName = "Staff")
data class Staff(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val role: String = "STAFF",
    val email: String? = null,
    val phone: String? = null,
    val pin: String? = null,
    val active: Boolean = true,
    val createdAt: Long = System.currentTimeMillis()
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
@Entity(tableName = "OrderMessage")
data class OrderMessage(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderId: Int,
    val text: String,
    val senderType: String = "STAFF",
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
    val rating: Int,
    val comment: String? = null,
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
