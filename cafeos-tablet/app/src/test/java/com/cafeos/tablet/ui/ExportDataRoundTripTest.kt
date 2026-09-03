package com.cafeos.tablet.ui

import com.cafeos.tablet.data.Ingredient
import com.cafeos.tablet.data.IngredientTransaction
import com.cafeos.tablet.data.Supplier
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * End-to-end snapshot serialization shape (spec 014 T025): export encodes with
 * `encodeDefaults = true` (as `exportAllData` does) and import decodes with
 * `ignoreUnknownKeys = true` (as `importAllData` does). This pins the shared
 * JSON to carry Ingredient.lastSupplierId, purchase rows' referenceType='supplier'/
 * referenceId, and VOID_PURCHASE rows with their type + void-of link.
 */
class ExportDataRoundTripTest {

    private val exportJson = Json { encodeDefaults = true }
    private val importJson = Json { ignoreUnknownKeys = true }

    @Test
    fun exportRoundTripsLastSupplierIdSupplierLinksAndVoidRows() {
        val supplier = Supplier(id = 3, name = "Acme Grains")
        val ingredient = Ingredient(
            id = 12,
            name = "Coffee Beans",
            baseUnit = "g",
            currentStock = 12000.0,
            costPerUnit = 0.55,
            lastSupplierId = 3
        )
        val purchase = IngredientTransaction(
            id = 7,
            ingredientId = 12,
            type = "PURCHASE",
            quantity = 2000.0,
            referenceType = "supplier",
            referenceId = 3,
            purchaseUnit = "kg",
            purchaseCost = 1100.0,
            unitCost = 0.55,
            createdAt = 7L
        )
        val voidRow = IngredientTransaction(
            id = 8,
            ingredientId = 12,
            type = "VOID_PURCHASE",
            quantity = -2000.0,
            referenceType = "void-of",
            referenceId = 7,
            createdAt = 8L
        )

        val exported = ExportData(
            version = 1,
            shopId = "tablet-001",
            exportedAt = 1L,
            categories = emptyList(),
            products = emptyList(),
            orders = emptyList(),
            orderItems = emptyList(),
            ingredients = listOf(ingredient),
            payments = emptyList(),
            customers = emptyList(),
            suppliers = listOf(supplier),
            tables = emptyList(),
            stations = emptyList(),
            optionGroups = emptyList(),
            productOptionGroups = emptyList(),
            options = emptyList(),
            expenses = emptyList(),
            ingredientTransactions = listOf(purchase, voidRow)
        )

        // Export side (mirrors exportAllData's JSON config): every new field is
        // actually present in the snapshot text.
        val jsonText = exportJson.encodeToString(exported)
        assertTrue(jsonText.contains("\"lastSupplierId\":3"))
        assertTrue(jsonText.contains("\"referenceType\":\"supplier\""))
        assertTrue(jsonText.contains("\"referenceId\":3"))
        assertTrue(jsonText.contains("\"VOID_PURCHASE\""))

        // Import side (mirrors importAllData's JSON config): fields survive the
        // round trip with their exact values.
        val decoded = importJson.decodeFromString<ExportData>(jsonText)
        assertEquals(3, decoded.ingredients.single().lastSupplierId!!)
        val purchaseBack = decoded.ingredientTransactions[0]
        assertEquals("PURCHASE", purchaseBack.type)
        assertEquals("supplier", purchaseBack.referenceType)
        assertEquals(3, purchaseBack.referenceId!!.toInt())
        assertEquals(0.55, purchaseBack.unitCost!!, 0.0001)
        val voidBack = decoded.ingredientTransactions[1]
        assertEquals("VOID_PURCHASE", voidBack.type)
        assertEquals("void-of", voidBack.referenceType)
        assertEquals(7, voidBack.referenceId!!.toInt())
        assertEquals(-2000.0, voidBack.quantity, 0.0001)
    }

    @Test
    fun supplierlessLegacyRowsRoundTripUnchanged() {
        val legacy = IngredientTransaction(
            id = 9,
            ingredientId = 12,
            type = "ADJUSTMENT",
            quantity = -50.0,
            referenceId = null,
            referenceType = null,
            createdAt = 9L
        )
        val exported = ExportData(
            version = 1,
            shopId = "tablet-001",
            exportedAt = 1L,
            categories = emptyList(),
            products = emptyList(),
            orders = emptyList(),
            orderItems = emptyList(),
            ingredients = emptyList(),
            payments = emptyList(),
            customers = emptyList(),
            suppliers = emptyList(),
            tables = emptyList(),
            stations = emptyList(),
            optionGroups = emptyList(),
            productOptionGroups = emptyList(),
            options = emptyList(),
            expenses = emptyList(),
            ingredientTransactions = listOf(legacy)
        )

        val back = importJson.decodeFromString<ExportData>(exportJson.encodeToString(exported))
        val row = back.ingredientTransactions.single()
        assertEquals("ADJUSTMENT", row.type)
        assertEquals(-50.0, row.quantity, 0.0001)
        assertNull(row.referenceType)
        assertNull(row.referenceId)
    }
}
