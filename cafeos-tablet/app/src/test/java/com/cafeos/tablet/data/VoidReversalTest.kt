package com.cafeos.tablet.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Void-reversal decision tests (spec 014 FR-009, T026/T028). Cases mirror the
 * data-model state transitions and quickstart QS-4:
 * voiding the ONLY purchase, the LATEST non-void purchase, an OLDER purchase,
 * and VOID rows never counting as a latest/previous purchase.
 */
class VoidReversalTest {

    private fun purchase(
        id: Int,
        cost: Double? = null,
        supplierId: Int? = null,
        referenceType: String? = "supplier"
    ) = IngredientTransaction(
        id = id,
        ingredientId = 1,
        type = "PURCHASE",
        quantity = 1000.0,
        referenceId = supplierId,
        referenceType = if (supplierId == null && referenceType == "supplier") null else referenceType,
        unitCost = cost,
        createdAt = id.toLong()
    )

    private fun voidOf(purchaseId: Int, id: Int) = IngredientTransaction(
        id = id,
        ingredientId = 1,
        type = "VOID_PURCHASE",
        quantity = -1000.0,
        referenceId = purchaseId,
        referenceType = "void-of",
        createdAt = id.toLong()
    )

    @Test
    fun voidingTheOnlyPurchaseRollsCostAndSupplierToNone() {
        // One purchase ever (no previous non-void purchase to fall back to).
        val ledger = listOf(purchase(id = 1, cost = 0.5, supplierId = 7))

        val plan = VoidReversal.plan(ledger, voidedId = 1)

        assertTrue(plan.voidedIsLatest)
        assertNull(plan.previousUnitCost)
        assertNull(plan.previousSupplierId)
    }

    @Test
    fun voidingTheLatestPurchaseRollsBackToPreviousNonVoidPurchase() {
        // P1 (Acme, .40) then P2 (Beans & Co, .50); P1 is voided afterwards,
        // so a VOID row (id 3) sits above P2 — it must never become "latest".
        val ledger = listOf(
            purchase(id = 1, cost = 0.4, supplierId = 7),
            purchase(id = 2, cost = 0.5, supplierId = 9),
            voidOf(purchaseId = 1, id = 3)
        )

        val plan = VoidReversal.plan(ledger, voidedId = 2)

        assertTrue(plan.voidedIsLatest)
        assertEquals(0.4, plan.previousUnitCost!!, 0.0001)
        assertEquals(7, plan.previousSupplierId!!)
    }

    @Test
    fun voidingTheLatestWhenThereIsNoPreviousRollsToNone() {
        // Only one real purchase row remains (any other row is a VOID).
        val ledger = listOf(
            purchase(id = 1, cost = 0.4, supplierId = 7),
            voidOf(purchaseId = 2, id = 2) // void of a now-absent purchase
        )

        val plan = VoidReversal.plan(ledger, voidedId = 1)

        assertTrue(plan.voidedIsLatest)
        assertNull(plan.previousUnitCost)
        assertNull(plan.previousSupplierId)
    }

    @Test
    fun voidingAnOlderPurchaseIsStockOnly() {
        // P1 is older than P2, so voiding P1 must not touch cost/latest supplier.
        val ledger = listOf(
            purchase(id = 1, cost = 0.3, supplierId = 5),
            purchase(id = 2, cost = 0.4, supplierId = 7),
            purchase(id = 3, cost = 0.5, supplierId = 9)
        )

        val plan = VoidReversal.plan(ledger, voidedId = 2)

        assertFalse(plan.voidedIsLatest)
    }

    @Test
    fun voidRowsAreNeverTheLatestPurchase() {
        // VOID rows can have the highest row ids; the newest PURCHASE row still
        // governs what "latest" and "previous" mean.
        val ledger = listOf(
            purchase(id = 1, cost = 0.4, supplierId = 7),
            purchase(id = 2, cost = 0.5, supplierId = 9),
            voidOf(purchaseId = 1, id = 10),
            voidOf(purchaseId = 2, id = 11)
        )

        val purchases = VoidReversal.purchaseRows(ledger)
        assertEquals(listOf(1, 2), purchases.map { it.id })
        assertTrue(VoidReversal.plan(ledger, voidedId = 2).voidedIsLatest)
        assertFalse(VoidReversal.plan(ledger, voidedId = 1).voidedIsLatest)
    }

    @Test
    fun previousScanSkipsUnpricedAndSupplierlessRows() {
        // An unpriced legacy purchase is not a "previous unit cost", and a
        // supplierless purchase is not a "previous supplier".
        val ledger = listOf(
            purchase(id = 1, cost = null, supplierId = null, referenceType = null), // legacy unpriced
            purchase(id = 2, cost = 0.4, supplierId = null, referenceType = null),  // supplierless priced
            purchase(id = 3, cost = 0.5, supplierId = 9)
        )

        val plan = VoidReversal.plan(ledger, voidedId = 3)

        assertTrue(plan.voidedIsLatest)
        assertEquals(0.4, plan.previousUnitCost!!, 0.0001)      // skips unpriced id 1
        assertNull(plan.previousSupplierId)                     // skips supplierless id 2
    }

    @Test
    fun nonPurchaseOrUnknownVoidTargetIsNotLatest() {
        val ledger = listOf(purchase(id = 1, cost = 0.4, supplierId = 7))
        assertFalse(VoidReversal.plan(ledger, voidedId = 999).voidedIsLatest)

        val onlyVoid = listOf(voidOf(purchaseId = 1, id = 2))
        assertFalse(VoidReversal.plan(onlyVoid, voidedId = 2).voidedIsLatest)
        assertTrue(VoidReversal.purchaseRows(onlyVoid).isEmpty())
    }
}
