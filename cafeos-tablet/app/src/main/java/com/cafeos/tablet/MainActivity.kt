package com.cafeos.tablet

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.screens.*
import com.cafeos.tablet.ui.theme.PebotTheme

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
fun MainScreen() {
    val navController = rememberNavController()
    val viewModel: CafeViewModel = viewModel()
    var selectedItem by remember { mutableStateOf(0) }
    var currentStaff by remember { mutableStateOf<com.cafeos.tablet.data.Staff?>(null) }

    if (currentStaff == null) {
        LoginScreen(viewModel = viewModel, onLoginSuccess = { currentStaff = it })
        return
    }
    
    val items = listOf(
        NavigationItem("POS", Icons.Default.ShoppingCart, "pos"),
        NavigationItem("Live Orders", Icons.Default.List, "live_orders"),
        NavigationItem("Kitchen", Icons.Default.Restaurant, "kitchen"),
        NavigationItem("Inventory", Icons.Default.Inventory, "inventory"),
        NavigationItem("Products", Icons.Default.Coffee, "products"),
        NavigationItem("Orders", Icons.Default.History, "orders"),
        NavigationItem("Analytics", Icons.Default.BarChart, "analytics"),
        NavigationItem("Expenses", Icons.Default.AttachMoney, "expenses"),
        NavigationItem("Options", Icons.Default.FormatListBulleted, "option_groups"),
        NavigationItem("Customers", Icons.Default.Face, "customers"),
        NavigationItem("Staff", Icons.Default.Group, "staff"),
        NavigationItem("Vouchers", Icons.Default.ConfirmationNumber, "vouchers"),
        NavigationItem("Reviews", Icons.Default.Star, "reviews"),
        NavigationItem("Audit", Icons.Default.History, "audit"),
        NavigationItem("AI Consultant", Icons.Default.Chat, "ai_consultant"),
        NavigationItem("Settings", Icons.Default.Settings, "settings")
    )

    Scaffold(
        content = { padding ->
            androidx.compose.foundation.layout.Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                NavigationRail {
                    items.forEachIndexed { index, item ->
                        NavigationRailItem(
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                            selected = selectedItem == index,
                            onClick = {
                                selectedItem = index
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.startDestinationId)
                                    launchSingleTop = true
                                }
                            }
                        )
                    }
                }
                
                NavHost(
                    navController = navController,
                    startDestination = "pos",
                    modifier = Modifier.weight(1f)
                ) {
                    composable("pos") { POSScreen(viewModel) }
                    composable("live_orders") { LiveOrdersScreen(viewModel) }
                    composable("kitchen") { KitchenScreen(viewModel) }
                    composable("inventory") { InventoryScreen(viewModel) }
                    composable("products") { ProductScreen(viewModel) }
                    composable("orders") { OrderHistoryScreen(viewModel) }
                    composable("analytics") { AnalyticsScreen(viewModel) }
                    composable("expenses") { ExpensesScreen(viewModel) }
                    composable("option_groups") { OptionGroupScreen(viewModel) }
                    composable("customers") { CustomerManagementScreen(viewModel) }
                    composable("staff") { StaffManagementScreen(viewModel) }
                    composable("vouchers") { VoucherManagementScreen(viewModel) }
                    composable("reviews") { ReviewsScreen(viewModel) }
                    composable("audit") { AuditLogScreen(viewModel) }
                    composable("ai_consultant") { AIConsultantScreen(viewModel) }
                    composable("settings") { SettingsScreen(viewModel) }
                }
            }
        }
    )
}

data class NavigationItem(val label: String, val icon: ImageVector, val route: String)
