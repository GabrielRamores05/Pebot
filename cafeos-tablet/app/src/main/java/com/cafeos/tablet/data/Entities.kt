package com.cafeos.tablet.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.PrimaryKey
import androidx.room.Index

@Entity(tableName = "Category")
data class Category(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val icon: String? = null,
    val sortOrder: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)

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
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "Orders")
data class Order(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderNumber: String,
    val customerName: String,
    val status: String = "PENDING", // PENDING, PREPARING, COMPLETED, CANCELLED
    val totalAmount: Double,
    val discountAmount: Double = 0.0,
    val paymentMethod: String = "CASH", // CASH, GCASH
    val orderType: String = "DINE_IN",
    val createdAt: Long = System.currentTimeMillis()
)

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
