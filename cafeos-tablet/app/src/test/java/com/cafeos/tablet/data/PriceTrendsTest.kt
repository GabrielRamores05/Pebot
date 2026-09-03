package com.cafeos.tablet.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class PriceTrendsTest {

    @Test
    fun firstPurchaseHasNoComparison() {
        assertNull(PriceTrends.change(null, 0.5))
    }

    @Test
    fun equalPricesShowZeroChange() {
        val change = PriceTrends.change(0.5, 0.5)
        assertNotNull(change)
        assertEquals(0.0, change!!.delta, 0.0001)
        assertEquals(0.0, change.percent, 0.0001)
    }

    @Test
    fun increaseComputesDeltaAndPercent() {
        val change = PriceTrends.change(0.4, 0.5)
        assertNotNull(change)
        assertEquals(0.1, change!!.delta, 0.0001)
        assertEquals(25.0, change.percent, 0.0001)
    }

    @Test
    fun decreaseComputesNegativeDeltaAndPercent() {
        val change = PriceTrends.change(0.5, 0.4)
        assertNotNull(change)
        assertEquals(-0.1, change!!.delta, 0.0001)
        assertEquals(-20.0, change.percent, 0.0001)
    }

    @Test
    fun previousZeroYieldsZeroPercentButRealDelta() {
        val change = PriceTrends.change(0.0, 0.75)
        assertNotNull(change)
        assertEquals(0.75, change!!.delta, 0.0001)
        assertEquals(0.0, change.percent, 0.0001)
    }
}
