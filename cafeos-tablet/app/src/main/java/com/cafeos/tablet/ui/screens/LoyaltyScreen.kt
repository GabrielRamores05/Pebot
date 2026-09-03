package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoyaltyScreen(viewModel: CafeViewModel) {
    val customers by viewModel.allCustomers.collectAsState(initial = emptyList())
    val loyaltyCards by viewModel.allLoyaltyCards.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())

    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Customers", "Vouchers", "Settings")

    PremiumScreen {
        Text("Loyalty Program", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
        Text("Manage customers, vouchers, and rewards", style = MaterialTheme.typography.bodySmall, color = PosMuted)

        Spacer(modifier = Modifier.height(16.dp))

        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = PosCoffeeLight,
            contentColor = PosGold
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) },
                    selectedContentColor = PosGold,
                    unselectedContentColor = PosMuted
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        when (selectedTab) {
            0 -> LoyaltyCustomersTab(viewModel, customers, currencyFormatter, dateFormatter)
            1 -> LoyaltyVouchersTab(viewModel, currencyFormatter, dateFormatter)
            2 -> LoyaltySettingsTab(viewModel)
        }
    }
}

@Composable
fun LoyaltyCustomersTab(
    viewModel: CafeViewModel,
    customers: List<Customer>,
    currencyFormatter: NumberFormat,
    dateFormatter: SimpleDateFormat
) {
    var searchQuery by remember { mutableStateOf("") }
    var showAddCustomerDialog by remember { mutableStateOf(false) }
    var showAddPointsDialog by remember { mutableStateOf<Customer?>(null) }
    val scope = rememberCoroutineScope()

    val filteredCustomers = customers.filter {
        it.name.contains(searchQuery, ignoreCase = true) ||
            (it.contact?.contains(searchQuery, ignoreCase = true) ?: false)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Customers", style = MaterialTheme.typography.titleLarge, color = PosPaper)
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

        Spacer(modifier = Modifier.height(12.dp))

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

        Spacer(modifier = Modifier.height(12.dp))

            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(filteredCustomers) { customer ->
                CustomerLoyaltyCard(
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
fun CustomerLoyaltyCard(
    customer: Customer,
    currencyFormatter: NumberFormat,
    onAddPoints: () -> Unit
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
                Text(customer.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                customer.contact?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosMuted) }
                Text(
                    text = "${customer.loyaltyPoints} loyalty pts",
                    style = MaterialTheme.typography.bodySmall,
                    color = PosGold
                )
            }
            TextButton(onClick = onAddPoints) {
                Icon(Icons.Default.Edit, contentDescription = "Add Points", tint = PosGold, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
fun LoyaltyVouchersTab(
    viewModel: CafeViewModel,
    currencyFormatter: NumberFormat,
    dateFormatter: SimpleDateFormat
) {
    val allVouchers = remember { mutableStateListOf<LoyaltyVoucher>() }
    val scope = rememberCoroutineScope()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingVoucher by remember { mutableStateOf<LoyaltyVoucher?>(null) }

    LaunchedEffect(Unit) {
        val vouchers = viewModel.getAllVouchersNow()
        allVouchers.clear()
        allVouchers.addAll(vouchers)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Loyalty Vouchers", style = MaterialTheme.typography.titleLarge, color = PosPaper)
            Button(
                onClick = { editingVoucher = null; showAddDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Voucher", fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(allVouchers) { voucher ->
                VoucherCard(
                    voucher = voucher,
                    currencyFormatter = currencyFormatter,
                    dateFormatter = dateFormatter,
                    onEdit = { editingVoucher = voucher; showAddDialog = true },
                    onDelete = { scope.launch { viewModel.deleteVoucher(voucher); allVouchers.remove(voucher) } }
                )
            }
        }
    }

    if (showAddDialog) {
        VoucherFormDialog(
            voucher = editingVoucher,
            onDismiss = { showAddDialog = false; editingVoucher = null },
            onSave = { saved ->
                viewModel.saveVoucher(saved)
                showAddDialog = false
                editingVoucher = null
                scope.launch {
                    val voucher = viewModel.getAllVouchersNow().find { it.code == saved.code }
                    if (voucher != null) {
                        allVouchers.removeIf { it.code == saved.code }
                        allVouchers.add(0, voucher)
                    }
                }
            }
        )
    }
}

@Composable
fun LoyaltySettingsTab(viewModel: CafeViewModel) {
    val loyaltySettings by viewModel.loyaltySettings.collectAsState(initial = emptyList())
    var showAddDialog by remember { mutableStateOf(false) }
    var editingSetting by remember { mutableStateOf<LoyaltySetting?>(null) }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize()) {
        Text("Loyalty Settings", style = MaterialTheme.typography.titleLarge, color = PosPaper)

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(loyaltySettings) { setting ->
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
                                Text(setting.key, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                                Text(setting.value, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                Text("Scope: ${setting.scope}", style = MaterialTheme.typography.bodySmall, color = PosInkSoft)
                            }
                            Row {
                                TextButton(onClick = { editingSetting = setting; showAddDialog = true }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp))
                                }
                                TextButton(onClick = {
                                    scope.launch {
                                        viewModel.deleteLoyaltySetting(setting)
                                    }
                                }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = { editingSetting = null; showAddDialog = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add Setting", fontWeight = FontWeight.SemiBold)
        }
    }

    if (showAddDialog) {
        LoyaltySettingFormDialog(
            setting = editingSetting,
            onDismiss = { showAddDialog = false; editingSetting = null },
            onSave = { key, value, scope ->
                viewModel.setLoyaltySetting(key, value, scope)
                showAddDialog = false
                editingSetting = null
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoyaltySettingFormDialog(
    setting: LoyaltySetting?,
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit
) {
    var key by remember { mutableStateOf(setting?.key ?: "") }
    var value by remember { mutableStateOf(setting?.value ?: "") }
    var scope by remember { mutableStateOf(setting?.scope ?: "GLOBAL") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (setting == null) "New Loyalty Setting" else "Edit Setting", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = key, onValueChange = { key = it }, label = { Text("Key") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = value, onValueChange = { value = it }, label = { Text("Value") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = scope, onValueChange = { scope = it }, label = { Text("Scope") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (key.isNotBlank() && value.isNotBlank()) {
                        onSave(key, value, scope)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
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
