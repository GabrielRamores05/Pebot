package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Station
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StationsScreen(viewModel: CafeViewModel) {
    val stations by viewModel.stations.collectAsState(initial = emptyList())
    var showDialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Station?>(null) }
    val scope = rememberCoroutineScope()

    PremiumScreen {
        PremiumHeader("Stations", "Kitchen stations used for routing and staffing")
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Stations", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Button(
                onClick = { editing = null; showDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Station", fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (stations.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                        Text("No stations yet — add one to start routing orders", color = PosMuted)
                    }
                }
            }
            items(stations) { station ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = PosAccentSoft, shape = RoundedCornerShape(12.dp)) {
                                Text(
                                    station.emoji ?: "⚙️",
                                    modifier = Modifier.padding(10.dp),
                                    style = MaterialTheme.typography.titleLarge
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(station.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                                Text(station.stationType, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Surface(
                                color = if (station.active) PosAccentSoft else PosDangerSoft,
                                shape = RoundedCornerShape(20.dp)
                            ) {
                                Text(
                                    if (station.active) "ACTIVE" else "INACTIVE",
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (station.active) PosAccent else PosDanger,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Row {
                                IconButton(onClick = { editing = station; showDialog = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp))
                                }
                                IconButton(onClick = { scope.launch { viewModel.deleteStation(station) } }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showDialog) {
        StationFormDialog(
            station = editing,
            onDismiss = { showDialog = false; editing = null },
            onSave = { saved ->
                scope.launch { viewModel.saveStation(saved) }
                showDialog = false
                editing = null
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StationFormDialog(station: Station?, onDismiss: () -> Unit, onSave: (Station) -> Unit) {
    var name by remember { mutableStateOf(station?.name ?: "") }
    var stationType by remember { mutableStateOf(station?.stationType ?: "general") }
    var emoji by remember { mutableStateOf(station?.emoji ?: "☕") }
    var active by remember { mutableStateOf(station?.active ?: true) }
    val types = listOf("coffee", "kitchen", "bar", "pastry", "general")
    val emojiChoices = listOf("☕", "🍳", "🥤", "🧁", "📦", "🍰", "🔥", "🍞")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (station == null) "New Station" else "Edit Station", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Station name") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))
                Text("Type", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    types.forEach { t ->
                        FilterChip(selected = stationType == t, onClick = { stationType = t }, label = { Text(t) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text("Icon", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    emojiChoices.forEach { e ->
                        FilterChip(selected = emoji == e, onClick = { emoji = e }, label = { Text(e) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Active", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.width(8.dp))
                    Switch(checked = active, onCheckedChange = { active = it }, colors = SwitchDefaults.colors(checkedThumbColor = PosAccent))
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val saved = (station ?: Station(name = name, stationType = stationType)).copy(
                            name = name.trim(),
                            stationType = stationType,
                            emoji = emoji,
                            active = active
                        )
                        onSave(saved)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) { Text("Save", fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) } },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}
