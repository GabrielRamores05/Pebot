package com.cafeos.tablet.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Snapshot import mapping rules (spec 014 T025;
 * `contracts/bridge-schema.md`): a purchase row referencing an unknown
 * supplier keeps its row but its supplier link is cleared — never dropped;
 * legacy rows without the reference fields import unchanged (supplierless);
 * void/batch rows never lose their linkage to a supplier id.
 */
class SnapshotImportRulesTest {

    private fun purchase(
        id: Int,
        supplierId: Int? = 3,
        referenceType: String? = "supplier",
        cost: Double? = 0.5,
        unit: String = "g"
    ) = IngredientTransaction(
        id = id,
        ingredientId = 1,
        type = "PURCHASE",
        quantity = 1000.0,
        referenceId = supplierId,
        referenceType = referenceType,
        purchaseUnit = unit,
        purchaseCost = 500.0,
        unitCost = cost,
        notes = "delivery",
        createdAt = id.toLong()
    )

    @Test
    fun purchaseReferencingUnknownSupplierKeepsRowButClearsLink() {
        val txn = purchase(id = 5, supplierId = 42)

        val resolved = SnapshotImportRules.resolveSupplierLink(txn) { it != 42 }

        // Row survives with every purchase field intact...
        assertEquals(5, resolved.id)
        assertEquals("PURCHASE", resolved.type)
        assertEquals(1000.0, resolved.quantity, 0.0001)
        assertEquals("g", resolved.purchaseUnit)
        assertEquals(500.0, resolved.purchaseCost!!, 0.0001)
        assertEquals(0.5, resolved.unitCost!!, 0.0001)
        assertEquals("delivery", resolved.notes)
        // ...but its supplier link is cleared (never a broken reference).
        assertNull(resolved.referenceType)
        assertNull(resolved.referenceId)
    }

    @Test
    fun purchaseReferencingKnownSupplierKeepsItsLink() {
        val txn = purchase(id = 5, supplierId = 3)

        val resolved = SnapshotImportRules.resolveSupplierLink(txn) { it == 3 }

        assertSame(txn, resolved)
        assertEquals("supplier", resolved.referenceType)
        assertEquals(3, resolved.referenceId!!.toInt())
    }

    @Test
    fun legacyRowWithoutReferenceFieldsImportsUnchanged() {
        val legacy = IngredientTransaction(
            id = 7,
            ingredientId = 1,
            type = "ADJUSTMENT",
            quantity = -50.0,
            referenceId = null,
            referenceType = null,
            createdAt = 7L
        )

        val resolved = SnapshotImportRules.resolveSupplierLink(legacy) { false }

        assertSame(legacy, resolved)
        assertNull(resolved.referenceType)
        assertNull(resolved.referenceId)
    }

    @Test
    fun voidAndBatchRowsAreNeverTreatedAsSupplierLinks() {
        val voidRow = IngredientTransaction(
            id = 8,
            ingredientId = 1,
            type = "VOID_PURCHASE",
            quantity = -1000.0,
            referenceId = 5,
            referenceType = "void-of",
            createdAt = 8L
        )
        val batchRow = IngredientTransaction(
            id = 9,
            ingredientId = 2,
            type = "ADJUSTMENT",
            quantity = 200.0,
            referenceType = "batch",
            notes = "bulk-123",
            createdAt = 9L
        )

        // Even though 5 and 9 would be unknown as suppliers, neither row's
        // linkage refers to a supplier, so nothing is cleared.
        assertSame(voidRow, SnapshotImportRules.resolveSupplierLink(voidRow) { false })
        assertSame(batchRow, SnapshotImportRules.resolveSupplierLink(batchRow) { false })
    }

    @Test
    fun ingredientLatestSupplierCacheIsClearedOnlyWhenSupplierUnknown() {
        val kept = Ingredient(name = "Beans", baseUnit = "g", lastSupplierId = 3)
        assertSame(kept, SnapshotImportRules.resolveLatestSupplier(kept) { it == 3 })

        val cleared = Ingredient(name = "Beans", baseUnit = "g", lastSupplierId = 42)
        val resolved = SnapshotImportRules.resolveLatestSupplier(cleared) { it != 42 }
        assertNull(resolved.lastSupplierId)
        assertEquals("Beans", resolved.name)

        val neverPurchased = Ingredient(name = "Milk", baseUnit = "ml", lastSupplierId = null)
        assertSame(neverPurchased, SnapshotImportRules.resolveLatestSupplier(neverPurchased) { false })
    }
}
