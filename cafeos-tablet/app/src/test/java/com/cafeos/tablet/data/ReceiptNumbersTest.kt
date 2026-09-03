package com.cafeos.tablet.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReceiptNumbersTest {

    @Test
    fun canonicalFormatPadsToSixDigits() {
        assertEquals("INV-000007", ReceiptNumbers.format("INV", 7))
        assertEquals("INV-000001", ReceiptNumbers.format("INV", 1))
        assertEquals("R-001000", ReceiptNumbers.format("R", 1000))
    }

    @Test
    fun provisionalPrefixIsStableAndShort() {
        val first = ReceiptNumbers.provisionalPrefix("a1b2c3d4-0000-4abc-9def-0123456789ab")
        val again = ReceiptNumbers.provisionalPrefix("a1b2c3d4-0000-4abc-9def-0123456789ab")
        assertEquals(first, again)
        assertTrue(first.length in 2..6)
        // Different devices get different prefixes.
        val other = ReceiptNumbers.provisionalPrefix("ffffffff-0000-4abc-9def-0123456789ac")
        assertFalse(first == other)
    }

    @Test
    fun provisionalDetection() {
        assertTrue(ReceiptNumbers.isProvisional("P3F2-000001"))
        assertTrue(ReceiptNumbers.isProvisional("PX-000002"))
        assertFalse(ReceiptNumbers.isProvisional("INV-000007"))
        assertFalse(ReceiptNumbers.isProvisional("WEB-0710112233"))
    }
}
