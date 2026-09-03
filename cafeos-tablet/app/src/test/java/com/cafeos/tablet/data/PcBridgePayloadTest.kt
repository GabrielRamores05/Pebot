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
}
