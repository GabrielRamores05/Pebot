package com.cafeos.tablet.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PinHasherTest {

    @Test
    fun hashProducesPortablePrefixedFormatAndNeverThePlainPin() {
        val hash = PinHasher.hash("246810")
        assertTrue(hash.startsWith("pbkdf2:"))
        assertFalse(hash.contains("246810"))
        assertTrue(PinHasher.isHashed(hash))
    }

    @Test
    fun matchingPinVerifiesAndWrongPinFails() {
        val hash = PinHasher.hash("246810")
        assertTrue(PinHasher.matches("246810", hash))
        assertFalse(PinHasher.matches("000000", hash))
        assertFalse(PinHasher.matches("", hash))
    }

    @Test
    fun samePinHashesToDifferentValuesDueToSalt() {
        val first = PinHasher.hash("123456")
        val second = PinHasher.hash("123456")
        assertFalse(first == second)
    }

    @Test
    fun legacyPlaintextPinStillMatchesButIsFlaggedNotHashed() {
        // Pre-hashing builds stored the raw 6-digit PIN in the pin column.
        assertTrue(PinHasher.matches("123456", "123456"))
        assertFalse(PinHasher.matches("654321", "123456"))
        assertFalse(PinHasher.isHashed("123456"))
    }

    @Test
    fun tamperedStoredValueFails() {
        val hash = PinHasher.hash("112233")
        // Corrupt the trailing hash portion.
        val corrupted = hash.dropLast(2) + "AA"
        assertFalse(PinHasher.matches("112233", corrupted))
        // Malformed stored values never match.
        assertFalse(PinHasher.matches("112233", "pbkdf2:not-valid"))
        assertFalse(PinHasher.matches("112233", null))
    }
}
