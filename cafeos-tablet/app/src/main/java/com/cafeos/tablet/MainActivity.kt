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
    
    val allowedPages = currentStaff?.permissions?.split(",")?.filter { it.isNotBlank() }?.toSet().orEmpty()
    fun canAccess(route: String) = currentStaff?.role?.equals("ADMIN", ignoreCase = true) == true || allowedPages.isEmpty() || route in allowedPages

    val items = listOf(
        NavigationItem("POS", Icons.Default.ShoppingCart, "pos"),
        NavigationItem("Live Orders", Icons.Default.FormatListBulleted, "live_orders"),
        NavigationItem("Kitchen", Icons.Default.Restaurant, "kitchen"),
        NavigationItem("Analytics", Icons.Default.BarChart, "analytics"),
        NavigationItem("Order History", Icons.Default.History, "order_history"),
        NavigationItem("Expenses", Icons.Default.AttachMoney, "expenses"),
        NavigationItem("Vouchers", Icons.Default.LocalOffer, "vouchers"),
        NavigationItem("Products", Icons.Default.Coffee, "products"),
        NavigationItem("Inventory", Icons.Default.Inventory, "inventory"),
        NavigationItem("Tables", Icons.Default.TableBar, "tables"),
        NavigationItem("Connection", Icons.Default.Wifi, "connection"),
        NavigationItem("Staff", Icons.Default.Group, "staff", adminOnly = true),
        NavigationItem("Settings", Icons.Default.Settings, "settings", adminOnly = true)
    ).filter { !it.adminOnly || currentStaff?.role?.equals("ADMIN", ignoreCase = true) == true }.filter { canAccess(it.route) }

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
                            items.forEachIndexed { index, item ->
                                if (!navCollapsed && index == 6) {
                                    Text(
                                        "MANAGEMENT",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = PosGold,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(top = 14.dp, bottom = 8.dp, start = 12.dp)
                                    )
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
                        startDestination = "pos",
                        modifier = Modifier.weight(1f)
                    ) {
                    composable("pos") { if (canAccess("pos")) POSScreen(viewModel) else AccessDeniedScreen() }
                    composable("live_orders") { if (canAccess("live_orders")) LiveOrdersScreen(viewModel) else AccessDeniedScreen() }
                    composable("kitchen") { if (canAccess("kitchen")) KitchenScreen(viewModel) else AccessDeniedScreen() }
                    composable("analytics") { if (canAccess("analytics")) AnalyticsScreen(viewModel) else AccessDeniedScreen() }
                    composable("order_history") { if (canAccess("order_history")) OrderHistoryScreen(viewModel) else AccessDeniedScreen() }
                    composable("expenses") { if (canAccess("expenses")) ExpensesScreen(viewModel) else AccessDeniedScreen() }
                    composable("vouchers") { if (canAccess("vouchers")) VoucherManagementScreen(viewModel) else AccessDeniedScreen() }
                    composable("products") { if (canAccess("products")) ProductScreen(viewModel) else AccessDeniedScreen() }
                    composable("inventory") { if (canAccess("inventory")) InventoryScreen(viewModel) else AccessDeniedScreen() }
                    composable("tables") { if (canAccess("tables")) TablesManagementScreen(viewModel) else AccessDeniedScreen() }
                    composable("connection") { if (canAccess("connection")) ConnectionScreen(viewModel) else AccessDeniedScreen() }
                    composable("staff") { if (canAccess("staff")) StaffManagementScreen(viewModel) else AccessDeniedScreen() }
                    composable("settings") { if (canAccess("settings")) SettingsScreen(viewModel) else AccessDeniedScreen() }
                    }
                }
            }
        }
    )
}

data class NavigationItem(val label: String, val icon: ImageVector, val route: String, val adminOnly: Boolean = false)

@Composable
private fun AccessDeniedScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
        Text("Access restricted", color = PosInk, style = MaterialTheme.typography.titleLarge)
    }
}
