package com.cafeos.tablet.ui

import android.app.Application
import androidx.compose.runtime.mutableStateListOf
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cafeos.tablet.data.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.*

class CafeViewModel(application: Application) : AndroidViewModel(application) {
    private val dao = CafeDatabase.getDatabase(application).cafeDao()

    val categories = dao.getAllCategories()
    val allProducts = dao.getAllProducts()
    val allOrders = dao.getAllOrders()
    val ingredients = dao.getAllIngredients()

    // POS Cart
    private val _cartItems = mutableStateListOf<CartItem>()
    val cartItems: List<CartItem> get() = _cartItems

    private val _totalAmount = MutableStateFlow(0.0)
    val totalAmount: StateFlow<Double> = _totalAmount.asStateFlow()

    fun addToCart(product: Product) {
        val existing = _cartItems.find { it.product.id == product.id }
        if (existing != null) {
            existing.quantity++
        } else {
            _cartItems.add(CartItem(product, 1))
        }
        calculateTotal()
    }

    fun removeFromCart(cartItem: CartItem) {
        _cartItems.remove(cartItem)
        calculateTotal()
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
        calculateTotal()
    }

    private fun calculateTotal() {
        _totalAmount.value = _cartItems.sumOf { it.product.price * it.quantity }
    }

    fun placeOrder(customerName: String, paymentMethod: String) {
        viewModelScope.launch {
            val orderNumber = "ORD-" + System.currentTimeMillis().toString().takeLast(6)
            val order = Order(
                orderNumber = orderNumber,
                customerName = customerName,
                totalAmount = _totalAmount.value,
                paymentMethod = paymentMethod,
                barcodeValue = UUID.randomUUID().toString()
            )
            val orderId = dao.insertOrder(order).toInt()
            val orderItems = _cartItems.map {
                OrderItem(
                    orderId = orderId,
                    productId = it.product.id,
                    quantity = it.quantity,
                    unitPrice = it.product.price,
                    subtotal = it.product.price * it.quantity
                )
            }
            dao.insertOrderItems(orderItems)
            _cartItems.clear()
            _totalAmount.value = 0.0
        }
    }

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

    fun getDailySales(): Flow<Double?> {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        return dao.getDailySales(calendar.timeInMillis)
    }

    fun getTopSellingProducts() = dao.getTopSellingProducts()
}

data class CartItem(
    val product: Product,
    var quantity: Int
)
