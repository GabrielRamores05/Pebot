package com.cafeos.tablet.data

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * PIN hashing for staff credentials.
 *
 * Staff PINs are 6-digit secrets, but they are still credentials: they gate the
 * staff/admin surfaces on the tablet, so they must never be stored in plaintext.
 *
 * Storage format: `pbkdf2:<iterations>:<saltBase64>:<hashBase64>`
 * (PBKDF2WithHmacSHA256, 16-byte random salt, 256-bit key).
 *
 * Legacy rows created before this module existed store the raw PIN; [matches]
 * detects and accepts those so the owner is not locked out, and the caller
 * ([CafeViewModel.authenticateStaff]) upgrades them on first successful login.
 */
object PinHasher {
    private const val PREFIX = "pbkdf2:"
    private const val ALGORITHM = "PBKDF2WithHmacSHA256"
    private const val KEY_LENGTH_BITS = 256
    private const val SALT_BYTES = 16
    const val DEFAULT_ITERATIONS = 20_000

    private val secureRandom = SecureRandom()

    fun hash(pin: String, iterations: Int = DEFAULT_ITERATIONS): String {
        require(pin.isNotEmpty()) { "PIN must not be empty" }
        val salt = ByteArray(SALT_BYTES).also { secureRandom.nextBytes(it) }
        val hash = derive(pin, salt, iterations)
        val encoder = java.util.Base64.getEncoder()
        return "$PREFIX$iterations:${encoder.encodeToString(salt)}:${encoder.encodeToString(hash)}"
    }

    /** True when [stored] was produced by [hash] (as opposed to a legacy plaintext PIN). */
    fun isHashed(stored: String?): Boolean = stored != null && stored.startsWith(PREFIX)

    /**
     * Verifies [pin] against [stored]. Returns true when [stored] is a modern
     * PBKDF2 hash that matches, or a legacy plaintext PIN that equals [pin]
     * (caller decides whether/how to upgrade).
     */
    fun matches(pin: String, stored: String?): Boolean {
        if (stored == null) return false
        if (isHashed(stored)) {
            return try {
                val parts = stored.removePrefix(PREFIX).split(':')
                if (parts.size != 3) return false
                val iterations = parts[0].toIntOrNull() ?: return false
                val decoder = java.util.Base64.getDecoder()
                val salt = decoder.decode(parts[1])
                val expected = decoder.decode(parts[2])
                val actual = derive(pin, salt, iterations)
                MessageDigest.isEqual(actual, expected)
            } catch (_: IllegalArgumentException) {
                false
            }
        }
        // Legacy plaintext row (pre-hashing builds).
        return constantTimeEquals(pin, stored)
    }

    private fun derive(pin: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(pin.toCharArray(), salt, iterations, KEY_LENGTH_BITS)
        return try {
            SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun constantTimeEquals(a: String, b: String): Boolean =
        MessageDigest.isEqual(a.toByteArray(Charsets.UTF_8), b.toByteArray(Charsets.UTF_8))
}
