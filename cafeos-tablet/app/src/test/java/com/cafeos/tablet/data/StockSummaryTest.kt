package com.cafeos.tablet.data

import org.junit.Assert.assertEquals
import org.junit.Test

class StockSummaryTest {

    private fun ing(stock: Double, min: Double, cost: Double = 1.0, baseUnit: String = "g") =
        Ingredient(name = "x", baseUnit = baseUnit, currentStock = stock, minStock = min, costPerUnit = cost)

    @Test
    fun boundaryStockEqualToThresholdIsLow() {
        assertEquals("low", StockSummaryRule.classify(5.0, 5.0))
        assertEquals("low", StockSummaryRule.classify(1.0, 5.0))
    }

    @Test
    fun zeroOrNegativeIsOutAndAboveThresholdIsHealthy() {
        assertEquals("out", StockSummaryRule.classify(0.0, 5.0))
        assertEquals("out", StockSummaryRule.classify(-3.0, 5.0))
        assertEquals("healthy", StockSummaryRule.classify(6.0, 5.0))
    }

    @Test
    fun summarizeCountsAndValues() {
        val ingredients = listOf(
            ing(stock = 10.0, min = 5.0, cost = 2.0),   // healthy
            ing(stock = 4.0, min = 5.0, cost = 3.0),    // low
            ing(stock = 0.0, min = 5.0, cost = 9.0)     // out (value excluded)
        )
        val summary = StockSummaryRule.summarize(ingredients)
        assertEquals(1, summary.healthy)
        assertEquals(1, summary.low)
        assertEquals(1, summary.out)
        assertEquals(3, summary.totalCount)
        assertEquals(10.0 * 2.0 + 4.0 * 3.0, summary.totalValue, 0.0001)
    }

    @Test
    fun emptyListSummarizesToZeros() {
        val summary = StockSummaryRule.summarize(emptyList())
        assertEquals(0, summary.healthy)
        assertEquals(0, summary.low)
        assertEquals(0, summary.out)
        assertEquals(0.0, summary.totalValue, 0.0001)
    }
}
