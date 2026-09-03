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
        PremiumHeader("Order History", "Search, review, and export completed sales")
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Order History", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { templateLauncher.launch("order-history-template.csv") }) { Text("Template") }
                OutlinedButton(onClick = { importLauncher.launch(arrayOf("text/*", "application/vnd.ms-excel")) }) { Text("Import") }
                Button(onClick = { exportLauncher.launch("order-history.csv") }, colors = ButtonDefaults.buttonColors(containerColor = PosAccent)) { Text("Export") }
            }
        }
        importMessage?.let { Text(it, color = PosGold, modifier = Modifier.padding(top = 8.dp)) }
        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(orders) { order ->
                OrderCard(order, currencyFormatter, dateFormatter, onClick = { selectedOrder = order })
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
