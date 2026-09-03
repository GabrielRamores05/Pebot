package com.cafeos.tablet.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Tablet → PC ledger bridge client (spec 013 Phase 2; contract:
 * `specs/013-tablet-full-staff-parity/contracts/bridge.md`).
 *
 * Transport is deliberately small (HttpURLConnection over the café LAN, no extra
 * dependency). Payload builders are pure and unit-tested; only [pushOrder],
 * [updateOrderStatus] and [fetchSnapshot] touch the network.
 *
 * The PC side authenticates with `Authorization: Bearer <deviceSecret>`
 * (admin-issued; created/revoked on the PC admin tools).
 */
object PcBridgeClient {

    @Serializable
    data class PushResponse(
        val ok: Boolean = false,
        val orderId: Int? = null,
        val orderNumber: String? = null,
        val receiptSerial: String? = null,
        val error: String? = null
    )

    /** Event types stored in the local OutboxQueue. */
    object Events {
        const val ORDER_PLACED = "ORDER_PLACED"
        const val ORDER_STATUS = "ORDER_STATUS"
        const val STOCK_ADJUST = "STOCK_ADJUST"
        const val ATTENDANCE = "ATTENDANCE"
        const val AUDIT = "AUDIT"
    }

    private val json = Json { ignoreUnknownKeys = true }

    // ------------------------------------------------------------------ JSON --

    /** Order payload for the PC ingest route. Only discount *identities* are
     *  sent — the PC derives totals/loyalty/vouchers server-side. Items carry
     *  both the tablet product id and its name: ids differ per device, so the
     *  PC resolves by name (mirroring its /api/import/tablet merge). */
    fun orderPayload(
        order: Order,
        items: List<OrderItem>,
        itemOptions: Map<Int, List<OrderOption>>,
        productNames: Map<Int, String>,
        payment: Payment?,
        tableName: String? = null,
        actingStaff: String? = null
    ): JsonObject = buildJsonObject {
        put("tabletOrderId", order.id)
        put("orderNumber", order.orderNumber)
        put("customerName", order.customerName)
        put("orderType", order.orderType)
        put("deliveryAddress", order.deliveryAddress)
        put("notes", order.notes)
        put("paymentMethod", order.paymentMethod)
        put("discountReason", order.discountReason)
        put("discountRate", order.discountRate)
        put("loyaltyCustomerName", order.loyaltyCustomerName)
        put("tableId", order.tableId)
        tableName?.let { put("tableName", it) }
        put("createdAt", order.createdAt)
        actingStaff?.let { put("actingStaff", it) }
        put("items", JsonArray(items.map { item ->
            buildJsonObject {
                put("productId", item.productId)
                put("productName", productNames[item.productId] ?: "")
                put("quantity", item.quantity)
                put("notes", item.notes)
                put("options", JsonArray(itemOptions[item.id].orEmpty().map { opt ->
                    buildJsonObject {
                        put("name", opt.name)
                        put("value", opt.value)
                        put("priceDelta", opt.priceDelta)
                    }
                }))
            }
        }))
        payment?.let { p ->
            put("payment", buildJsonObject {
                put("method", p.method)
                put("amount", p.amount)
                put("amountTendered", p.amountTendered)
                put("change", p.change)
                put("screenshotPath", p.screenshotPath)
            })
        }
    }

    fun statusPayload(orderNumber: String, status: String): JsonObject = buildJsonObject {
        put("orderNumber", orderNumber)
        put("status", status)
    }

    fun stockPayload(ingredientId: Int, delta: Double, notes: String?): JsonObject = buildJsonObject {
        put("ingredientId", ingredientId)
        put("delta", delta)
        put("notes", notes)
    }

    // ── Spec 014 T029 (contract: specs/014-purchase-supplier-insights/contracts/bridge-schema.md)
    // Snapshot ingredient objects carry the cached latest supplier; ledger rows
    // carry their supplier linkage; VOID_PURCHASE rows flow through with their
    // type so the PC can apply the reverse exactly like a local void. Money
    // values travel unrounded as decimal numbers.

    /** Ingredient object for a tablet→PC snapshot (carries `lastSupplierId`). */
    fun ingredientPayload(ingredient: Ingredient): JsonObject = buildJsonObject {
        put("ingredientId", ingredient.id)
        put("name", ingredient.name)
        put("category", ingredient.category)
        put("baseUnit", ingredient.baseUnit)
        put("currentStock", ingredient.currentStock)
        put("minStock", ingredient.minStock)
        put("costPerUnit", ingredient.costPerUnit)
        ingredient.lastSupplierId?.let { put("lastSupplierId", it) }
    }

    /** One ledger row for a tablet→PC snapshot (referenceType/referenceId as stored). */
    fun transactionPayload(txn: IngredientTransaction): JsonObject = buildJsonObject {
        put("transactionId", txn.id)
        put("ingredientId", txn.ingredientId)
        put("type", txn.type) // PURCHASE / ADJUSTMENT / USAGE / OPENING / VOID_PURCHASE
        put("quantity", txn.quantity)
        txn.referenceType?.let { put("referenceType", it) }
        txn.referenceId?.let { put("referenceId", it) }
        txn.purchaseUnit?.let { put("purchaseUnit", it) }
        txn.purchaseCost?.let { put("purchaseCost", it) }
        txn.unitCost?.let { put("unitCost", it) }
        txn.notes?.let { put("notes", it) }
    }

    /** Full inventory snapshot payload (ingredients first, then their ledger). */
    fun inventorySnapshotPayload(
        ingredients: List<Ingredient>,
        transactions: List<IngredientTransaction>
    ): JsonObject = buildJsonObject {
        put("ingredients", JsonArray(ingredients.map { ingredientPayload(it) }))
        put("ingredientTransactions", JsonArray(transactions.map { transactionPayload(it) }))
    }

    /** Serializes any [payload] so callers can store it in the OutboxQueue. */
    fun serialize(payload: JsonObject): String = json.encodeToString<JsonObject>(payload)

    // --------------------------------------------------------------- network --

    private fun endpoint(baseUrl: String, path: String): String {
        val base = baseUrl.trim().trimEnd('/')
        val p = if (path.startsWith("/")) path else "/$path"
        return "$base$p"
    }

    private fun newConnection(config: PcBridgeConfig, path: String, method: String): java.net.HttpURLConnection {
        val connection = java.net.URL(endpoint(config.baseUrl, path)).openConnection() as java.net.HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 4_000
        connection.readTimeout = 10_000
        connection.doOutput = method == "POST" || method == "PATCH"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Authorization", "Bearer ${config.secret}")
        connection.setRequestProperty("X-Cafeos-Device", config.deviceId)
        return connection
    }

    private fun readResponse(connection: java.net.HttpURLConnection): PushResponse {
        return try {
            val code = connection.responseCode
            val body = if (code in 200..299) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
            }
            if (code in 200..299) {
                try {
                    json.decodeFromString<PushResponse>(body).let { resp ->
                        if (resp.ok || resp.orderNumber != null) resp else resp.copy(ok = true)
                    }
                } catch (_: Exception) {
                    PushResponse(ok = true)
                }
            } else {
                PushResponse(ok = false, error = "HTTP $code ${body.take(200)}")
            }
        } catch (e: Exception) {
            PushResponse(ok = false, error = e.message ?: e.javaClass.simpleName)
        }
    }

    private fun jsonBody(config: PcBridgeConfig, path: String, method: String, payloadJson: String): PushResponse {
        val connection = newConnection(config, path, method)
        return try {
            if (connection.doOutput) {
                connection.outputStream.use { it.write(payloadJson.toByteArray(Charsets.UTF_8)) }
            }
            readResponse(connection)
        } catch (e: Exception) {
            PushResponse(ok = false, error = e.message ?: e.javaClass.simpleName)
        } finally {
            connection.disconnect()
        }
    }

    fun pushOrder(config: PcBridgeConfig, payload: JsonObject): PushResponse =
        jsonBody(config, "/api/tablet/orders", "POST", serialize(payload))

    fun updateOrderStatus(config: PcBridgeConfig, orderNumber: String, status: String): PushResponse =
        jsonBody(config, "/api/tablet/orders/$orderNumber", "PATCH", serialize(statusPayload(orderNumber, status)))

    fun pushStockAdjustment(config: PcBridgeConfig, ingredientId: Int, delta: Double, notes: String?): PushResponse =
        jsonBody(config, "/api/tablet/stock", "POST", serialize(stockPayload(ingredientId, delta, notes)))

    /** Returns the raw JSON body of the snapshot endpoint (parsing/applying is
     *  implemented by the sync service that consumes it). */
    fun fetchSnapshot(config: PcBridgeConfig, sinceEpochMs: Long = 0L): String {
        val query = if (sinceEpochMs > 0) "?since=$sinceEpochMs" else ""
        val connection = newConnection(config, "/api/tablet/snapshot$query", "GET")
        return try {
            val code = connection.responseCode
            if (code in 200..299) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
            }
        } catch (e: Exception) {
            e.message ?: e.javaClass.simpleName
        } finally {
            connection.disconnect()
        }
    }
}

/** Credentials the tablet uses to talk to the café PC ledger. */
data class PcBridgeConfig(
    val baseUrl: String,
    val deviceId: String,
    val secret: String
)
