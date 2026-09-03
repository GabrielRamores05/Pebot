package com.cafeos.tablet.data

/**
 * Purchase-unit conversion (spec 014). Staff buy ingredients in real-world
 * units (grams, kilograms, liters, milliliters, pieces); stock is kept in the
 * ingredient's base unit. Unit cost is always total ÷ converted base quantity —
 * this is the single conversion used by previews and by persistence so the two
 * can never disagree (constitution §III "one total, one place it is computed").
 */
object PurchaseUnits {

    /** Human labels offered for a given base unit (display order). */
    fun purchaseUnitOptions(baseUnit: String): List<String> = when (normalize(baseUnit)) {
        "g" -> listOf("g", "kg")
        "ml" -> listOf("ml", "l")
        "pcs" -> listOf("pcs")
        else -> emptyList()
    }

    /** Whether a purchase unit can be expressed in the ingredient's base unit. */
    fun canConvert(baseUnit: String, purchaseUnit: String): Boolean =
        conversionFactor(baseUnit, purchaseUnit) != null

    /**
     * Converts [quantity] expressed in [purchaseUnit] into [baseUnit] amounts.
     * Returns null when the pair is unsupported or the quantity is not positive.
     */
    fun toBaseQuantity(baseUnit: String, purchaseUnit: String, quantity: Double): Double? {
        if (!quantity.isFinite() || quantity <= 0.0) return null
        val factor = conversionFactor(baseUnit, purchaseUnit) ?: return null
        val converted = quantity * factor
        return if (converted.isFinite()) converted else null
    }

    /** Unit cost per base unit from a purchase; null when nothing valid to derive. */
    fun unitCost(baseUnit: String, purchaseUnit: String, quantity: Double, totalCost: Double): Double? {
        if (!totalCost.isFinite() || totalCost < 0.0) return null
        val base = toBaseQuantity(baseUnit, purchaseUnit, quantity) ?: return null
        return totalCost / base
    }

    private fun conversionFactor(baseUnit: String, purchaseUnit: String): Double? {
        val base = normalize(baseUnit)
        val unit = normalize(purchaseUnit)
        return when (base) {
            "g" -> when (unit) {
                "g", "gram", "grams" -> 1.0
                "kg", "kilo", "kilogram", "kilograms", "kilos" -> 1000.0
                else -> null
            }
            "ml" -> when (unit) {
                "ml", "milliliter", "milliliters" -> 1.0
                "l", "liter", "liters", "litre", "litres" -> 1000.0
                else -> null
            }
            "pcs" -> when (unit) {
                "pcs", "pc", "piece", "pieces", "unit", "units" -> 1.0
                else -> null
            }
            else -> null
        }
    }

    private fun normalize(value: String): String = value.trim().lowercase()
}
