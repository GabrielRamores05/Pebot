package com.cafeos.tablet.data

import android.content.Context
import android.util.Log
import android.provider.Settings
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.client.Ack
import io.socket.emitter.Emitter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import java.net.URISyntaxException
import java.util.*

class SocketSyncManager(private val context: Context) {
    companion object {
        private const val TAG = "SocketSyncManager"
        private const val KEY_SERVER_URL = "serverUrl"
    }

    private var socket: Socket? = null
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _orderUpdates = MutableStateFlow<OrderSyncEvent?>(null)
    val orderUpdates: StateFlow<OrderSyncEvent?> = _orderUpdates.asStateFlow()

    private val _inventoryUpdates = MutableStateFlow<InventorySyncEvent?>(null)
    val inventoryUpdates: StateFlow<InventorySyncEvent?> = _inventoryUpdates.asStateFlow()

    @Synchronized
    fun connect(serverUrl: String) {
        if (socket != null) return
        try {
            val opts = IO.Options()
            socket = IO.socket(serverUrl, opts)
            setupListeners()
            socket?.connect()
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Failed to connect to socket server: $serverUrl", e)
        }
    }

    @Synchronized
    fun disconnect() {
        socket?.disconnect()
        socket?.close()
        socket = null
        _isConnected.value = false
    }

    private fun setupListeners() {
        socket?.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected")
            _isConnected.value = true
            emitDeviceIdentity()
        }

        socket?.on(Socket.EVENT_DISCONNECT) {
            Log.d(TAG, "Socket disconnected")
            _isConnected.value = false
        }

        socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.e(TAG, "Socket connection error: ${args.firstOrNull()}")
            _isConnected.value = false
        }

        socket?.on("order_update") { args ->
            val json = args.firstOrNull() as? JSONObject
            json?.let {
                val orderId = it.optInt("orderId", -1)
                val status = it.optString("status", "")
                val tableNumber = it.optInt("tableNumber", 0)
                val orderNumber = it.optString("orderNumber", "")
                _orderUpdates.value = OrderSyncEvent(orderId, status, tableNumber, orderNumber)
            }
        }

        socket?.on("inventory_update") { args ->
            val json = args.firstOrNull() as? JSONObject
            json?.let {
                val productId = it.optInt("productId", -1)
                val newQuantity = it.optDouble("quantity", 0.0)
                _inventoryUpdates.value = InventorySyncEvent(productId, newQuantity)
            }
        }

        socket?.on("sync_request") { args ->
            val json = args.firstOrNull() as? JSONObject
            json?.optString("type")?.let { type ->
                when (type) {
                    "orders" -> syncOrders()
                    "inventory" -> syncInventory()
                    "products" -> syncProducts()
                }
            }
        }
    }

    private fun emitDeviceIdentity() {
        try {
            val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            val payload = JSONObject().apply {
                put("deviceId", deviceId)
                put("deviceType", "tablet" as Any)
                put("locationId", getSavedLocationId())
                put("timestamp", System.currentTimeMillis())
            }
            socket?.emit("register_device", payload)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit device identity", e)
        }
    }

    private fun getSavedLocationId(): String {
        val prefs = context.getSharedPreferences("pebot_prefs", Context.MODE_PRIVATE)
        return prefs.getString("server_url", "") ?: ""
    }

    private fun syncOrders() {
        try {
            val payload = JSONObject().apply {
                put("type", "orders")
                put("timestamp", System.currentTimeMillis())
            }
            socket?.emit("sync_data", payload, Ack { args ->
                Log.d(TAG, "Orders sync acknowledged: ${args.firstOrNull()}")
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync orders", e)
        }
    }

    private fun syncInventory() {
        try {
            val payload = JSONObject().apply {
                put("type", "inventory")
                put("timestamp", System.currentTimeMillis())
            }
            socket?.emit("sync_data", payload, Ack { args ->
                Log.d(TAG, "Inventory sync acknowledged: ${args.firstOrNull()}")
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync inventory", e)
        }
    }

    private fun syncProducts() {
        try {
            val payload = JSONObject().apply {
                put("type", "products")
                put("timestamp", System.currentTimeMillis())
            }
            socket?.emit("sync_data", payload, Ack { args ->
                Log.d(TAG, "Products sync acknowledged: ${args.firstOrNull()}")
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync products", e)
        }
    }

    fun handleOrderPlaced(order: Order) {
        try {
            val payload = JSONObject().apply {
                put("orderId", order.id)
                put("orderNumber", order.orderNumber ?: "")
                put("tableId", order.tableId ?: 0)
                put("totalAmount", order.totalAmount)
                put("status", order.status)
                put("paymentMethod", order.paymentMethod ?: "")
                put("discountAmount", order.discountAmount ?: 0.0)
                put("discountRate", order.discountRate ?: 0.0)
                put("discountReason", order.discountReason ?: "")
                put("timestamp", System.currentTimeMillis())
            }
            socket?.emit("order_placed", payload, Ack { args ->
                Log.d(TAG, "Order placed event acknowledged")
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to broadcast order placed", e)
        }
    }

    fun handleInventoryChanged(productId: Int, newQuantity: Double) {
        try {
            val payload = JSONObject().apply {
                put("productId", productId)
                put("quantity", newQuantity)
                put("timestamp", System.currentTimeMillis())
            }
            socket?.emit("inventory_changed", payload, Ack { args ->
                Log.d(TAG, "Inventory change acknowledged")
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to broadcast inventory change", e)
        }
    }

    fun requestFullSync() {
        try {
            val payload = JSONObject().apply {
                put("type", "full_sync")
                put("timestamp", System.currentTimeMillis())
            }
            socket?.emit("sync_request", payload)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request full sync", e)
        }
    }

    fun clearOrderUpdate() { _orderUpdates.value = null }
    fun clearInventoryUpdate() { _inventoryUpdates.value = null }
}

data class OrderSyncEvent(
    val orderId: Int,
    val status: String,
    val tableNumber: Int,
    val orderNumber: String
)

data class InventorySyncEvent(
    val productId: Int,
    val quantity: Double
)
