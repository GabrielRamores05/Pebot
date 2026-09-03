package com.cafeos.tablet.data

/**
 * Import mapping rules for the shared export/import snapshot (spec 014 T025;
 * `specs/014-purchase-supplier-insights/contracts/bridge-schema.md`). Pure so
 * it is unit-testable on the JVM; `importAllData` applies it per ledger row.
 */
object SnapshotImportRules {

    /**
     * Applies the bridge-schema import rule to one ledger row: a purchase row
     * referencing a supplier that does not exist at the destination KEEPS its
     * row but its supplier link is cleared (`referenceType=null` and the
     * dangling `referenceId` is removed) — the record is never dropped. Legacy
     * rows without reference fields, VOID/void-of rows and batch adjustments
     * pass through unchanged (they never reference suppliers).
     *
     * [supplierExists] reports whether `referenceId` is a live Supplier id at
     * the destination (true → link is kept).
     */
    fun resolveSupplierLink(
        txn: IngredientTransaction,
        supplierExists: (Int) -> Boolean
    ): IngredientTransaction {
        val supplierId = txn.referenceId
        return when {
            txn.referenceType == "supplier" && supplierId != null && !supplierExists(supplierId) ->
                txn.copy(referenceType = null, referenceId = null)
            else -> txn
        }
    }

    /**
     * Same invariant applied to the ingredient's cached latest supplier: when
     * the snapshot references a supplier the destination does not have, the
     * cache is cleared instead of being left pointing at nothing (mirrors the
     * supplier-delete recompute/clear rule, T032).
     */
    fun resolveLatestSupplier(
        ingredient: Ingredient,
        supplierExists: (Int) -> Boolean
    ): Ingredient {
        val supplierId = ingredient.lastSupplierId ?: return ingredient
        return if (supplierExists(supplierId)) ingredient else ingredient.copy(lastSupplierId = null)
    }
}
