package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Product
import com.cafeos.tablet.data.ProductStation
import com.cafeos.tablet.data.Station
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StationAssignmentScreen(viewModel: CafeViewModel) {
    val stations by viewModel.stations.collectAsState(initial = emptyList())
    val products by viewModel.allProducts.collectAsState(initial = emptyList())

    var selectedStationId by remember { mutableStateOf<Int?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var showAssignDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    var assignedProductsState by remember { mutableStateOf<List<ProductStation>>(emptyList()) }

    LaunchedEffect(selectedStationId) {
        selectedStationId?.let { stationId ->
            assignedProductsState = viewModel.getProductsForStation(stationId)
        } ?: run {
            assignedProductsState = emptyList()
        }
    }

    val assignedProductIds = if (selectedStationId != null) {
        assignedProductsState.map { it.productId }
    } else emptyList()

    val filteredProducts = if (searchQuery.isBlank()) {
        products
    } else {
        products.filter { it.name.contains(searchQuery, ignoreCase = true) }
    }

    val productMap = products.associateBy { it.id }

    PremiumScreen {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Station Assignment", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            IconButton(onClick = { /* Add station via SettingsScreen */ }) {
                Icon(Icons.Default.Add, contentDescription = "Add Station", tint = PosPaper)
            }
        }
        Text("Route products to kitchen stations for focused display", style = MaterialTheme.typography.bodyMedium, color = PosMuted, modifier = Modifier.padding(top = 4.dp))

        Spacer(modifier = Modifier.height(16.dp))

        if (stations.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
            ) {
                Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Restaurant, contentDescription = null, tint = PosMuted, modifier = Modifier.size(48.dp))
                    Text("No stations configured. Add stations in Settings.", style = MaterialTheme.typography.bodyMedium, color = PosMuted)
                }
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(stations) { station ->
                    StationAssignmentCard(
                        station = station,
                        assignedProductIds = if (selectedStationId == station.id) assignedProductIds else emptyList(),
                        productMap = productMap,
                        isSelected = selectedStationId == station.id,
                        onClick = { selectedStationId = station.id },
                        onDeleteAssignment = { productId ->
                            scope.launch {
                                viewModel.deleteProductStation(productId, station.id)
                                selectedStationId?.let { sid ->
                                    assignedProductsState = viewModel.getProductsForStation(sid)
                                }
                            }
                        }
                    )
                }
                if (selectedStationId != null) {
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = { showAssignDialog = true },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, PosGold)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = PosGold, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Assign Product to Station", color = PosGold)
                        }
                    }
                }
                item {
                    Spacer(modifier = Modifier.height(72.dp))
                }
            }
        }
    }

    if (showAssignDialog) {
        AssignProductDialog(
            products = filteredProducts,
            searchQuery = searchQuery,
            onSearchChange = { searchQuery = it },
            onDismiss = { showAssignDialog = false; searchQuery = "" },
            onAssign = { productId ->
                selectedStationId?.let { stationId ->
                    viewModel.assignProductToStation(productId, stationId)
                }
                showAssignDialog = false
                searchQuery = ""
            }
        )
    }
}

@Composable
fun StationAssignmentCard(
    station: Station,
    assignedProductIds: List<Int>,
    productMap: Map<Int, Product>,
    isSelected: Boolean,
    onClick: () -> Unit,
    onDeleteAssignment: (Int) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = if (isSelected) PosAccentSoft else PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isSelected) 4.dp else 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Default.Restaurant, contentDescription = null, tint = PosGold, modifier = Modifier.size(24.dp))
                    Text(station.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                }
                Surface(
                    color = if (station.active) PosAccent.copy(alpha = 0.15f) else PosDanger.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = if (station.active) "Active" else "Inactive",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (station.active) PosAccent else PosDanger,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text("${assignedProductIds.size} products assigned", style = MaterialTheme.typography.bodySmall, color = PosMuted)

            if (assignedProductIds.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                LazyColumn {
                    items(assignedProductIds.take(5)) { productId ->
                        val product = productMap[productId]
                        product?.let {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 2.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(product.name, style = MaterialTheme.typography.bodySmall, color = PosPaper)
                                Text(product.stationType.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.labelSmall, color = PosMuted)
                            }
                        }
                    }
                    if (assignedProductIds.size > 5) {
                        item {
                            Text("... and ${assignedProductIds.size - 5} more", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssignProductDialog(
    products: List<Product>,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onAssign: (Int) -> Unit
) {
    val filtered = if (searchQuery.isBlank()) products else products.filter { it.name.contains(searchQuery, ignoreCase = true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Assign Product to Station", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.height(300.dp)) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchChange,
                    label = { Text("Search products") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = PosMuted) },
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline, focusedTextColor = PosPaper, unfocusedTextColor = PosPaper)
                )
                Spacer(modifier = Modifier.height(8.dp))
                LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(filtered) { product ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onAssign(product.id) }
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(product.name, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                            Text(product.stationType.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.labelSmall, color = PosMuted)
                        }
                    }
                    if (filtered.isEmpty()) {
                        item {
                            Text("No products found.", style = MaterialTheme.typography.bodySmall, color = PosMuted, modifier = Modifier.padding(12.dp))
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}