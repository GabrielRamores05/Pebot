package com.cafeos.tablet.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PurchaseUnitsTest {

    @Test
    fun kilogramsConvertToGrams() {
        assertEquals(2000.0, PurchaseUnits.toBaseQuantity("g", "kg", 2.0)!!, 0.0001)
    }

    @Test
    fun gramsAreIdentity() {
        assertEquals(5.0, PurchaseUnits.toBaseQuantity("g", "g", 5.0)!!, 0.0001)
    }

    @Test
    fun litersConvertToMilliliters() {
        assertEquals(1500.0, PurchaseUnits.toBaseQuantity("ml", "l", 1.5)!!, 0.0001)
    }

    @Test
    fun piecesAreIdentity() {
        assertEquals(3.0, PurchaseUnits.toBaseQuantity("pcs", "pcs", 3.0)!!, 0.0001)
    }

    @Test
    fun unsupportedUnitPairReturnsNull() {
        assertNull(PurchaseUnits.toBaseQuantity("g", "l", 1.0))
        assertNull(PurchaseUnits.toBaseQuantity("pcs", "kg", 1.0))
        assertFalse(PurchaseUnits.canConvert("g", "l"))
    }

    @Test
    fun nonPositiveQuantityReturnsNull() {
        assertNull(PurchaseUnits.toBaseQuantity("g", "kg", 0.0))
        assertNull(PurchaseUnits.toBaseQuantity("g", "kg", -5.0))
    }

    @Test
    fun unitCostDividesTotalByConvertedBaseQuantity() {
        // 2 kg for ₱1,000 -> 2,000 g at ₱0.50/g
        assertEquals(0.50, PurchaseUnits.unitCost("g", "kg", 2.0, 1000.0)!!, 0.0001)
    }

    @Test
    fun unitCostRequiresValidInputs() {
        assertNull(PurchaseUnits.unitCost("g", "kg", 0.0, 1000.0))
        assertNull(PurchaseUnits.unitCost("g", "kg", 2.0, -1.0))
        assertNull(PurchaseUnits.unitCost("g", "l", 2.0, 100.0))
    }

    @Test
    fun optionsFollowBaseUnit() {
        assertTrue(PurchaseUnits.purchaseUnitOptions("g").contains("kg"))
        assertTrue(PurchaseUnits.purchaseUnitOptions("ml").contains("l"))
        assertEquals(listOf("pcs"), PurchaseUnits.purchaseUnitOptions("pcs"))
        assertTrue(PurchaseUnits.purchaseUnitOptions("other").isEmpty())
    }
}
