package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.CafeTable
import com.cafeos.tablet.data.Guest
import com.cafeos.tablet.data.TableSession
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun GuestManagementScreen(viewModel: CafeViewModel) {
    val tables by viewModel.tables.collectAsState(initial = emptyList())
    val activeSessions by viewModel.activeTableSessions.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    var selectedSessionId by remember { mutableStateOf<Int?>(null) }
    var showAddGuest by remember { mutableStateOf(false) }
    var editingGuest by remember { mutableStateOf<Guest?>(null) }

    val selectedSession = activeSessions.find { it.id == selectedSessionId }

    var guestsState by remember { mutableStateOf<List<Guest>>(emptyList()) }
    LaunchedEffect(selectedSessionId) {
        selectedSessionId?.let {
            guestsState = viewModel.getGuestsForSession(it)
        } ?: run {
            guestsState = emptyList()
        }
    }

    PremiumScreen {
        Text("Guest Management", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
        Text("Manage guests at occupied tables", style = MaterialTheme.typography.bodyMedium, color = PosMuted, modifier = Modifier.padding(top = 4.dp))

        Spacer(modifier = Modifier.height(16.dp))

        if (activeSessions.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = PosMuted, modifier = Modifier.size(48.dp))
                    Text("No active table sessions.", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
                }
            }
        } else {
            if (selectedSessionId == null) {
                LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(activeSessions) { session ->
                        val table = tables.find { it.id == session.tableId }
                        SessionCard(
                            session = session,
                            table = table,
                            onClick = { selectedSessionId = session.id }
                        )
                    }
                }
            } else {
                selectedSession?.let { session ->
                    val table = tables.find { it.id == session.tableId }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            "Table ${table?.name ?: session.tableId} · ${session.guestCount} guests",
                            style = MaterialTheme.typography.titleMedium,
                            color = PosPaper,
                            fontWeight = FontWeight.Bold
                        )
                        TextButton(onClick = { selectedSessionId = null }) {
                            Text("Back", color = PosGold)
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))

                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(guestsState, key = { it.id }) { guest ->
                            GuestCard(
                                guest = guest,
                                onEdit = { editingGuest = guest; showAddGuest = true },
                                onRemove = { scope.launch { viewModel.markGuestLeft(guest.id) } }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = { showAddGuest = true },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = PosPaper, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Add Guest", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }

    if (showAddGuest && selectedSessionId != null) {
        GuestFormDialog(
            guest = editingGuest,
            onDismiss = { showAddGuest = false; editingGuest = null },
            onSave = { name, mood ->
                scope.launch {
                    if (editingGuest == null) {
                        viewModel.addGuest(selectedSessionId!!, name.ifBlank { null })
                    } else {
                        viewModel.updateGuestMood(editingGuest!!, mood)
                    }
                    showAddGuest = false
                    editingGuest = null
                    selectedSessionId?.let { sid ->
                        guestsState = viewModel.getGuestsForSession(sid)
                    }
                }
            }
        )
    }
}

@Composable
fun SessionCard(session: TableSession, table: CafeTable?, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
                Text(
                    table?.name ?: "Table ${session.tableId}",
                    style = MaterialTheme.typography.titleMedium,
                    color = PosPaper,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "${session.guestCount} guests • Opened: ${java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault()).format(java.util.Date(session.startedAt))}",
                    style = MaterialTheme.typography.bodySmall,
                    color = PosMuted
                )
            }
            Surface(
                color = when (session.status) {
                    "OCCUPIED" -> PosDanger.copy(alpha = 0.15f)
                    else -> PosAccent.copy(alpha = 0.15f)
                },
                shape = RoundedCornerShape(20.dp)
            ) {
                Text(
                    text = when (session.status) {
                        "OCCUPIED" -> "Occupied"
                        "CLOSED" -> "Closed"
                        else -> session.status
                    },
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (session.status == "OCCUPIED") PosDanger else PosAccent,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuestCard(guest: Guest, onEdit: () -> Unit, onRemove: () -> Unit) {
    val moodColor = when (guest.mood) {
        "HAPPY" -> Color(0xFF4CAF50)
        "NEUTRAL" -> PosGold
        "UNHAPPY" -> PosDanger
        else -> PosInkSoft
    }

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
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(moodColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = moodColor, modifier = Modifier.size(20.dp))
                }
                Column {
                    Text(guest.name ?: "Unnamed Guest", style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Text(
                        text = guest.mood ?: "No mood set",
                        style = MaterialTheme.typography.bodySmall,
                        color = moodColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Row {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp))
                }
                IconButton(onClick = onRemove) {
                    Icon(Icons.Default.Delete, contentDescription = "Remove", tint = PosDanger, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuestFormDialog(guest: Guest?, onDismiss: () -> Unit, onSave: (String, String) -> Unit) {
    var name by remember { mutableStateOf(guest?.name ?: "") }
    var mood by remember { mutableStateOf(guest?.mood ?: "NEUTRAL") }
    var moodExpanded by remember { mutableStateOf(false) }

    val moods = listOf("HAPPY", "NEUTRAL", "UNHAPPY")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (guest == null) "Add Guest" else "Edit Guest", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                ExposedDropdownMenuBox(expanded = moodExpanded, onExpandedChange = { moodExpanded = it }) {
                    OutlinedTextField(
                        value = mood.replaceFirstChar { it.uppercase() },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Mood") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = moodExpanded) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                    ExposedDropdownMenu(expanded = moodExpanded, onDismissRequest = { moodExpanded = false }) {
                        moods.forEach { m ->
                            DropdownMenuItem(
                                text = { Text(m.replaceFirstChar { it.uppercase() }) },
                                onClick = { mood = m; moodExpanded = false }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(name, mood)
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