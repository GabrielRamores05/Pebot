package com.cafeos.tablet.data

/**
 * Pure void-reversal decision (spec 014 FR-009, T026/T028). A purchase is
 * corrected by appending a compensating `VOID_PURCHASE` row — the original row
 * is never modified. Stock always reverses. The ingredient's cached latest unit
 * cost / latest supplier are rolled back to the previous **non-void** purchase
 * only when the voided purchase IS the latest non-void purchase; voiding an
 * older purchase leaves cost/latest supplier untouched. Pure so it is
 * unit-testable on the JVM and shared by the transactional ViewModel writer.
 *
 * "Latest / previous" are computed in row-id order (= ledger order) over
 * `PURCHASE` rows only, so `VOID_PURCHASE` rows are never a data point and can
 * never shadow a real purchase.
 */
data class VoidReversalPlan(
    /** True when the voided row is the newest non-void PURCHASE row. */
    val voidedIsLatest: Boolean,
    /** Unit cost of the previous non-void priced purchase (null = none yet). */
    val previousUnitCost: Double?,
    /** Supplier of the previous non-void supplier-linked purchase (null = none yet). */
    val previousSupplierId: Int?
)

object VoidReversal {

    /**
     * PURCHASE rows of an ingredient's ledger in row-id (ledger) order.
     * Every other row type — VOID_PURCHASE, ADJUSTMENT, USAGE, OPENING — is
     * excluded, which is exactly what latest/trend consumers must do.
     */
    fun purchaseRows(ledger: List<IngredientTransaction>): List<IngredientTransaction> =
        ledger.filter { it.type == "PURCHASE" }.sortedBy { it.id }

    /**
     * Decides what voiding the purchase with id [voidedId] does to the cached
     * cost/latest supplier, given that ingredient's full [ledger] (all types).
     * Returns [VoidReversalPlan] with the rollback values, or a plan whose
     * `voidedIsLatest` is false when [voidedId] is not a PURCHASE row.
     */
    fun plan(ledger: List<IngredientTransaction>, voidedId: Int): VoidReversalPlan {
        val purchases = purchaseRows(ledger)
        val voided = purchases.firstOrNull { it.id == voidedId }
            ?: return VoidReversalPlan(voidedIsLatest = false, previousUnitCost = null, previousSupplierId = null)
        val latest = purchases.lastOrNull()
        val voidedIsLatest = latest != null && latest.id == voided.id
        // Rows written before the voided row — the only candidates for "previous".
        val earlier = purchases.filter { it.id < voided.id }
        val previousUnitCost = earlier.lastOrNull { it.unitCost != null }?.unitCost
        val previousSupplierId = earlier.lastOrNull { it.referenceType == "supplier" && it.referenceId != null }?.referenceId
        return VoidReversalPlan(voidedIsLatest, previousUnitCost, previousSupplierId)
    }
}
