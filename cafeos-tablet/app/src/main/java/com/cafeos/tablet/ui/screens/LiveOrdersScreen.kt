package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
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
import androidx.compose.ui.input.pointer.pointerInput
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
import kotlin.math.abs
import kotlinx.coroutines.launch

@Composable
fun LiveOrdersScreen(viewModel: CafeViewModel) {
    val orders by viewModel.allOrders.collectAsState(initial = emptyList())
    val tables by viewModel.tables.collectAsState(initial = emptyList())
    val stations by viewModel.stations.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, hh:mm a", Locale.getDefault())

    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Kanban", "Tables", "Stations")

    PremiumScreen {
        PremiumHeader("Live Orders", "Monitor preparation across the floor")
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = PosCoffeeLight,
            contentColor = PosGold
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) }
                )
            }
        }

        when (selectedTab) {
            0 -> KanbanBoard(orders, currencyFormatter, dateFormatter, viewModel)
            1 -> TablesTab(tables, viewModel)
            2 -> StationsTab(stations, viewModel)
        }
    }
}

@Composable
fun KanbanBoard(orders: List<Order>, currencyFormatter: NumberFormat, dateFormatter: SimpleDateFormat, viewModel: CafeViewModel) {
    val columns = listOf("PENDING", "PREPARING", "COMPLETED", "CANCELLED")
    val columnColors = mapOf(
        "PENDING" to PosGold,
        "PREPARING" to PosInfo,
        "COMPLETED" to PosAccent,
        "CANCELLED" to PosDanger
    )
    val columnTitles = mapOf(
        "PENDING" to "Pending",
        "PREPARING" to "Preparing",
        "COMPLETED" to "Completed",
        "CANCELLED" to "Cancelled"
    )

    var selectedOrder by remember { mutableStateOf<Order?>(null) }
    var pendingCancellation by remember { mutableStateOf<Order?>(null) }

    fun requestStatusChange(order: Order, newStatus: String) {
        if (newStatus == "CANCELLED") pendingCancellation = order
        else viewModel.updateOrderStatus(order.id, newStatus)
    }

    Row(modifier = Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        columns.forEach { status ->
            val columnOrders = orders.filter { it.status == status }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            ) {
                Surface(
                    color = columnColors[status]?.copy(alpha = 0.15f) ?: PosCoffeeLight,
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = columnTitles[status] ?: status,
                                style = MaterialTheme.typography.titleMedium,
                                color = columnColors[status] ?: PosMuted,
                                fontWeight = FontWeight.Bold
                            )
                            Surface(
                                color = columnColors[status] ?: PosMuted,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    text = "${columnOrders.size}",
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = PosPaper
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxHeight()
                        ) {
                            items(columnOrders) { order ->
                                KanbanOrderCard(
                                    order = order,
                                    currencyFormatter = currencyFormatter,
                                    dateFormatter = dateFormatter,
                                    onStatusChange = { newStatus ->
                                        requestStatusChange(order, newStatus)
                                    },
                                    onClick = { selectedOrder = order }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    selectedOrder?.let { order ->
        OrderDetailDialog(
            order = order,
            viewModel = viewModel,
            onDismiss = { selectedOrder = null },
            onStatusChange = { newStatus ->
                requestStatusChange(order, newStatus)
                if (newStatus == "CANCELLED" || newStatus == "COMPLETED") {
                    selectedOrder = null
                }
            }
        )
    }

    pendingCancellation?.let { order ->
        AdminPasscodeDialog(
            viewModel = viewModel,
            onDismiss = { pendingCancellation = null },
            onAuthorized = {
                viewModel.updateOrderStatus(order.id, "CANCELLED", adminAuthorized = true)
                pendingCancellation = null
                if (selectedOrder?.id == order.id) selectedOrder = null
            }
        )
    }
}

@Composable
fun KanbanOrderCard(
    order: Order,
    currencyFormatter: NumberFormat,
    dateFormatter: SimpleDateFormat,
    onStatusChange: (String) -> Unit,
    onClick: () -> Unit
) {
    val statusOrder = listOf("PENDING", "PREPARING", "COMPLETED", "CANCELLED")

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .pointerInput(order.id) {
                var dragX = 0f
                // Horizontal-only drag detection: vertical swipes stay with the
                // column's LazyColumn so the kanban board can actually scroll.
                detectHorizontalDragGestures(
                    onDragStart = { dragX = 0f },
                    onHorizontalDrag = { _, dragAmount ->
                        dragX += dragAmount
                    },
                    onDragEnd = {
                        val index = statusOrder.indexOf(order.status)
                        val target = when {
                            dragX > 110f && index < statusOrder.lastIndex -> statusOrder[index + 1]
                            dragX < -110f && index > 0 -> statusOrder[index - 1]
                            else -> order.status
                        }
                        if (target != order.status) onStatusChange(target)
                    }
                )
            }
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.DragHandle, contentDescription = null, tint = PosMuted, modifier = Modifier.size(16.dp))
                    Column {
                        Text(order.orderNumber, style = MaterialTheme.typography.labelMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                        Text(order.tableLocation ?: order.tableId?.let { "Table $it" } ?: "Takeaway", style = MaterialTheme.typography.labelSmall, color = PosAccent, fontWeight = FontWeight.Bold)
                        Text(
                            when (order.orderType) {
                                "DELIVERY" -> "🛵 Delivery"
                                "TAKEOUT" -> "🥡 Takeout"
                                else -> "🍽️ Dine-in"
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = PosGold,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Surface(
                    color = when (order.status) {
                        "PENDING" -> PosGold
                        "PREPARING" -> PosInfo
                        "COMPLETED" -> PosAccent
                        "CANCELLED" -> PosDanger
                        else -> PosMuted
                    },
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = order.status,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = PosPaper,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(if (order.customerName.isBlank()) "Walk-in Customer" else order.customerName, style = MaterialTheme.typography.bodySmall, color = PosPaper, fontWeight = FontWeight.Medium)
            Text("Drag left/right to move", style = MaterialTheme.typography.labelSmall, color = PosMuted)
            Text(dateFormatter.format(Date(order.createdAt)), style = MaterialTheme.typography.labelSmall, color = PosMuted)
            Spacer(modifier = Modifier.height(8.dp))
            Text(currencyFormatter.format(order.totalAmount), style = MaterialTheme.typography.labelMedium, color = PosGold, fontWeight = FontWeight.Bold)
            if (order.status == "PENDING" || order.status == "PREPARING") {
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = {
                        onStatusChange(if (order.status == "PENDING") "PREPARING" else "COMPLETED")
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
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

@Composable
fun OrderDetailDialog(order: Order, viewModel: CafeViewModel, onDismiss: () -> Unit, onStatusChange: (String) -> Unit) {
    var items by remember { mutableStateOf<List<OrderItem>>(emptyList()) }
    var optionMap by remember { mutableStateOf<Map<Int, List<OrderOption>>>(emptyMap()) }
    var loading by remember { mutableStateOf(true) }
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val productMap = products.associateBy { it.id }
    val businessSettings by viewModel.businessSettings.collectAsState(initial = null)
    val scope = rememberCoroutineScope()

    LaunchedEffect(order.id) {
        items = viewModel.getOrderItemsSync(order.id)
        optionMap = items.associate { item ->
            item.id to viewModel.getOrderOptionsForItemSync(item.id)
        }
        loading = false
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Order ${order.orderNumber}", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                Surface(
                    color = when (order.status) {
                        "PENDING" -> PosGold
                        "PREPARING" -> PosInfo
                        "COMPLETED" -> PosAccent
                        "CANCELLED" -> PosDanger
                        else -> PosMuted
                    },
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = order.status,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = PosPaper,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        },
        text = {
            Column(modifier = Modifier.height(400.dp)) {
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    item {
                        Column {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Customer:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(order.customerName, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Seated at:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(order.tableLocation ?: order.tableId?.let { "Table $it" } ?: "Takeaway", color = PosAccent, fontWeight = FontWeight.Bold)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Total:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("₱${"%.2f".format(order.totalAmount)}", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text("Payment:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(order.paymentMethod, color = MaterialTheme.colorScheme.onSurface)
                            }
                            if (order.discountAmount > 0) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                    Text("Discount:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text("-₱${"%.2f".format(order.discountAmount)}", color = PosAccent)
                                }
                            }
                        }
                    }
                    item {
                        Divider()
                        Text("Items", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                    }

                    if (loading) {
                        item {
                            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = PosAccent)
                            }
                        }
                    } else {
                        items(items) { item ->
                            val product = productMap[item.productId]
                            val selectedOptions = optionMap[item.id].orEmpty()
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(product?.name ?: "Unknown Product", color = MaterialTheme.colorScheme.onSurface)
                                    if (selectedOptions.isNotEmpty()) {
                                        Text(
                                            selectedOptions.joinToString(", ") { "${it.name}: ${it.value}" },
                                            style = MaterialTheme.typography.bodySmall,
                                            color = PosAccent
                                        )
                                    }
                                    if (!item.notes.isNullOrBlank()) {
                                        Text(item.notes, style = MaterialTheme.typography.bodySmall, color = PosInkSoft)
                                    }
                                }
                                Text("x${item.quantity}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Spacer(modifier = Modifier.width(16.dp))
                                Text("₱${"%.2f".format(item.subtotal)}", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            val payment = viewModel.getPaymentsForOrder(order.id).firstOrNull()
                            viewModel.receiptPrinter.printReceipt(order, items, products, businessSettings, optionMap, payment)
                        }
                    },
                    enabled = !loading,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PosBorder)
                ) { Text("Print Receipt", color = PosGold) }
                if (order.status == "PENDING") {
                    Button(
                        onClick = { onStatusChange("PREPARING") },
                        colors = ButtonDefaults.buttonColors(containerColor = PosInfo),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("Start Preparing", fontWeight = FontWeight.SemiBold) }
                }
                if (order.status == "PREPARING") {
                    Button(
                        onClick = { onStatusChange("COMPLETED") },
                        colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("Mark Ready", fontWeight = FontWeight.SemiBold) }
                }
                if (order.status != "CANCELLED") {
                    TextButton(
                        onClick = { onStatusChange("CANCELLED") },
                    ) {
                        Text("Cancel", color = PosDanger)
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}

@Composable
fun TablesTab(tables: List<CafeTable>, viewModel: CafeViewModel) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(tables) { table ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(table.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                        Text("Capacity: ${table.capacity}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = table.status,
                            style = MaterialTheme.typography.labelLarge,
                            color = when (table.status) {
                                "AVAILABLE" -> PosAccent
                                "OCCUPIED" -> PosGold
                                "RESERVED" -> PosInfo
                                else -> PosMuted
                            },
                            fontWeight = FontWeight.Bold
                        )
                        Text("${table.currentOccupants}/${table.capacity}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                    }
                }
            }
        }
    }
}

@Composable
fun StationsTab(stations: List<Station>, viewModel: CafeViewModel) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(stations) { station ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(station.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                        Text(station.stationType.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                    }
                    Text(
                        text = if (station.active) "Active" else "Inactive",
                        style = MaterialTheme.typography.labelLarge,
                        color = if (station.active) PosAccent else PosDanger,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
