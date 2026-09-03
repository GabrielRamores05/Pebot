package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun KitchenScreen(viewModel: CafeViewModel) {
    val orders by viewModel.allOrders.collectAsState(initial = emptyList())
    val stationsFromDb by viewModel.stations.collectAsState(initial = emptyList())
    val productsList by viewModel.allProducts.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, hh:mm a", Locale.getDefault())
    var pendingCancellation by remember { mutableStateOf<Order?>(null) }

    var selectedStation by remember { mutableStateOf("All") }
    var showCompleted by remember { mutableStateOf(false) }

    val stationNames = listOf("All") + stationsFromDb.map { it.name }
    val productStationType: Map<Int, String> = productsList.associate { it.id to it.stationType }

    // Load each order's items once per order set so filtering can route orders to
    // the station of the products they contain (web parity: Product.stationType).
    var itemsByOrder by remember(orders) { mutableStateOf<Map<Int, List<OrderItem>>>(emptyMap()) }
    LaunchedEffect(orders) {
        itemsByOrder = orders.mapNotNull { order ->
            val items = viewModel.getOrderItemsSync(order.id)
            if (items.isEmpty()) null else order.id to items
        }.toMap()
    }

    val selectedStationType = stationsFromDb.firstOrNull { it.name == selectedStation }?.stationType
    val countsByStationName = stationsFromDb.associate { station ->
        station.name to orders.count { order ->
            itemsByOrder[order.id].orEmpty().any { productStationType[it.productId] == station.stationType }
        }
    }
    val filtered = if (selectedStation == "All") {
        orders
    } else {
        orders.filter { order ->
            itemsByOrder[order.id].orEmpty().any { productStationType[it.productId] == selectedStationType }
        }
    }
    val displayOrders = if (showCompleted) filtered else filtered.filter { it.status != "COMPLETED" && it.status != "CANCELLED" }

    PremiumScreen {
        PremiumHeader("Kitchen Display", "Keep the line moving")
        ScrollableTabRow(
            selectedTabIndex = stationNames.indexOf(selectedStation).coerceAtLeast(0),
            edgePadding = 0.dp,
            divider = {},
            containerColor = PosCoffeeLight,
            contentColor = PosGold
        ) {
            stationNames.forEach { station ->
                Tab(
                    selected = selectedStation == station,
                    onClick = { selectedStation = station },
                    text = {
                        Text(
                            if (station == "All") {
                                "All (${orders.size})"
                            } else {
                                "${station} (${countsByStationName[station] ?: 0})"
                            }
                        )
                    }
                )
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = showCompleted,
                onCheckedChange = { showCompleted = it },
                colors = CheckboxDefaults.colors(checkedColor = PosAccent)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Show completed", color = MaterialTheme.colorScheme.onSurface)
        }

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (displayOrders.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No orders for this station", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
                    }
                }
            }
            items(displayOrders) { order ->
                KitchenOrderCard(
                    order = order,
                    viewModel = viewModel,
                    currencyFormatter = currencyFormatter,
                    dateFormatter = dateFormatter,
                    onStatusChange = { newStatus ->
                        if (newStatus == "CANCELLED") pendingCancellation = order
                        else viewModel.updateOrderStatus(order.id, newStatus)
                    }
                )
            }
        }
    }

    pendingCancellation?.let { order ->
        AdminPasscodeDialog(
            viewModel = viewModel,
            onDismiss = { pendingCancellation = null },
            onAuthorized = {
                viewModel.updateOrderStatus(order.id, "CANCELLED", adminAuthorized = true)
                pendingCancellation = null
            }
        )
    }
}

@Composable
fun KitchenOrderCard(order: Order, viewModel: CafeViewModel, currencyFormatter: NumberFormat, dateFormatter: SimpleDateFormat, onStatusChange: (String) -> Unit) {
    var items by remember { mutableStateOf<List<OrderItem>>(emptyList()) }
    var optionMap by remember { mutableStateOf<Map<Int, List<OrderOption>>>(emptyMap()) }
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val productMap = products.associateBy { it.id }

    LaunchedEffect(order.id) {
        items = viewModel.getOrderItemsSync(order.id)
        optionMap = items.associate { item ->
            item.id to viewModel.getOrderOptionsForItemSync(item.id)
        }
    }

    val statusColor = when (order.status) {
        "PENDING" -> PosGold
        "PREPARING" -> PosInfo
        "COMPLETED" -> PosAccent
        "CANCELLED" -> PosDanger
        else -> PosInkSoft
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(order.orderNumber, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                    Text(order.customerName, style = MaterialTheme.typography.bodyMedium, color = PosMuted)
                    Text(order.tableLocation ?: order.tableId?.let { "Table $it" } ?: "Takeaway", style = MaterialTheme.typography.labelMedium, color = PosAccent, fontWeight = FontWeight.Bold)
                }
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = order.status,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = statusColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            val elapsedMinutes = ((System.currentTimeMillis() - order.createdAt) / 60_000L).toInt()
            val elapsedLabel = if (elapsedMinutes < 60) "$elapsedMinutes min ago" else "${elapsedMinutes / 60}h ${elapsedMinutes % 60}m ago"
            val urgent = (order.status == "PENDING" || order.status == "PREPARING") && elapsedMinutes >= 10
            val orderTypeLabel = when (order.orderType) {
                "DELIVERY" -> "🛵 Delivery"
                "TAKEOUT" -> "🥡 Takeout"
                else -> "🍽️ Dine-in"
            }
            Text(
                text = "$orderTypeLabel · $elapsedLabel",
                style = MaterialTheme.typography.labelMedium,
                color = if (urgent) PosDanger else PosGold,
                fontWeight = if (urgent) FontWeight.Bold else FontWeight.Medium,
                modifier = Modifier.padding(bottom = 6.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))
            Divider(color = PosBorder.copy(alpha = 0.5f))
            Spacer(modifier = Modifier.height(12.dp))

            items.forEach { item ->
                val product = productMap[item.productId]
                val selectedOptions = optionMap[item.id].orEmpty()
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            text = "${item.quantity}x ${product?.name ?: "Unknown"}",
                            style = MaterialTheme.typography.bodyLarge,
                            color = PosPaper,
                            modifier = Modifier.weight(1f)
                        )
                        if (!item.notes.isNullOrBlank()) {
                            Text(
                                text = item.notes,
                                style = MaterialTheme.typography.bodySmall,
                                color = PosGold,
                                modifier = Modifier.padding(start = 8.dp)
                            )
                        }
                    }
                    if (selectedOptions.isNotEmpty()) {
                        Text(
                            text = selectedOptions.joinToString(", ") { "${it.name}: ${it.value}" },
                            style = MaterialTheme.typography.bodySmall,
                            color = PosGold,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(dateFormatter.format(Date(order.createdAt)), style = MaterialTheme.typography.bodySmall, color = PosMuted)
                Text(currencyFormatter.format(order.totalAmount), style = MaterialTheme.typography.labelLarge, color = PosGold, fontWeight = FontWeight.Bold)
            }

            if (order.status == "PENDING" || order.status == "PREPARING") {
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = {
                        onStatusChange(if (order.status == "PENDING") "PREPARING" else "COMPLETED")
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (order.status == "PENDING") PosGold else PosAccent
                    )
                ) {
                    Text(if (order.status == "PENDING") "Start Preparing" else "Mark Ready", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
