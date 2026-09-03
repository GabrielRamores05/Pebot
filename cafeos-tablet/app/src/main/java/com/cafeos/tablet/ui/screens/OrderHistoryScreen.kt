package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Order
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderHistoryScreen(viewModel: CafeViewModel) {
    val orders by viewModel.allOrders.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy hh:mm a", Locale.getDefault())
    var selectedOrder by remember { mutableStateOf<Order?>(null) }
    var pendingCancellation by remember { mutableStateOf<Order?>(null) }
    var importMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        uri?.let { scope.launch { viewModel.exportOrderHistoryCsv(it) } }
    }
    val templateLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        uri?.let { scope.launch { viewModel.writeOrderHistoryTemplate(it) } }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { scope.launch { importMessage = viewModel.importOrderHistoryCsv(it) } }
    }

    PremiumScreen {
        PremiumHeader(
            "Order History",
            action = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { templateLauncher.launch("order-history-template.csv") }) { Text("Template") }
                    OutlinedButton(onClick = { importLauncher.launch(arrayOf("text/*", "application/vnd.ms-excel")) }) { Text("Import") }
                    Button(onClick = { exportLauncher.launch("order-history.csv") }, colors = ButtonDefaults.buttonColors(containerColor = PosAccent)) { Text("Export") }
                }
            }
        )
        importMessage?.let { Text(it, color = PosGold, modifier = Modifier.padding(top = 4.dp)) }
        Spacer(modifier = Modifier.height(10.dp))

        // Filters mirror the Windows Order History page (search, status, presets).
        var query by remember { mutableStateOf("") }
        var statusFilter by remember { mutableStateOf("ALL") }
        var daysFilter by remember { mutableStateOf(0) } // 0 = All
        val cutoff = if (daysFilter > 0) System.currentTimeMillis() - daysFilter * 24 * 3600_000L else 0L
        val filteredOrders = orders
            .filter { order ->
                val matchesQuery = query.isBlank() ||
                    order.orderNumber.contains(query, ignoreCase = true) ||
                    order.customerName.contains(query, ignoreCase = true)
                val matchesStatus = statusFilter == "ALL" || order.status == statusFilter
                val matchesDate = cutoff == 0L || order.createdAt >= cutoff
                matchesQuery && matchesStatus && matchesDate
            }
            .sortedByDescending { it.createdAt }

        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search order number or customer") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
            listOf("ALL", "PENDING", "PREPARING", "COMPLETED", "CANCELLED").forEach { status ->
                FilterChip(
                    selected = statusFilter == status,
                    onClick = { statusFilter = status },
                    label = { Text(status) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                )
            }
            Spacer(Modifier.width(4.dp))
            listOf(Pair(0, "All time"), Pair(1, "Today"), Pair(7, "7 days"), Pair(30, "30 days")).forEach { (days, label) ->
                FilterChip(
                    selected = daysFilter == days,
                    onClick = { daysFilter = days },
                    label = { Text(label) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text("${filteredOrders.size} orders", style = MaterialTheme.typography.labelSmall, color = PosMuted)

        if (filteredOrders.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                Text("No orders match your filters", color = PosMuted)
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 340.dp),
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                gridItems(filteredOrders) { order ->
                    OrderCard(order, currencyFormatter, dateFormatter, onClick = { selectedOrder = order })
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
                if (newStatus == "CANCELLED") pendingCancellation = order
                else viewModel.updateOrderStatus(order.id, newStatus)
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
                selectedOrder = null
            }
        )
    }
}

@Composable
fun OrderCard(order: Order, currencyFormatter: NumberFormat, dateFormatter: SimpleDateFormat, onClick: () -> Unit) {
    val statusColor = when (order.status) {
        "PENDING" -> PosGold
        "PREPARING" -> PosInfo
        "COMPLETED" -> PosAccent
        "CANCELLED" -> PosDanger
        else -> PosInkSoft
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
                Text(order.orderNumber, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.Bold)
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

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(order.customerName, style = MaterialTheme.typography.bodyLarge, color = PosPaper)
                    Text(dateFormatter.format(Date(order.createdAt)), style = MaterialTheme.typography.bodySmall, color = PosMuted)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(currencyFormatter.format(order.totalAmount), style = MaterialTheme.typography.titleLarge, color = PosGold, fontWeight = FontWeight.Bold)
                    Text(order.paymentMethod, style = MaterialTheme.typography.labelSmall, color = PosInkSoft)
                }
            }
        }
    }
}
