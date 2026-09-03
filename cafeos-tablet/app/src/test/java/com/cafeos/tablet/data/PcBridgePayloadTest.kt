package com.cafeos.tablet.data

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PcBridgePayloadTest {

    private fun sampleOrder() = Order(
        id = 42,
        orderNumber = "P1234-000007",
        customerName = "Maya",
        status = "PENDING",
        totalAmount = 250.0,
        discountAmount = 50.0,
        discountReason = "VOUCHER-CODE",
        paymentMethod = "GCASH",
        orderType = "DINE_IN",
        tableId = 3,
        tableLocation = "Indoor / 3",
        deliveryAddress = null,
        notes = "No ice",
        loyaltyCustomerName = "Maya"
    )

    private fun sampleItem(id: Int, orderId: Int) = OrderItem(
        id = id,
        orderId = orderId,
        productId = 7,
        quantity = 2,
        unitPrice = 120.0,
        subtotal = 250.0,
        notes = "extra hot"
    )

    private fun sampleOptions(itemId: Int) = listOf(
        OrderOption(orderItemId = itemId, name = "Size", value = "Large", priceDelta = 30.0)
    )

    @Test
    fun orderPayloadCarriesIdentityAndItemsButNeverClientPesoDiscounts() {
        val order = sampleOrder()
        val items = listOf(sampleItem(1, order.id))
        val payload = PcBridgeClient.orderPayload(
            order = order,
            items = items,
            itemOptions = mapOf(1 to sampleOptions(1)),
            productNames = mapOf(7 to "Hot Coffee"),
            payment = Payment(orderId = order.id, method = "GCASH", amount = 250.0, amountTendered = 250.0, change = 0.0)
        )

        assertEquals("P1234-000007", (payload["orderNumber"] as JsonPrimitive).content)
        assertEquals(42, (payload["tabletOrderId"] as JsonPrimitive).content.toInt())
        assertEquals("VOUCHER-CODE", (payload["discountReason"] as JsonPrimitive).content)
        assertEquals("Maya", (payload["loyaltyCustomerName"] as JsonPrimitive).content)

        // The payload must not send a derived peso discount — the PC recomputes.
        assertTrue(payload.keys.none { it == "discountAmount" || it == "totalAmount" })

        val itemsArr = payload["items"] as JsonArray
        assertEquals(1, itemsArr.size)
        val item = itemsArr[0] as JsonObject
        assertEquals(7, (item["productId"] as JsonPrimitive).content.toInt())
        assertEquals("Hot Coffee", (item["productName"] as JsonPrimitive).content)
        assertEquals(2, (item["quantity"] as JsonPrimitive).content.toInt())
        val opts = item["options"] as JsonArray
        assertEquals(1, opts.size)
        assertEquals("Large", ((opts[0] as JsonObject)["value"] as JsonPrimitive).content)

        val payment = payload["payment"] as JsonObject
        assertEquals(250.0, (payment["amount"] as JsonPrimitive).content.toDouble(), 0.001)
    }

    @Test
    fun statusAndStockPayloadsAreWellFormedAndSerializable() {
        val status = PcBridgeClient.serialize(PcBridgeClient.statusPayload("INV-000009", "PREPARING"))
        assertTrue(status.contains("\"orderNumber\":\"INV-000009\""))
        assertTrue(status.contains("\"status\":\"PREPARING\""))

        val stock = PcBridgeClient.serialize(PcBridgeClient.stockPayload(4, -20.0, "waste"))
        assertTrue(stock.contains("\"ingredientId\":4"))
        assertTrue(stock.contains("\"delta\":-20.0"))
    }

    @Test
    fun eventTypeConstantsCoverTheOutbox() {
        val all = listOf(
            PcBridgeClient.Events.ORDER_PLACED,
            PcBridgeClient.Events.ORDER_STATUS,
            PcBridgeClient.Events.STOCK_ADJUST,
            PcBridgeClient.Events.ATTENDANCE,
            PcBridgeClient.Events.AUDIT
        )
        assertEquals(5, all.toSet().size)
        assertEquals("ORDER_PLACED", PcBridgeClient.Events.ORDER_PLACED)
    }

    @Test
    fun ingredientPayloadCarriesLastSupplierId() {
        val withSupplier = Ingredient(id = 12, name = "Beans", baseUnit = "g", costPerUnit = 0.5, lastSupplierId = 3)
        val payload = PcBridgeClient.ingredientPayload(withSupplier)

        assertEquals(12, (payload["ingredientId"] as JsonPrimitive).content.toInt())
        assertEquals("Beans", (payload["name"] as JsonPrimitive).content)
        assertEquals("g", (payload["baseUnit"] as JsonPrimitive).content)
        assertEquals(0.5, (payload["costPerUnit"] as JsonPrimitive).content.toDouble(), 0.001)
        assertEquals(3, (payload["lastSupplierId"] as JsonPrimitive).content.toInt())

        val neverPurchased = Ingredient(id = 13, name = "Milk", baseUnit = "ml", lastSupplierId = null)
        val bare = PcBridgeClient.ingredientPayload(neverPurchased)
        assertTrue(bare.keys.none { it == "lastSupplierId" })
    }

    @Test
    fun transactionPayloadCarriesSupplierLinkageAndVoidType() {
        val purchase = IngredientTransaction(
            id = 7,
            ingredientId = 12,
            type = "PURCHASE",
            quantity = 5000.0,
            referenceType = "supplier",
            referenceId = 3,
            purchaseUnit = "kg",
            purchaseCost = 2750.0,
            unitCost = 0.55,
            notes = "Arabica 5kg sack"
        )
        val p = PcBridgeClient.transactionPayload(purchase)
        assertEquals(7, (p["transactionId"] as JsonPrimitive).content.toInt())
        assertEquals(12, (p["ingredientId"] as JsonPrimitive).content.toInt())
        assertEquals("PURCHASE", (p["type"] as JsonPrimitive).content)
        assertEquals(5000.0, (p["quantity"] as JsonPrimitive).content.toDouble(), 0.001)
        assertEquals("supplier", (p["referenceType"] as JsonPrimitive).content)
        assertEquals(3, (p["referenceId"] as JsonPrimitive).content.toInt())
        assertEquals(0.55, (p["unitCost"] as JsonPrimitive).content.toDouble(), 0.001)

        // A VOID row flows through with its compensating type and void-of link.
        val voidRow = IngredientTransaction(
            id = 8,
            ingredientId = 12,
            type = "VOID_PURCHASE",
            quantity = -5000.0,
            referenceType = "void-of",
            referenceId = 7,
            createdAt = 8L
        )
        val v = PcBridgeClient.transactionPayload(voidRow)
        assertEquals("VOID_PURCHASE", (v["type"] as JsonPrimitive).content)
        assertEquals("void-of", (v["referenceType"] as JsonPrimitive).content)
        assertEquals(7, (v["referenceId"] as JsonPrimitive).content.toInt())
        assertEquals(-5000.0, (v["quantity"] as JsonPrimitive).content.toDouble(), 0.001)

        // A supplierless purchase omits the reference keys entirely.
        val supplierless = PcBridgeClient.transactionPayload(
            IngredientTransaction(id = 9, ingredientId = 12, type = "PURCHASE", quantity = 100.0, createdAt = 9L)
        )
        assertTrue(supplierless.keys.none { it == "referenceType" || it == "referenceId" })
    }

    @Test
    fun inventorySnapshotPayloadGroupsIngredientsBeforeTransactionsAndSerializes() {
        val ingredients = listOf(
            Ingredient(id = 12, name = "Beans", baseUnit = "g", lastSupplierId = 3)
        )
        val transactions = listOf(
            IngredientTransaction(id = 7, ingredientId = 12, type = "PURCHASE", quantity = 5000.0, referenceType = "supplier", referenceId = 3, createdAt = 7L),
            IngredientTransaction(id = 8, ingredientId = 12, type = "VOID_PURCHASE", quantity = -5000.0, referenceType = "void-of", referenceId = 7, createdAt = 8L)
        )

        val payload = PcBridgeClient.inventorySnapshotPayload(ingredients, transactions)
        val ingredientsArr = payload["ingredients"] as JsonArray
        val transactionsArr = payload["ingredientTransactions"] as JsonArray
        assertEquals(1, ingredientsArr.size)
        assertEquals(2, transactionsArr.size)
        assertEquals(3, ((ingredientsArr[0] as JsonObject)["lastSupplierId"] as JsonPrimitive).content.toInt())
        assertEquals("VOID_PURCHASE", ((transactionsArr[1] as JsonObject)["type"] as JsonPrimitive).content)

        val serialized = PcBridgeClient.serialize(payload)
        assertTrue(serialized.contains("\"ingredients\""))
        assertTrue(serialized.contains("\"ingredientTransactions\""))
        assertTrue(serialized.contains("\"VOID_PURCHASE\""))
        assertTrue(serialized.contains("\"lastSupplierId\":3"))
    }
}
