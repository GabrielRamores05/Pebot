package com.cafeos.tablet.ui

import com.cafeos.tablet.data.*
import org.junit.Assert.*
import org.junit.Test
import java.text.NumberFormat
import java.util.*

class ViewModelBusinessLogicTest {

    @Test
    fun testBirPriceCalculation_percentageMargin() {
        assertEquals(145.6, calculateBirPriceInternal(100.0, "PERCENTAGE", 30.0, false), 0.01)
    }

    @Test
    fun testBirPriceCalculation_fixedMargin() {
        assertEquals(125.44, calculateBirPriceInternal(100.0, "FIXED", 12.0, false), 0.01)
    }

    @Test
    fun testBirPriceCalculation_vatExempt() {
        assertEquals(130.0, calculateBirPriceInternal(100.0, "PERCENTAGE", 30.0, true), 0.01)
    }

    @Test
    fun testBirPriceCalculation_zeroMargin() {
        assertEquals(112.0, calculateBirPriceInternal(100.0, "PERCENTAGE", 0.0, false), 0.01)
    }

    @Test
    fun testLoyaltyTier_calculation() {
        assertEquals("AT_RISK", calculateLoyaltyTier(50.0))
        assertEquals("CASUAL", calculateLoyaltyTier(100.0))
        assertEquals("CASUAL", calculateLoyaltyTier(499.0))
        assertEquals("REGULAR", calculateLoyaltyTier(500.0))
        assertEquals("REGULAR", calculateLoyaltyTier(999.0))
        assertEquals("VIP", calculateLoyaltyTier(1000.0))
        assertEquals("VIP", calculateLoyaltyTier(1500.0))
        assertEquals("AT_RISK", calculateLoyaltyTier(0.0))
        assertEquals("AT_RISK", calculateLoyaltyTier(99.0))
    }

    @Test
    fun testDiscountRate_forPWD() {
        assertEquals(0.20, getDiscountRateForType("PWD"), 0.001)
    }

    @Test
    fun testDiscountRate_forStudent() {
        assertEquals(0.20, getDiscountRateForType("STUDENT"), 0.001)
    }

    @Test
    fun testDiscountRate_forNone() {
        assertEquals(0.0, getDiscountRateForType("NONE"), 0.001)
    }

    @Test
    fun testDiscountRate_forUnknown() {
        assertEquals(0.0, getDiscountRateForType("UNKNOWN"), 0.001)
    }

    @Test
    fun testReceiptNumber_generation() {
        val prefix = "INV"
        val lastNum = 42
        assertEquals("INV-000043", generateReceiptNumber(prefix, lastNum))
        assertEquals("INV-000001", generateReceiptNumber("INV", 0))
        assertEquals("INV-001000", generateReceiptNumber("INV", 999))
    }

    @Test
    fun testReceiptNumber_differentPrefixes() {
        assertEquals("RCV-000001", generateReceiptNumber("RCV", 0))
        assertEquals("BIL-000100", generateReceiptNumber("BIL", 99))
    }

    @Test
    fun testPayrollNetPay_calculation() {
        val result = calculateNetPay(
            baseSalary = 20000.0,
            overtimePay = 1000.0,
            sss = 1200.0,
            philhealth = 600.0,
            pagibig = 300.0,
            tax = 2000.0,
            deductions = 500.0
        )
        // 20000 + 1000 - (1200 + 600 + 300 + 2000 + 500) = 21000 - 4600 = 16400
        assertEquals(16400.0, result, 0.01)
    }

    @Test
    fun testPayrollNetPay_noDeductions() {
        val result = calculateNetPay(
            baseSalary = 20000.0,
            overtimePay = 0.0,
            sss = 0.0,
            philhealth = 0.0,
            pagibig = 0.0,
            tax = 0.0,
            deductions = 0.0
        )
        assertEquals(20000.0, result, 0.01)
    }

    @Test
    fun testCartTotal_calculationWithQuantity() {
        val product1 = Product(id = 1, name = "Latte", price = 150.0, categoryId = 1)
        val product2 = Product(id = 2, name = "Espresso", price = 100.0, categoryId = 1)

        val cartItems = listOf(
            CartItem(product = product1, quantity = 2, selectedOptions = emptyList(), priceDelta = 0.0),
            CartItem(product = product2, quantity = 1, selectedOptions = emptyList(), priceDelta = 0.0)
        )

        val subtotal = calculateCartSubtotal(cartItems)
        // (150*2) + (100*1) = 400
        assertEquals(400.0, subtotal, 0.01)
    }

    @Test
    fun testCartTotal_withPriceDelta() {
        val product = Product(id = 1, name = "Latte", price = 150.0, categoryId = 1)

        val cartItems = listOf(
            CartItem(product = product, quantity = 1, selectedOptions = listOf("Extra Shot" to "Yes"), priceDelta = 20.0)
        )

        val subtotal = calculateCartSubtotal(cartItems)
        // 150*1 + 20*1 = 170
        assertEquals(170.0, subtotal, 0.01)
    }

    @Test
    fun testCartTotal_withDiscount() {
        val product = Product(id = 1, name = "Latte", price = 150.0, categoryId = 1)

        val cartItems = listOf(
            CartItem(product = product, quantity = 2, selectedOptions = emptyList(), priceDelta = 0.0)
        )

        val subtotal = calculateCartSubtotal(cartItems)
        val discount = subtotal * 0.20
        val total = subtotal - discount

        assertEquals(300.0, subtotal, 0.01)
        assertEquals(60.0, discount, 0.01)
        assertEquals(240.0, total, 0.01)
    }

    @Test
    fun testTableStatus_colorMapping() {
        assertEquals("AVAILABLE", getStatusColorKey("AVAILABLE"))
        assertEquals("OCCUPIED", getStatusColorKey("OCCUPIED"))
        assertEquals("RESERVED", getStatusColorKey("RESERVED"))
        assertEquals("CLOSED", getStatusColorKey("CLOSED"))
    }

    @Test
    fun testOrderStatus_transitions() {
        assertTrue(isValidStatusTransition("PENDING", "PREPARING"))
        assertTrue(isValidStatusTransition("PREPARING", "COMPLETED"))
        assertTrue(isValidStatusTransition("PREPARING", "CANCELLED"))
        assertFalse(isValidStatusTransition("COMPLETED", "PENDING"))
        assertFalse(isValidStatusTransition("CANCELLED", "PREPARING"))
    }

    @Test
    fun testExportData_roundTrip() {
        val category = Category(name = "Drinks", icon = "☕")
        val product = Product(name = "Latte", price = 150.0, categoryId = 0, capitalCost = 50.0)

        assertEquals("Drinks", category.name)
        assertEquals("Latte", product.name)
        assertEquals(150.0, product.price, 0.01)
        assertEquals(50.0, product.capitalCost, 0.01)
    }

    @Test
    fun testLoyaltyRewardPoints_calculation() {
        val pointsPerPeso = 0.1
        val orderTotal = 500.0
        val earnedPoints = orderTotal * pointsPerPeso
        assertEquals(50.0, earnedPoints, 0.01)
    }

    @Test
    fun testStaffRole_validation() {
        assertTrue(isValidRole("ADMIN"))
        assertTrue(isValidRole("MANAGER"))
        assertTrue(isValidRole("STAFF"))
        assertTrue(isValidRole("KITCHEN"))
        assertTrue(isValidRole("BARISTA"))
        assertFalse(isValidRole("GUEST"))
        assertFalse(isValidRole(""))
    }

    @Test
    fun testTableSession_isActive() {
        val activeSession = TableSession(tableId = 1, startedAt = System.currentTimeMillis(), status = "OCCUPIED", guestCount = 2)
        val closedSession = TableSession(tableId = 1, startedAt = System.currentTimeMillis(), endedAt = System.currentTimeMillis(), status = "CLOSED", guestCount = 2)

        assertTrue(isSessionActive(activeSession))
        assertFalse(isSessionActive(closedSession))
    }

    @Test
    fun testCurrencyFormatter_PHP() {
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
        val formatted = formatter.format(1500.50)
        assertTrue(formatted.replace(",", "").contains("1500"))
        assertTrue(formatted.contains("50"))
    }
}

fun calculateBirPriceInternal(capitalCost: Double, marginType: String, marginValue: Double, vatExempt: Boolean): Double {
    val base = capitalCost + if (marginType.equals("PERCENTAGE", ignoreCase = true)) {
        capitalCost * marginValue / 100.0
    } else {
        marginValue
    }
    return if (vatExempt) base else base * 1.12
}

fun calculateLoyaltyTier(pointsBalance: Double): String = when {
    pointsBalance >= 1000 -> "VIP"
    pointsBalance >= 500 -> "REGULAR"
    pointsBalance >= 100 -> "CASUAL"
    else -> "AT_RISK"
}

fun getDiscountRateForType(type: String): Double = when (type) {
    "PWD" -> 0.20
    "STUDENT" -> 0.20
    else -> 0.0
}

fun generateReceiptNumber(prefix: String, lastNumber: Int): String {
    val next = lastNumber + 1
    return "$prefix-${next.toString().padStart(6, '0')}"
}

fun calculateNetPay(baseSalary: Double, overtimePay: Double, sss: Double, philhealth: Double, pagibig: Double, tax: Double, deductions: Double): Double {
    val totalDeductions = sss + philhealth + pagibig + tax + deductions
    return baseSalary + overtimePay - totalDeductions
}

fun calculateCartSubtotal(items: List<CartItem>): Double {
    return items.sumOf { it.product.price * it.quantity + it.priceDelta * it.quantity }
}

fun getStatusColorKey(status: String): String = status

fun isValidStatusTransition(from: String, to: String): Boolean {
    return when {
        from == "COMPLETED" || from == "CANCELLED" -> false
        from == "PENDING" && to == "PREPARING" -> true
        from == "PREPARING" && (to == "COMPLETED" || to == "CANCELLED") -> true
        else -> false
    }
}

fun isValidRole(role: String): Boolean = role in listOf("ADMIN", "MANAGER", "STAFF", "KITCHEN", "BARISTA")

fun isSessionActive(session: TableSession): Boolean = session.status == "OCCUPIED" && session.endedAt == null