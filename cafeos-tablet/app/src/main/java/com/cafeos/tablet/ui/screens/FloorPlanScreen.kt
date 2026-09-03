package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.CafeTable
import com.cafeos.tablet.data.TableSession
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun FloorPlanScreen(viewModel: CafeViewModel) {
    val tables by viewModel.tables.collectAsState(initial = emptyList())
    val activeSessions by viewModel.activeTableSessions.collectAsState(initial = emptyList())
    val tableSessionMap = activeSessions.associateBy { it.tableId }

    var selectedTable by remember { mutableStateOf<CafeTable?>(null) }
    var showTableForm by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    PremiumScreen {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Floor Plan", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            IconButton(onClick = { showTableForm = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Table", tint = PosPaper)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (tables.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Restaurant, contentDescription = null, tint = PosMuted, modifier = Modifier.size(48.dp))
                    Text("No tables configured. Add tables to get started.", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
                }
            }
        } else {
                LazyVerticalGrid(
                    modifier = Modifier.weight(1f),
                columns = GridCells.Adaptive(140.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(tables) { table ->
                    val session = tableSessionMap[table.id]
                    val isOccupied = session != null && session.status == "OCCUPIED"

                    TableCard(
                        table = table,
                        session = session,
                        isOccupied = isOccupied,
                        onClick = { selectedTable = table }
                    )
                }
            }
        }
    }

    selectedTable?.let { table ->
        TableDetailSheet(
            table = table,
            session = tableSessionMap[table.id],
            onDismiss = { selectedTable = null },
            onEdit = { showTableForm = true; selectedTable = null },
            onDelete = {
                scope.launch {
                    viewModel.deleteTable(table)
                }
                selectedTable = null
            },
            onOpenSession = { guestCount ->
                viewModel.openTableSession(table.id, guestCount)
            },
            onCloseSession = {
                tableSessionMap[table.id]?.let { viewModel.closeTableSession(it.id) }
            }
        )
    }

    if (showTableForm) {
        TableFormDialog(
            table = null,
            onDismiss = { showTableForm = false },
            onSave = { saved ->
                scope.launch {
                    viewModel.saveTable(saved)
                }
                showTableForm = false
            }
        )
    }
}

@Composable
fun TableCard(table: CafeTable, session: TableSession?, isOccupied: Boolean, onClick: () -> Unit) {
    val statusColor = if (isOccupied) PosDanger else PosAccent
    val bgColor = if (isOccupied) PosDangerSoft else PosCoffeeLight

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(statusColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Restaurant, contentDescription = null, tint = statusColor, modifier = Modifier.size(28.dp))
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(table.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.Bold)
            Text(
                text = "Seats ${table.capacity}",
                style = MaterialTheme.typography.bodySmall,
                color = if (isOccupied) PosDanger else PosMuted
            )

            if (isOccupied) {
                Spacer(modifier = Modifier.height(4.dp))
                Surface(
                    color = PosDanger.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = "${session?.guestCount ?: 0} guests",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = PosDanger,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TableDetailSheet(
    table: CafeTable,
    session: TableSession?,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onOpenSession: (Int) -> Unit,
    onCloseSession: () -> Unit
) {
    var guestCountText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Table ${table.name}", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text("Capacity: ${table.capacity} seats", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (session != null && session.status == "OCCUPIED") {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Guest Count: ${session.guestCount}", style = MaterialTheme.typography.bodyMedium, color = PosGold)
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (session != null && session.status == "OCCUPIED") {
                    OutlinedButton(
                        onClick = onCloseSession,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Close Session", color = PosDanger)
                    }
                } else {
                    OutlinedTextField(
                        value = guestCountText,
                        onValueChange = { guestCountText = it.filter { c -> c.isDigit() } },
                        label = { Text("Guest Count") },
                        modifier = Modifier.width(100.dp),
                        singleLine = true
                    )
                    Button(
                        onClick = {
                            val count = guestCountText.toIntOrNull() ?: 1
                            onOpenSession(count)
                            guestCountText = ""
                            onDismiss()
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                    ) {
                        Text("Open")
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = {
                onEdit()
                onDismiss()
            }) {
                Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Edit", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            TextButton(onClick = {
                onDelete()
                onDismiss()
            }) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Delete", color = PosDanger)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TableFormDialog(table: CafeTable?, onDismiss: () -> Unit, onSave: (CafeTable) -> Unit) {
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
                        listOf("AVAILABLE", "RESERVED", "OCCUPIED").forEach { s ->
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