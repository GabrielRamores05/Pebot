package com.cafeos.tablet.data

/**
 * Receipt number helpers (spec 013; parity with the Windows receipt rules).
 *
 * Canonical receipts are assigned by the PC ledger (single café series). Offline,
 * the tablet prints a clearly separated provisional series: `P<deviceShort>-NNNNNN`
 * where <deviceShort> is stable per install and NNNNNN is a per-device sequence
 * that is never reused and never renumbered later.
 */
object ReceiptNumbers {

    /** Formats a sequential number under a prefix, e.g. ("INV", 7) -> "INV-000007". */
    fun format(prefix: String, number: Int): String =
        "${prefix}-${number.toString().padStart(6, '0')}"

    /**
     * Deterministic per-install provisional prefix derived from the Android device
     * id: keeps the prefix short but stable across restarts.
     */
    fun provisionalPrefix(deviceId: String): String {
        val clean = deviceId.replace(Regex("[^A-Za-z0-9]"), "").uppercase()
        return "P" + clean.takeLast(4).ifEmpty { "X" }
    }

    /** Provisional series numbers are sequential from 1 per prefix. */
    fun isProvisional(orderNumber: String): Boolean =
        orderNumber.startsWith("P") && orderNumber.contains("-")
}
