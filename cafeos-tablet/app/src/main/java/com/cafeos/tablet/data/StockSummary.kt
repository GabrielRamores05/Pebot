package com.cafeos.tablet.data

/** Inventory summary (spec 014, US5): counts + stock value from one shared rule. */
data class StockSummary(
    val healthy: Int,
    val low: Int,
    val out: Int,
    val totalValue: Double,
    val totalCount: Int
)

object StockSummaryRule {

    /**
     * Shared low/out classification (data-model invariants):
     * healthy = currentStock > minStock; low = 0 < currentStock <= minStock
     * (equal to the threshold is LOW); out = currentStock <= 0.
     */
    fun classify(currentStock: Double, minStock: Double): String =
        when {
            currentStock <= 0.0 -> "out"
            currentStock <= minStock -> "low"
            else -> "healthy"
        }

    fun summarize(ingredients: List<Ingredient>): StockSummary {
        var healthy = 0
        var low = 0
        var out = 0
        var value = 0.0
        for (ingredient in ingredients) {
            when (classify(ingredient.currentStock, ingredient.minStock)) {
                "out" -> out++
                "low" -> low++
                else -> healthy++
            }
            if (ingredient.currentStock > 0.0) {
                value += ingredient.currentStock * ingredient.costPerUnit
            }
        }
        return StockSummary(
            healthy = healthy,
            low = low,
            out = out,
            totalValue = kotlin.math.round(value * 100.0) / 100.0,
            totalCount = ingredients.size
        )
    }
}
