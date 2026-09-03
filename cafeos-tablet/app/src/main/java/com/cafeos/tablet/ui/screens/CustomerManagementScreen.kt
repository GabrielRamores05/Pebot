package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.*

@Composable
fun CustomerManagementScreen(viewModel: CafeViewModel) {
    val customers by viewModel.allCustomers.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    var searchQuery by remember { mutableStateOf("") }
    var showAddPointsDialog by remember { mutableStateOf<com.cafeos.tablet.data.Customer?>(null) }
    var showAddCustomerDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val filteredCustomers = customers.filter {
        it.name.contains(searchQuery, ignoreCase = true) ||
        (it.contact?.contains(searchQuery, ignoreCase = true) ?: false)
    }

    PremiumScreen {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Customers", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Button(
                onClick = { showAddCustomerDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Customer", fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            label = { Text("Search customers") },
            modifier = Modifier.fillMaxWidth(),
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = PosMuted) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = PosAccent,
                unfocusedBorderColor = PosBorder,
                focusedTextColor = PosPaper,
                unfocusedTextColor = PosPaper,
                cursorColor = PosAccent
            ),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(filteredCustomers) { customer ->
                CustomerCard(
                    customer = customer,
                    currencyFormatter = currencyFormatter,
                    onAddPoints = { showAddPointsDialog = customer }
                )
            }
        }
    }

    showAddPointsDialog?.let { customer ->
        AddPointsDialog(
            customer = customer,
            onDismiss = { showAddPointsDialog = null },
            onConfirm = { points ->
                scope.launch {
                    viewModel.updateCustomerPoints(customer.id, customer.loyaltyPoints + points)
                    showAddPointsDialog = null
                }
            }
        )
    }

    if (showAddCustomerDialog) {
        AddCustomerDialog(
            onDismiss = { showAddCustomerDialog = false },
            onSave = { name, contact ->
                viewModel.addCustomer(name, contact.ifBlank { null })
                showAddCustomerDialog = false
            }
        )
    }
}

@Composable
fun CustomerCard(
    customer: com.cafeos.tablet.data.Customer,
    currencyFormatter: NumberFormat,
    onAddPoints: () -> Unit
) {
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
                    Text(customer.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    customer.contact?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosMuted) }
                }
                Surface(
                    color = PosGold.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = "${customer.loyaltyPoints} pts",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = PosGold,
                        fontWeight = FontWeight.Bold
                    )
                }
                TextButton(onClick = onAddPoints) {
                    Icon(Icons.Default.Edit, contentDescription = "Add Points", tint = PosGold, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@Composable
fun AddPointsDialog(customer: com.cafeos.tablet.data.Customer, onDismiss: () -> Unit, onConfirm: (Int) -> Unit) {
    var pointsText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Points: ${customer.name}", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            OutlinedTextField(
                value = pointsText,
                onValueChange = { pointsText = it.filter { c -> c.isDigit() } },
                label = { Text("Points") },
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline),
                singleLine = true
            )
        },
        confirmButton = {
            Button(onClick = {
                val pts = pointsText.toIntOrNull() ?: 0
                if (pts > 0) onConfirm(pts)
            }, colors = ButtonDefaults.buttonColors(containerColor = PosAccent), shape = RoundedCornerShape(12.dp)) {
                Text("Add", fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}

@Composable
fun AddCustomerDialog(onDismiss: () -> Unit, onSave: (String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Customer", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = contact, onValueChange = { contact = it }, label = { Text("Contact (optional)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
            }
        },
        confirmButton = {
            Button(onClick = {
                if (name.isNotBlank()) {
                    onSave(name, contact)
                }
            }, colors = ButtonDefaults.buttonColors(containerColor = PosAccent), shape = RoundedCornerShape(12.dp)) {
                Text("Save", fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}
