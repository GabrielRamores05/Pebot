package com.cafeos.tablet.data

/**
 * Price-change math for purchase history and supplier pages (spec 014, US2/US3).
 * Pure so it is unit-testable on the JVM and shared by every trend UI; "previous"
 * is the immediately preceding non-void purchase (row-id order = ledger order).
 */
data class PriceChange(
    val latest: Double,
    val previous: Double,
    val delta: Double,      // latest - previous (₱, rounded to 2dp)
    val percent: Double     // delta / previous * 100 (rounded to 2dp; 0 when previous == 0)
)

object PriceTrends {

    /** Returns null when there is no previous purchase to compare against. */
    fun change(previousUnitCost: Double?, latestUnitCost: Double): PriceChange? {
        val previous = previousUnitCost ?: return null
        val delta = round2(latestUnitCost - previous)
        val percent = if (previous == 0.0) 0.0 else round2(delta / previous * 100.0)
        return PriceChange(latest = round2(latestUnitCost), previous = previous, delta = delta, percent = percent)
    }

    fun round2(value: Double): Double = (kotlin.math.round(value * 100.0)) / 100.0
}
