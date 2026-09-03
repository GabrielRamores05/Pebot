package com.cafeos.tablet

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.TableBar
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.cafeos.tablet.ui.AccessControl
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.screens.*
import com.cafeos.tablet.ui.theme.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PebotTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen()
                }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun MainScreen() {
    val navController = rememberNavController()
    val viewModel: CafeViewModel = viewModel()
    var selectedItem by remember { mutableStateOf(0) }
    var navCollapsed by remember { mutableStateOf(false) }
    var currentStaff by remember { mutableStateOf<com.cafeos.tablet.data.Staff?>(null) }

    if (currentStaff == null) {
        LoginScreen(viewModel = viewModel, onLoginSuccess = { currentStaff = it })
        return
    }
    
    fun canAccess(route: String) = currentStaff != null && AccessControl.canAccessRoute(currentStaff!!, route)

    // Navigation mirrors the Windows admin sidebar (spec 013 A1): same order,
    // same labels, same grouping; Kitchen/Tables/Stations keep their own rail
    // entries on the tablet. AccessControl applies the web role/permission rules.
    val items = listOf(
        NavigationItem("Live Orders", Icons.Default.FormatListBulleted, "live_orders", group = "OPERATIONS"),
        NavigationItem("New Order", Icons.Default.ShoppingCart, "pos", group = "OPERATIONS"),
        NavigationItem("Kitchen", Icons.Default.Restaurant, "kitchen", group = "OPERATIONS"),
        NavigationItem("Analytics", Icons.Default.BarChart, "analytics", group = "OPERATIONS"),
        NavigationItem("Products", Icons.Default.Coffee, "products", group = "OPERATIONS"),
        NavigationItem("Inventory", Icons.Default.Inventory, "inventory", group = "OPERATIONS"),
        NavigationItem("Stock History", Icons.Default.History, "stock_history", group = "OPERATIONS"),
        NavigationItem("Expenses", Icons.Default.AttachMoney, "expenses", group = "OPERATIONS"),
        NavigationItem("Loyalty", Icons.Default.LocalOffer, "loyalty", group = "MANAGEMENT"),
        NavigationItem("Order History", Icons.Default.TableChart, "order_history", group = "MANAGEMENT"),
        NavigationItem("Reviews", Icons.Default.Star, "reviews", group = "MANAGEMENT"),
        NavigationItem("Tables", Icons.Default.TableBar, "tables", group = "MANAGEMENT"),
        NavigationItem("Staff", Icons.Default.Group, "staff", group = "MANAGEMENT"),
        NavigationItem("Settings", Icons.Default.Settings, "settings", group = "MANAGEMENT"),
        NavigationItem("Consultant", Icons.Default.Chat, "consultant", group = "MANAGEMENT"),
        NavigationItem("Audit Logs", Icons.Default.List, "audit_logs", group = "MANAGEMENT"),
        NavigationItem("Connection", Icons.Default.Wifi, "connection", group = "SYSTEM")
    ).filter { canAccess(it.route) }

    // Home = Live Orders for staff/admin; kitchen-role staff land on the Kitchen.
    val startDestination = when {
        AccessControl.canAccessRoute(currentStaff!!, "live_orders") -> "live_orders"
        AccessControl.canAccessRoute(currentStaff!!, "kitchen") -> "kitchen"
        else -> items.firstOrNull()?.route ?: "pos"
    }

    val navWidth by animateDpAsState(targetValue = if (navCollapsed) 88.dp else 250.dp, label = "navWidth")
    val activeOrderCount by viewModel.allOrders.collectAsState(initial = emptyList())

    Scaffold(
            containerColor = PosCoffee,
        content = { padding ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                Surface(
                    modifier = Modifier
                        .width(navWidth)
                        .fillMaxHeight(),
                    color = PosCoffeeDeep,
                    tonalElevation = 0.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp)
                    ) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                            IconButton(onClick = { navCollapsed = !navCollapsed }) {
                                Icon(
                                    imageVector = Icons.Default.Menu,
                                    contentDescription = if (navCollapsed) "Expand navigation" else "Collapse navigation",
                                    tint = PosCream
                                )
                            }
                        }

                        if (!navCollapsed) {
                            Text(
                                text = "PEBOT",
                                style = MaterialTheme.typography.titleLarge,
                                color = PosCream,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "POS Dashboard",
                                style = MaterialTheme.typography.bodySmall,
                                color = PosGold,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                        }

                        if (!navCollapsed) {
                            Text(
                                "OPERATIONS",
                                style = MaterialTheme.typography.labelSmall,
                                color = PosGold,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }

                        Column(
                            modifier = Modifier
                                .verticalScroll(rememberScrollState())
                                .fillMaxSize()
                        ) {
                            var lastGroup: String? = null
                            items.forEachIndexed { index, item ->
                                if (!navCollapsed && item.group != lastGroup) {
                                    Text(
                                        item.group,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = PosGold,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(
                                            top = if (lastGroup == null) 2.dp else 16.dp,
                                            bottom = 8.dp,
                                            start = 12.dp
                                        )
                                    )
                                    lastGroup = item.group
                                }
                                val isSelected = selectedItem == index
                                val indicatorColor by animateColorAsState(
                                    if (isSelected) PosGold else Color.Transparent,
                                    label = "navigationIndicator"
                                )
                                NavigationRailItem(
                                    icon = {
                                        if (item.route == "live_orders") {
                                            Box {
                                                Icon(item.icon, contentDescription = item.label, modifier = Modifier.size(25.dp))
                                                val count = activeOrderCount.count { it.status == "PENDING" || it.status == "PREPARING" }
                                                if (count > 0) {
                                                    Badge(
                                                        modifier = Modifier.align(androidx.compose.ui.Alignment.TopEnd),
                                                        containerColor = PosDanger,
                                                        contentColor = Color.White
                                                    ) { Text(if (count > 9) "9+" else count.toString()) }
                                                }
                                            }
                                        } else {
                                            Icon(item.icon, contentDescription = item.label, modifier = Modifier.size(22.dp))
                                        }
                                    },
                                    label = { Text(item.label) },
                                    selected = isSelected,
                                    onClick = {
                                        selectedItem = index
                                        navController.navigate(item.route) {
                                            popUpTo(navController.graph.startDestinationId)
                                            launchSingleTop = true
                                        }
                                    },
                                    alwaysShowLabel = !navCollapsed,
                                    modifier = Modifier
                                        .padding(bottom = 6.dp)
                                        .fillMaxWidth(),
                                    colors = NavigationRailItemDefaults.colors(
                                        selectedIconColor = PosCoffeeDeep,
                                        selectedTextColor = PosCoffeeDeep,
                                        unselectedIconColor = PosCream.copy(alpha = 0.78f),
                                        unselectedTextColor = PosCream.copy(alpha = 0.78f),
                                        disabledIconColor = PosCream.copy(alpha = 0.42f),
                                        disabledTextColor = PosCream.copy(alpha = 0.42f),
                                        indicatorColor = indicatorColor
                                    )
                                )
                            }
                        }
                    }
                }

                Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = PosCoffeeLight,
                        shadowElevation = 1.dp
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 9.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                        ) {
                            Column {
                                Text("PEBOT POS", style = MaterialTheme.typography.titleMedium, color = PosInk, fontWeight = FontWeight.Bold)
                                Text("Operations", style = MaterialTheme.typography.labelSmall, color = PosInkSoft)
                            }
                            Surface(color = PosAccentSoft, shape = RoundedCornerShape(50.dp)) {
                                Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                    Box(Modifier.size(7.dp).background(PosAccent, RoundedCornerShape(50.dp)))
                                    Spacer(Modifier.width(7.dp))
                                    Text("Local workspace", color = PosAccentHover, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            IconButton(onClick = { currentStaff = null }) {
                                Icon(Icons.Default.Logout, contentDescription = "Log out", tint = PosAccent)
                            }
                        }
                    }
                    NavHost(
                        navController = navController,
                        startDestination = startDestination,
                        modifier = Modifier.weight(1f)
                    ) {
                    composable("live_orders") { if (canAccess("live_orders")) LiveOrdersScreen(viewModel) else AccessDeniedScreen() }
                    composable("pos") { if (canAccess("pos")) POSScreen(viewModel) else AccessDeniedScreen() }
                    composable("kitchen") { if (canAccess("kitchen")) KitchenScreen(viewModel) else AccessDeniedScreen() }
                    composable("analytics") { if (canAccess("analytics")) AnalyticsScreen(viewModel) else AccessDeniedScreen() }
                    composable("products") { if (canAccess("products")) ProductScreen(viewModel) else AccessDeniedScreen() }
                    composable("inventory") { if (canAccess("inventory")) InventoryScreen(viewModel) else AccessDeniedScreen() }
                    composable("stock_history") { if (canAccess("stock_history")) StockHistoryScreen(viewModel) else AccessDeniedScreen() }
                    composable("expenses") { if (canAccess("expenses")) ExpensesScreen(viewModel) else AccessDeniedScreen() }
                    composable("loyalty") { if (canAccess("loyalty")) LoyaltyScreen(viewModel) else AccessDeniedScreen() }
                    composable("order_history") { if (canAccess("order_history")) OrderHistoryScreen(viewModel) else AccessDeniedScreen() }
                    composable("reviews") { if (canAccess("reviews")) ReviewsScreen(viewModel) else AccessDeniedScreen() }
                    composable("tables") { if (canAccess("tables")) TablesManagementScreen(viewModel) else AccessDeniedScreen() }
                    composable("staff") { if (canAccess("staff")) StaffManagementScreen(viewModel) else AccessDeniedScreen() }
                    composable("settings") { if (canAccess("settings")) SettingsScreen(viewModel) else AccessDeniedScreen() }
                    composable("consultant") { if (canAccess("consultant")) AIConsultantScreen(viewModel) else AccessDeniedScreen() }
                    composable("audit_logs") { if (canAccess("audit_logs")) AuditLogScreen(viewModel) else AccessDeniedScreen() }
                    composable("connection") { if (canAccess("connection")) ConnectionScreen(viewModel) else AccessDeniedScreen() }
                    }
                }
            }
        }
    )
}

data class NavigationItem(
    val label: String,
    val icon: ImageVector,
    val route: String,
    val group: String = "OPERATIONS"
)

@Composable
private fun AccessDeniedScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
        Text("Access restricted", color = PosInk, style = MaterialTheme.typography.titleLarge)
    }
}
