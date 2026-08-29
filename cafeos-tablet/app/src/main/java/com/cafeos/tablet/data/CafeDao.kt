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

    // Products
    @Query("SELECT * FROM Product WHERE categoryId = :categoryId AND available = 1")
    fun getProductsByCategory(categoryId: Int): Flow<List<Product>>

    @Query("SELECT * FROM Product ORDER BY name ASC")
    fun getAllProducts(): Flow<List<Product>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProduct(product: Product)

    // Orders
    @Insert
    suspend fun insertOrder(order: Order): Long

    @Insert
    suspend fun insertOrderItems(items: List<OrderItem>)

    @Transaction
    @Query("SELECT * FROM Orders ORDER BY createdAt DESC")
    fun getAllOrders(): Flow<List<Order>>

    @Query("SELECT * FROM OrderItem WHERE orderId = :orderId")
    suspend fun getOrderItems(orderId: Int): List<OrderItem>

    // Inventory
    @Query("SELECT * FROM Ingredient ORDER BY name ASC")
    fun getAllIngredients(): Flow<List<Ingredient>>

    @Update
    suspend fun updateIngredient(ingredient: Ingredient)

    @Insert
    suspend fun insertIngredientTransaction(transaction: IngredientTransaction)

    // Analytics (Minimal)
    @Query("SELECT SUM(totalAmount) FROM Orders WHERE createdAt >= :startOfDay")
    fun getDailySales(startOfDay: Long): Flow<Double?>

    @Query("SELECT productId, SUM(quantity) as totalQty FROM OrderItem GROUP BY productId ORDER BY totalQty DESC LIMIT 5")
    fun getTopSellingProducts(): Flow<List<ProductSales>>
}

data class ProductSales(
    val productId: Int,
    val totalQty: Int
)
