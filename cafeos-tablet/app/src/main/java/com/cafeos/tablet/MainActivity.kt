package com.cafeos.tablet

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
import com.cafeos.tablet.ui.theme.CafeOSTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CafeOSTheme {
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
    
    val items = listOf(
        NavigationItem("POS", Icons.Default.ShoppingCart, "pos"),
        NavigationItem("Inventory", Icons.Default.Inventory, "inventory"),
        NavigationItem("Products", Icons.Default.Coffee, "products"),
        NavigationItem("Orders", Icons.Default.History, "orders"),
        NavigationItem("Analytics", Icons.Default.BarChart, "analytics")
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
                    composable("inventory") { InventoryScreen(viewModel) }
                    composable("products") { ProductScreen(viewModel) }
                    composable("orders") { OrderHistoryScreen(viewModel) }
                    composable("analytics") { AnalyticsScreen(viewModel) }
                }
            }
        }
    )
}

data class NavigationItem(val label: String, val icon: ImageVector, val route: String)
