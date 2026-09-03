package com.cafeos.tablet.data

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.java_websocket.WebSocket
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.handshake.ServerHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.URI
import java.util.Collections

class SocketSyncManager(private val context: Context) {
    companion object {
        private const val TAG = "SocketSyncManager"
        const val HOST_PORT = 3001
        private const val PREFS = "pebot_sync"
        private const val MODE_KEY = "mode"
        private const val URL_KEY = "url"
    }

    private var client: WebSocketClient? = null
    private var host: LocalSyncServer? = null
    private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    private val _hostAddress = MutableStateFlow<String?>(null)
    val hostAddress: StateFlow<String?> = _hostAddress.asStateFlow()
    private val _orderUpdates = MutableStateFlow<OrderSyncEvent?>(null)
    val orderUpdates: StateFlow<OrderSyncEvent?> = _orderUpdates.asStateFlow()
    private val _inventoryUpdates = MutableStateFlow<InventorySyncEvent?>(null)
    val inventoryUpdates: StateFlow<InventorySyncEvent?> = _inventoryUpdates.asStateFlow()
    private val _discoveredHosts = MutableStateFlow<List<String>>(emptyList())
    val discoveredHosts: StateFlow<List<String>> = _discoveredHosts.asStateFlow()

    private val serviceType = "_pebot._tcp."

    init {
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        when (preferences.getString(MODE_KEY, null)) {
            "host" -> startHost()
            "client" -> preferences.getString(URL_KEY, null)?.let { connect(it) }
        }
    }

    @Synchronized
    fun startHost() {
        if (host != null) return
        val address = getLocalAddress() ?: return
        host = LocalSyncServer(InetSocketAddress("0.0.0.0", HOST_PORT), this)
        _hostAddress.value = "http://$address:$HOST_PORT"
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(MODE_KEY, "host")
            .remove(URL_KEY)
            .apply()
        host?.start()
        registerService()
        stopDiscovery()
    }

    fun startDiscovery() {
        if (discoveryListener != null) return
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) = Unit
            override fun onDiscoveryStopped(serviceType: String) = Unit
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) { discoveryListener = null }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) { discoveryListener = null }
            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                if (serviceInfo.serviceType == this@SocketSyncManager.serviceType) nsdManager.resolveService(serviceInfo, resolveListener)
            }
            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                _discoveredHosts.value = _discoveredHosts.value.filterNot { it.endsWith(":${serviceInfo.port}") }
            }
        }
        discoveryListener = listener
        nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, listener)
    }

    fun stopDiscovery() {
        discoveryListener?.let { runCatching { nsdManager.stopServiceDiscovery(it) } }
        discoveryListener = null
        _discoveredHosts.value = emptyList()
    }

    private val resolveListener = object : NsdManager.ResolveListener {
        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) = Unit
        override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
            val address = serviceInfo.host?.hostAddress ?: return
            val url = "http://$address:${serviceInfo.port}"
            if (url !in _discoveredHosts.value) _discoveredHosts.value = _discoveredHosts.value + url
        }
    }

    private fun registerService() {
        val info = NsdServiceInfo().apply {
            serviceName = "Pebot POS"
            serviceType = this@SocketSyncManager.serviceType
            port = HOST_PORT
        }
        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(serviceInfo: NsdServiceInfo) = Unit
            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) { registrationListener = null }
            override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) = Unit
            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) = Unit
        }
        registrationListener = listener
        nsdManager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
    }

    @Synchronized
    fun connect(serverUrl: String) {
        if (client != null || host != null) return
        try {
            val normalizedUrl = normalizeUrl(serverUrl)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(MODE_KEY, "client")
                .putString(URL_KEY, normalizedUrl)
                .apply()
            val websocketUrl = normalizedUrl
                .replaceFirst("http://", "ws://")
                .replaceFirst("https://", "wss://")
            client = object : WebSocketClient(URI("$websocketUrl/pebot-sync")) {
                override fun onOpen(handshakedata: ServerHandshake?) {
                    _isConnected.value = true
                    sendIdentity()
                }
                override fun onMessage(message: String) { handleIncoming(JSONObject(message)) }
                override fun onClose(code: Int, reason: String?, remote: Boolean) { _isConnected.value = false }
                override fun onError(ex: Exception?) {
                    Log.e(TAG, "Sync connection error", ex)
                    _isConnected.value = false
                }
            }
            client?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect to $serverUrl", e)
            _isConnected.value = false
        }
    }

    @Synchronized
    fun disconnect() {
        client?.close()
        client = null
        host?.stop()
        host = null
        _hostAddress.value = null
        _isConnected.value = false
        stopDiscovery()
        registrationListener?.let { runCatching { nsdManager.unregisterService(it) } }
        registrationListener = null
    }

    internal fun hostStarted() { _isConnected.value = true }

    fun handleOrderPlaced(order: Order, items: List<OrderItem> = emptyList()) {
        send(JSONObject().apply {
            put("event", "order_placed")
            put("orderId", order.id)
            put("orderNumber", order.orderNumber)
            put("customerName", order.customerName)
            put("totalAmount", order.totalAmount)
            put("discountAmount", order.discountAmount)
            put("discountRate", order.discountRate)
            put("discountReason", order.discountReason ?: "")
            put("paymentMethod", order.paymentMethod)
            put("orderType", order.orderType)
            put("tableNumber", order.tableId ?: 0)
            put("status", order.status)
            put("createdAt", order.createdAt)
            put("items", org.json.JSONArray().apply {
                items.forEach { item ->
                    put(JSONObject().apply {
                        put("productId", item.productId)
                        put("quantity", item.quantity)
                        put("unitPrice", item.unitPrice)
                        put("subtotal", item.subtotal)
                    })
                }
            })
        })
    }

    fun handleInventoryChanged(productId: Int, newQuantity: Double) {
        send(JSONObject().apply {
            put("event", "inventory_changed")
            put("productId", productId)
            put("quantity", newQuantity)
        })
    }

    fun requestFullSync() = send(JSONObject().put("event", "sync_request"))

    private fun sendIdentity() {
        send(JSONObject().apply {
            put("event", "register_device")
            put("deviceId", Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID))
            put("deviceType", "tablet")
        })
    }

    private fun send(message: JSONObject) {
        try {
            client?.send(message.toString())
            host?.broadcast(message.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send sync message", e)
        }
    }

    internal fun handleIncoming(message: JSONObject) {
        when (message.optString("event")) {
            "order_placed", "order_update" -> {
                val order = Order(
                    id = message.optInt("orderId", 0),
                    orderNumber = message.optString("orderNumber", ""),
                    customerName = message.optString("customerName", "Walk-in Customer"),
                    status = message.optString("status", "PENDING"),
                    totalAmount = message.optDouble("totalAmount", 0.0),
                    discountAmount = message.optDouble("discountAmount", 0.0),
                    discountRate = message.optDouble("discountRate", 0.0),
                    discountReason = message.optString("discountReason", "").ifBlank { null },
                    paymentMethod = message.optString("paymentMethod", "CASH"),
                    orderType = message.optString("orderType", "DINE_IN"),
                    tableId = message.optInt("tableNumber", 0).takeIf { it > 0 },
                    createdAt = message.optLong("createdAt", System.currentTimeMillis())
                )
                val items = message.optJSONArray("items")?.let { array ->
                    (0 until array.length()).map { index ->
                        val item = array.getJSONObject(index)
                        OrderItem(
                            orderId = order.id,
                            productId = item.optInt("productId"),
                            quantity = item.optInt("quantity"),
                            unitPrice = item.optDouble("unitPrice"),
                            subtotal = item.optDouble("subtotal")
                        )
                    }
                } ?: emptyList()
                _orderUpdates.value = OrderSyncEvent(order, items)
            }
            "inventory_changed", "inventory_update" -> _inventoryUpdates.value = InventorySyncEvent(
                message.optInt("productId", -1),
                message.optDouble("quantity", 0.0)
            )
        }
    }

    private fun getLocalAddress(): String? {
        return try {
            Collections.list(NetworkInterface.getNetworkInterfaces()).asSequence()
                .flatMap { Collections.list(it.inetAddresses).asSequence() }
                .filterIsInstance<Inet4Address>()
                .firstOrNull { !it.isLoopbackAddress && it.isSiteLocalAddress }
                ?.hostAddress
        } catch (e: Exception) {
            null
        }
    }

    private fun normalizeUrl(value: String): String {
        val trimmed = value.trim().trimEnd('/')
        val withScheme = if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed else "http://$trimmed"
        return if (withScheme.substringAfter("://").contains(":")) withScheme else "$withScheme:$HOST_PORT"
    }

    fun clearOrderUpdate() { _orderUpdates.value = null }
    fun clearInventoryUpdate() { _inventoryUpdates.value = null }
}

private class LocalSyncServer(
    address: InetSocketAddress,
    private val manager: SocketSyncManager
) : WebSocketServer(address) {
    private val clients = Collections.synchronizedSet(mutableSetOf<WebSocket>())

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake?) { clients.add(conn) }
    override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) { clients.remove(conn) }
    override fun onMessage(conn: WebSocket, message: String) {
        val incoming = JSONObject(message)
        manager.handleIncoming(incoming)
        val event = incoming.optString("event")
        if (event == "order_placed" || event == "inventory_changed") {
            val outgoing = JSONObject(incoming.toString()).apply {
                put("event", if (event == "order_placed") "order_update" else "inventory_update")
            }
            synchronized(clients) {
                clients.filter { it != conn && it.isOpen }.forEach { it.send(outgoing.toString()) }
            }
        }
    }
    override fun onError(conn: WebSocket?, ex: Exception?) { Log.e("LocalSyncServer", "Host error", ex) }
    override fun onStart() {
        manager.hostStarted()
        Log.i("LocalSyncServer", "Host started on port ${SocketSyncManager.HOST_PORT}")
    }
}

data class OrderSyncEvent(val order: Order, val items: List<OrderItem>)
data class InventorySyncEvent(val productId: Int, val quantity: Double)
