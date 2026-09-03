package com.cafeos.tablet.ui

import com.cafeos.tablet.data.Staff
import kotlinx.serialization.json.Json

/**
 * Central access-control rules mirroring the Windows/web CaféOS app
 * (spec 013, Phase 1 — matrix A1/A2/B8).
 *
 * Web model (source of truth):
 *  - Roles: ADMIN, STAFF, KITCHEN.
 *  - Permission flags (JSON booleans on User.permissions):
 *    liveOrders, terminal, tables, analytics, products, inventory,
 *    kitchen, loyalty, staff, settings.
 *  - ADMIN bypasses every permission check.
 *  - KITCHEN role is kitchen-only (spec 006).
 *  - Admin-only areas: Staff, Settings, Audit Logs.
 *
 * The tablet historically stored permissions as a comma-joined CSV of nav route
 * names (e.g. "pos,products") and treated a blank value as "full access". This
 * module is the single place that translates both representations to web
 * semantics, so screens and navigation never re-implement access decisions.
 */
object AccessControl {

    private val json = Json { ignoreUnknownKeys = true }

    /** Canonical web permission keys, in web order. */
    val PERMISSION_KEYS: List<String> = listOf(
        "liveOrders", "terminal", "tables", "analytics", "products",
        "inventory", "kitchen", "loyalty", "staff", "settings"
    )

    const val ROLE_ADMIN = "ADMIN"
    const val ROLE_STAFF = "STAFF"
    const val ROLE_KITCHEN = "KITCHEN"

    /** Tablet-only roles map onto web roles during the transition (Phase 6 UI
     *  will stop writing them): MANAGER is a full staff member, BARISTA is kitchen. */
    fun normalizeRole(role: String?): String {
        return when (role?.uppercase()) {
            ROLE_ADMIN -> ROLE_ADMIN
            ROLE_KITCHEN, "BARISTA" -> ROLE_KITCHEN
            else -> ROLE_STAFF
        }
    }

    /**
     * Parses the stored permissions into a set of normalized access tokens:
     * canonical web keys when stored as JSON (`{"terminal":true,...}`),
     * or the legacy route-name tokens when stored as a CSV (`"pos,products"`).
     */
    fun permissionTokens(permissions: String?): Set<String> {
        val raw = permissions?.trim().orEmpty()
        if (raw.isEmpty()) return emptySet()
        return if (raw.startsWith("{")) {
            try {
                val map = json.decodeFromString<Map<String, Boolean>>(raw)
                map.filterValues { it }.keys.map { it.trim() }.toSet()
            } catch (_: Exception) {
                emptySet()
            }
        } else {
            raw.split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()
        }
    }

    /**
     * Whether the stored permissions were explicitly granted (vs the legacy
     * "blank = full access" convention used by old tablet builds).
     */
    fun hasExplicitPermissions(staff: Staff): Boolean =
        permissionTokens(staff.permissions).isNotEmpty()

    /** Maps a tablet nav route to the web permission key that gates it. */
    fun permissionKeyForRoute(route: String): String? = when (route) {
        "pos" -> "terminal"
        "live_orders" -> "liveOrders"
        "kitchen" -> "kitchen"
        "analytics" -> "analytics"
        "order_history" -> "analytics"
        "expenses" -> "inventory"
        "vouchers" -> "loyalty"
        "products" -> "products"
        "inventory" -> "inventory"
        "tables" -> "tables"
        "stations" -> "tables"
        "stock_history" -> "inventory"
        "reviews" -> "products"
        "audit_logs" -> "settings"
        "loyalty" -> "loyalty"
        "settings" -> "settings"
        "staff" -> "staff"
        else -> null
    }

    /** Web admin-only areas (Staff management, Audit Logs).
     *  Settings is permission-gated, not admin-only, on the web. */
    private val adminOnlyRoutes = setOf("staff", "audit_logs")

    /**
     * Web-equivalent access decision for a route.
     *
     *  - ADMIN: everything.
     *  - KITCHEN role: kitchen route only (plus live-orders read where granted).
     *  - STAFF: needs the route's web permission key in the stored permissions;
     *    legacy blank permissions keep meaning "full access" so existing staff
     *    are never silently locked out (migrated away by the Phase 6 staff UI).
     */
    fun canAccessRoute(staff: Staff, route: String): Boolean {
        val role = normalizeRole(staff.role)
        if (role == ROLE_ADMIN) return true
        if (role == ROLE_KITCHEN) {
            return route == "kitchen"
        }
        // STAFF
        if (adminOnlyRoutes.contains(route)) return false
        val tokens = permissionTokens(staff.permissions)
        if (tokens.isEmpty()) return true // legacy full access
        val key = permissionKeyForRoute(route) ?: return true // unlisted route: no web equivalent
        return tokens.contains(key) || tokens.contains(route)
    }
}
