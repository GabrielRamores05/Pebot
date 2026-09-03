package com.cafeos.tablet.ui

import com.cafeos.tablet.data.Staff
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessControlTest {

    private fun staff(
        role: String = "STAFF",
        permissions: String = ""
    ) = Staff(id = 1, name = "T", role = role, permissions = permissions, active = true)

    @Test
    fun adminCanAccessEverythingEvenWithNoPermissions() {
        val admin = staff(role = "ADMIN")
        assertTrue(AccessControl.canAccessRoute(admin, "pos"))
        assertTrue(AccessControl.canAccessRoute(admin, "kitchen"))
        assertTrue(AccessControl.canAccessRoute(admin, "staff"))
        assertTrue(AccessControl.canAccessRoute(admin, "settings"))
        assertTrue(AccessControl.canAccessRoute(admin, "audit_logs"))
    }

    @Test
    fun legacyBlankPermissionsMeanFullAccessForStaff() {
        val s = staff()
        assertTrue(AccessControl.canAccessRoute(s, "pos"))
        assertTrue(AccessControl.canAccessRoute(s, "products"))
        // …but never admin-only areas
        assertFalse(AccessControl.canAccessRoute(s, "staff"))
        assertFalse(AccessControl.canAccessRoute(s, "audit_logs"))
    }

    @Test
    fun legacyCsvRoutePermissionsAreHonored() {
        val s = staff(permissions = "pos,products")
        assertTrue(AccessControl.canAccessRoute(s, "pos"))
        assertTrue(AccessControl.canAccessRoute(s, "products"))
        assertFalse(AccessControl.canAccessRoute(s, "kitchen"))
        assertFalse(AccessControl.canAccessRoute(s, "analytics"))
        assertFalse(AccessControl.canAccessRoute(s, "tables"))
    }

    @Test
    fun webJsonPermissionKeysGateStaffRoutes() {
        val json = """{"liveOrders":true,"terminal":true,"tables":true,"products":true,
            "inventory":true,"kitchen":false,"loyalty":false,"analytics":false,"staff":false,"settings":false}"""
        val s = staff(permissions = json)
        assertTrue(AccessControl.canAccessRoute(s, "pos"))          // terminal key
        assertTrue(AccessControl.canAccessRoute(s, "live_orders"))  // liveOrders key
        assertTrue(AccessControl.canAccessRoute(s, "tables"))
        assertFalse(AccessControl.canAccessRoute(s, "kitchen"))
        assertFalse(AccessControl.canAccessRoute(s, "analytics"))
        assertFalse(AccessControl.canAccessRoute(s, "settings"))    // no settings key
    }

    @Test
    fun staffWithSettingsKeyButNoAdminRoleCannotOpenAdminOnlyAreas() {
        val s = staff(permissions = """{"settings":true,"terminal":true}""")
        assertTrue(AccessControl.canAccessRoute(s, "settings"))
        assertFalse(AccessControl.canAccessRoute(s, "staff"))
        assertFalse(AccessControl.canAccessRoute(s, "audit_logs"))
    }

    @Test
    fun kitchenRoleIsKitchenOnly() {
        val kitchen = staff(role = "KITCHEN")
        assertTrue(AccessControl.canAccessRoute(kitchen, "kitchen"))
        assertFalse(AccessControl.canAccessRoute(kitchen, "pos"))
        assertFalse(AccessControl.canAccessRoute(kitchen, "products"))
        assertFalse(AccessControl.canAccessRoute(kitchen, "staff"))
        assertFalse(AccessControl.canAccessRoute(kitchen, "settings"))
    }

    @Test
    fun tabletOnlyRolesMapToWebRolesDuringTransition() {
        assertEquals("STAFF", AccessControl.normalizeRole("MANAGER"))
        assertEquals("KITCHEN", AccessControl.normalizeRole("BARISTA"))
        assertEquals("KITCHEN", AccessControl.normalizeRole("kitchen"))
        val manager = staff(role = "MANAGER")
        assertTrue(AccessControl.canAccessRoute(manager, "products")) // staff-like, legacy full
        val barista = staff(role = "BARISTA")
        assertTrue(AccessControl.canAccessRoute(barista, "kitchen"))
        assertFalse(AccessControl.canAccessRoute(barista, "pos"))
    }

    @Test
    fun permissionKeyMapCoversAllTabletRoutes() {
        val routes = listOf(
            "pos", "live_orders", "kitchen", "analytics", "order_history",
            "expenses", "vouchers", "products", "inventory", "tables",
            "stock_history", "reviews", "loyalty", "settings", "staff",
            "audit_logs"
        )
        for (route in routes) {
            assertTrue("route $route must map to a web key", AccessControl.permissionKeyForRoute(route) != null)
        }
    }

    @Test
    fun stationsRouteGatesBehindTablesPermissionLikeWebHomeTab() {
        val withTables = staff(permissions = """{"tables":true,"liveOrders":true}""")
        assertTrue(AccessControl.canAccessRoute(withTables, "stations"))
        val noTables = staff(permissions = """{"liveOrders":true}""")
        assertFalse(AccessControl.canAccessRoute(noTables, "stations"))
    }

    @Test
    fun malformedPermissionsNeverCrash() {
        // Broken JSON object -> no tokens (conservative: nothing granted).
        assertTrue(AccessControl.permissionTokens("{not: json").isEmpty())
        // CSV garbage is parsed literally through the legacy path, never crashes.
        assertEquals(setOf("pos", "products"), AccessControl.permissionTokens("pos,,products"))
    }
}
