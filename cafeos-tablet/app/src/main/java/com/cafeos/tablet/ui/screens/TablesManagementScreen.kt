package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
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
import com.cafeos.tablet.data.CafeTable
import com.cafeos.tablet.data.TableSection
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TablesManagementScreen(viewModel: CafeViewModel) {
    val tables by viewModel.tables.collectAsState(initial = emptyList())
    val sections by viewModel.allTableSections.collectAsState(initial = emptyList())
    val allOrders by viewModel.allOrders.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var showTableForm by remember { mutableStateOf(false) }
    var editingTable by remember { mutableStateOf<CafeTable?>(null) }
    var showSectionForm by remember { mutableStateOf(false) }
    var editingSection by remember { mutableStateOf<TableSection?>(null) }

    val filteredTables = if (searchQuery.isBlank()) {
        tables
    } else {
        tables.filter { it.name.contains(searchQuery, ignoreCase = true) }
    }

    PremiumScreen {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Tables", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(onClick = { editingSection = null; showSectionForm = true }) {
                    Icon(Icons.Default.Restaurant, contentDescription = "Manage Sections", tint = PosPaper)
                }
                IconButton(onClick = { editingTable = null; showTableForm = true }) {
                    Icon(Icons.Default.Add, contentDescription = "Add Table", tint = PosPaper)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            label = { Text("Search tables") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = PosMuted) },
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = PosBorder, focusedTextColor = PosPaper, unfocusedTextColor = PosPaper)
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (filteredTables.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Restaurant, contentDescription = null, tint = PosMuted, modifier = Modifier.size(48.dp))
                    Text("No tables found.", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
                }
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(filteredTables) { table ->
                    val occupant = allOrders
                        .filter { it.tableId == table.id && (it.status == "PENDING" || it.status == "PREPARING") }
                        .maxByOrNull { it.createdAt }?.customerName
                    TableManagementCard(
                        table = table,
                        sections = sections,
                        occupantName = occupant,
                        onEdit = { editingTable = table; showTableForm = true },
                        onDelete = { scope.launch { viewModel.deleteTable(table) } },
                        onSetOccupancy = { delta ->
                            scope.launch {
                                viewModel.saveTable(table.copy(currentOccupants = (table.currentOccupants + delta).coerceIn(0, table.capacity)))
                            }
                        },
                        onCycleStatus = {
                            scope.launch {
                                val next = nextTableStatus(table.status)
                                viewModel.saveTable(table.copy(status = next))
                            }
                        }
                    )
                }
                item {
                    Spacer(modifier = Modifier.height(72.dp))
                }
            }
        }
    }

    if (showTableForm) {
        TableFormDialog(
            table = editingTable,
            sections = sections,
            onDismiss = { showTableForm = false; editingTable = null },
            onSave = { saved ->
                scope.launch {
                    viewModel.saveTable(saved)
                    showTableForm = false
                    editingTable = null
                }
            }
        )
    }

    if (showSectionForm) {
        TableSectionFormDialog(
            section = editingSection,
            tables = tables,
            onDismiss = { showSectionForm = false; editingSection = null },
            onSave = { saved ->
                scope.launch {
                    viewModel.saveTableSection(saved)
                    showSectionForm = false
                    editingSection = null
                }
            }
        )
    }
}

private fun nextTableStatus(current: String): String = when (current) {
    "AVAILABLE" -> "OCCUPIED"
    "OCCUPIED" -> "NEEDS_CLEANING"
    "RESERVED" -> "AVAILABLE"
    else -> "AVAILABLE" // NEEDS_CLEANING or anything else → ready again
}

@Composable
fun TableManagementCard(
    table: CafeTable,
    sections: List<TableSection>,
    occupantName: String? = null,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onSetOccupancy: (Int) -> Unit,
    onCycleStatus: () -> Unit
) {
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
            Column(modifier = Modifier.weight(1f)) {
                Text(table.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                Text("Capacity: ${table.capacity}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                val sectionNames = sections.filter { section ->
                    section.tableIds.split(",").mapNotNull { it.toIntOrNull() }.contains(table.id)
                }.map { it.name }
                if (sectionNames.isNotEmpty()) {
                    Text("Section: ${sectionNames.joinToString { it }}", style = MaterialTheme.typography.bodySmall, color = PosGold)
                }
                val statusColor = when (table.status) {
                    "AVAILABLE" -> PosAccent
                    "OCCUPIED" -> PosDanger
                    "NEEDS_CLEANING" -> PosGold
                    "RESERVED" -> PosInfo
                    else -> PosInkSoft
                }
                Text(table.status, style = MaterialTheme.typography.labelSmall, color = statusColor, fontWeight = FontWeight.Bold)
                if (!occupantName.isNullOrBlank()) {
                    Text("Occupant: $occupantName", style = MaterialTheme.typography.bodySmall, color = PosInk, fontWeight = FontWeight.Bold)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Guests: ${table.currentOccupants}/${table.capacity}", style = MaterialTheme.typography.bodySmall, color = PosInkSoft)
                    TextButton(onClick = { onSetOccupancy(-1) }, contentPadding = PaddingValues(horizontal = 6.dp)) { Text("−", fontWeight = FontWeight.Bold) }
                    TextButton(onClick = { onSetOccupancy(1) }, contentPadding = PaddingValues(horizontal = 6.dp)) { Text("+", fontWeight = FontWeight.Bold) }
                }
                TextButton(onClick = onCycleStatus, contentPadding = PaddingValues(0.dp)) {
                    Text(
                        "Mark ${nextTableStatus(table.status)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = PosAccent,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Row {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TableSectionFormDialog(
    section: TableSection?,
    tables: List<CafeTable>,
    onDismiss: () -> Unit,
    onSave: (TableSection) -> Unit
) {
    var name by remember { mutableStateOf(section?.name ?: "") }
    var floorNumberText by remember { mutableStateOf(section?.floorNumber?.toString() ?: "1") }
    var selectedTableIds by remember { mutableStateOf<Set<Int>>(section?.tableIds?.split(",")?.mapNotNull { it.toIntOrNull() }?.toSet() ?: emptySet()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (section == null) "New Section" else "Edit Section", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.height(300.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Section Name") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = floorNumberText,
                    onValueChange = { floorNumberText = it.filter { c -> c.isDigit() } },
                    label = { Text("Floor Number") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("Tables", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(tables) { table ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(table.name, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                            Checkbox(
                                checked = selectedTableIds.contains(table.id),
                                onCheckedChange = {
                                    selectedTableIds = if (it) {
                                        selectedTableIds + table.id
                                    } else {
                                        selectedTableIds - table.id
                                    }
                                },
                                colors = CheckboxDefaults.colors(checkedColor = PosAccent)
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val tableIdsStr = selectedTableIds.joinToString(",")
                        val saved = if (section == null) {
                            TableSection(name = name, tableIds = tableIdsStr, floorNumber = floorNumberText.toIntOrNull() ?: 1)
                        } else {
                            section.copy(name = name, tableIds = tableIdsStr, floorNumber = floorNumberText.toIntOrNull() ?: 1)
                        }
                        onSave(saved)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Save", fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TableFormDialog(table: CafeTable?, sections: List<TableSection>, onDismiss: () -> Unit, onSave: (CafeTable) -> Unit) {
    var name by remember { mutableStateOf(table?.name ?: "") }
    var capacityText by remember { mutableStateOf(table?.capacity?.toString() ?: "4") }
    var statusExpanded by remember { mutableStateOf(false) }
    var statusText by remember { mutableStateOf(table?.status ?: "AVAILABLE") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (table == null) "New Table" else "Edit Table", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Table Name (e.g., T1, P2)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = capacityText,
                    onValueChange = { capacityText = it.filter { c -> c.isDigit() } },
                    label = { Text("Seating Capacity") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                ExposedDropdownMenuBox(expanded = statusExpanded, onExpandedChange = { statusExpanded = it }) {
                    OutlinedTextField(
                        value = statusText.replaceFirstChar { it.uppercase() },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Status") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = statusExpanded) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                    ExposedDropdownMenu(expanded = statusExpanded, onDismissRequest = { statusExpanded = false }) {
                        listOf("AVAILABLE", "RESERVED", "OCCUPIED", "NEEDS_CLEANING").forEach { s ->
                            DropdownMenuItem(text = { Text(s.replaceFirstChar { it.uppercase() }) }, onClick = { statusText = s; statusExpanded = false })
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val saved = if (table == null) {
                            CafeTable(name = name, capacity = capacityText.toIntOrNull() ?: 4, status = statusText)
                        } else {
                            table.copy(name = name, capacity = capacityText.toIntOrNull() ?: 4, status = statusText)
                        }
                        onSave(saved)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Save", fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}