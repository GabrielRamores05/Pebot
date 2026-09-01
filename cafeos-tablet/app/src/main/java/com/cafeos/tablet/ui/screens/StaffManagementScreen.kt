package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
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
import com.cafeos.tablet.data.Staff
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffManagementScreen(viewModel: CafeViewModel) {
    val staff by viewModel.allStaff.collectAsState(initial = emptyList())
    var showAddDialog by remember { mutableStateOf(false) }
    var editingStaff by remember { mutableStateOf<Staff?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Staff Management", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Button(
                onClick = { editingStaff = null; showAddDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Staff", fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(staff) { member ->
                StaffCard(
                    staff = member,
                    onEdit = { editingStaff = member; showAddDialog = true },
                    onDelete = { scope.launch { viewModel.deleteStaff(member) } }
                )
            }
        }
    }

    if (showAddDialog) {
        StaffFormDialog(
            staff = editingStaff,
            onDismiss = { showAddDialog = false; editingStaff = null },
            onSave = { saved ->
                scope.launch {
                    viewModel.saveStaff(saved)
                    showAddDialog = false
                    editingStaff = null
                }
            }
        )
    }
}

@Composable
fun StaffCard(staff: Staff, onEdit: () -> Unit, onDelete: () -> Unit) {
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
                Text(staff.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                Text(staff.role, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                staff.email?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosInkSoft) }
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
fun StaffFormDialog(staff: Staff?, onDismiss: () -> Unit, onSave: (Staff) -> Unit) {
    var name by remember { mutableStateOf(staff?.name ?: "") }
    var role by remember { mutableStateOf(staff?.role ?: "STAFF") }
    var email by remember { mutableStateOf(staff?.email ?: "") }
    var phone by remember { mutableStateOf(staff?.phone ?: "") }
    var pin by remember { mutableStateOf(staff?.pin ?: "") }

    val roles = listOf("ADMIN", "MANAGER", "STAFF", "KITCHEN", "BARISTA")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (staff == null) "New Staff" else "Edit Staff", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = pin, onValueChange = { pin = it.filter { c -> c.isDigit() } }, label = { Text("PIN (6 digits)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))
                Text("Role", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    roles.forEach { r ->
                        FilterChip(
                            selected = role == r,
                            onClick = { role = r },
                            label = { Text(r) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PosAccentSoft,
                                selectedLabelColor = PosAccent
                            )
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val saved = if (staff == null) {
                            Staff(name = name, role = role, email = email.ifBlank { null }, phone = phone.ifBlank { null }, pin = pin.ifBlank { null })
                        } else {
                            staff.copy(name = name, role = role, email = email.ifBlank { null }, phone = phone.ifBlank { null }, pin = pin.ifBlank { null })
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
