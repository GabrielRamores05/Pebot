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
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun InventoryScreen(viewModel: CafeViewModel) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Products", "Ingredients", "Suppliers", "Capacity", "History", "Purchases")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(20.dp)
    ) {
        Text("Inventory", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
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
                    text = { Text(title) }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        when (selectedTab) {
            0 -> InventoryProductsTab(viewModel)
            1 -> InventoryIngredientsTab(viewModel)
            2 -> InventorySuppliersTab(viewModel)
            3 -> InventoryCapacityTab(viewModel)
            4 -> StockHistoryTab(viewModel)
            5 -> PurchasesTab(viewModel)
        }
    }
}

@Composable
fun InventoryProductsTab(viewModel: CafeViewModel) {
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())

    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(products) { product ->
            val ingredient = ingredients.find { it.name == product.name }
            val stock = ingredient?.currentStock ?: 0.0
            val min = ingredient?.minStock ?: 0.0
            val isLow = stock <= min && min > 0

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
                        Text(product.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                        Text("₱${product.price}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = if (ingredient != null) "${stock} ${ingredient.baseUnit}" else "No stock",
                            style = MaterialTheme.typography.titleLarge,
                            color = if (isLow) PosDanger else PosGold,
                            fontWeight = FontWeight.Bold
                        )
                        if (isLow) {
                            Text("Low Stock", color = PosDanger, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryIngredientsTab(viewModel: CafeViewModel) {
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    val suppliers by viewModel.suppliers.collectAsState(initial = emptyList())
    var showAdjustDialog by remember { mutableStateOf<Ingredient?>(null) }
    var showAddDialog by remember { mutableStateOf(false) }
    var showPurchaseDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column {
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(ingredients) { ingredient ->
                val isLow = ingredient.currentStock <= ingredient.minStock
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showAdjustDialog = ingredient }
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(ingredient.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                            Text(ingredient.category, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = "${ingredient.currentStock} ${ingredient.baseUnit}",
                                style = MaterialTheme.typography.titleLarge,
                                color = if (isLow) PosDanger else PosGold,
                                fontWeight = FontWeight.Bold
                            )
                            if (isLow) {
                                Text("Low Stock", color = PosDanger, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = { showAddDialog = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add Ingredient", fontWeight = FontWeight.SemiBold)
        }

        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(
            onClick = { showPurchaseDialog = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, PosGold)
        ) {
            Icon(Icons.Default.ShoppingCart, contentDescription = null, modifier = Modifier.size(18.dp), tint = PosGold)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Record Purchase", color = PosGold, fontWeight = FontWeight.SemiBold)
        }
    }

    showAdjustDialog?.let { ingredient ->
        AdjustStockDialog(
            ingredient = ingredient,
            onDismiss = { showAdjustDialog = null },
            onConfirm = { delta, notes ->
                viewModel.adjustStock(ingredient, delta, notes)
                showAdjustDialog = null
            }
        )
    }

    if (showAddDialog) {
        AddIngredientDialog(
            onDismiss = { showAddDialog = false },
            onSave = { name, category, baseUnit, currentStock, minStock, costPerUnit ->
                viewModel.addIngredient(name, category, baseUnit, currentStock, minStock, costPerUnit)
                showAddDialog = false
            }
        )
    }

    if (showPurchaseDialog) {
        PurchaseIngredientDialog(
            ingredients = ingredients,
            suppliers = suppliers,
            onDismiss = { showPurchaseDialog = false },
            onConfirm = { ingredientId, quantity, cost, supplierId, notes ->
                scope.launch {
                    viewModel.purchaseIngredient(ingredientId, quantity, cost, supplierId, notes)
                    showPurchaseDialog = false
                }
            }
        )
    }
}

@Composable
fun InventorySuppliersTab(viewModel: CafeViewModel) {
    val suppliers by viewModel.suppliers.collectAsState(initial = emptyList())
    var showAddDialog by remember { mutableStateOf(false) }
    var editingSupplier by remember { mutableStateOf<Supplier?>(null) }
    val scope = rememberCoroutineScope()

    Column {
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(suppliers) { supplier ->
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
                            Text(supplier.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                            Surface(
                                color = if (supplier.status == "ACTIVE") PosAccent.copy(alpha = 0.15f) else PosDanger.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(20.dp)
                            ) {
                                Text(
                                    text = supplier.status,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (supplier.status == "ACTIVE") PosAccent else PosDanger,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        supplier.contactPerson?.let { Text("Contact: $it", style = MaterialTheme.typography.bodySmall, color = PosMuted) }
                        supplier.phone?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosMuted) }
                        supplier.email?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosMuted) }
                    }
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp, end = 16.dp),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = { editingSupplier = supplier; showAddDialog = true }) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp))
                    }
                    TextButton(onClick = { scope.launch { viewModel.deleteSupplier(supplier) } }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = { editingSupplier = null; showAddDialog = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add Supplier", fontWeight = FontWeight.SemiBold)
        }
    }

    if (showAddDialog) {
        SupplierFormDialog(
            supplier = editingSupplier,
            onDismiss = { showAddDialog = false; editingSupplier = null },
            onSave = { saved ->
                scope.launch {
                    viewModel.saveSupplier(saved)
                    showAddDialog = false
                    editingSupplier = null
                }
            }
        )
    }
}

@Composable
fun InventoryCapacityTab(viewModel: CafeViewModel) {
    val capacity by viewModel.productionCapacity.collectAsState(initial = emptyList())

    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(capacity) { cap ->
            val remaining = (cap.currentStock ?: 0.0) - (cap.totalDemand ?: 0.0)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(cap.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Text("Stock: ${cap.currentStock} ${cap.baseUnit}", style = MaterialTheme.typography.bodyMedium, color = PosPaper)
                        Text("Demand: ${cap.totalDemand ?: 0.0} ${cap.baseUnit}", style = MaterialTheme.typography.bodyMedium, color = PosMuted)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = if (cap.currentStock > 0) ((cap.currentStock - (cap.totalDemand ?: 0.0)) / cap.currentStock).coerceIn(0.0, 1.0).toFloat() else 0f,
                        modifier = Modifier.fillMaxWidth(),
                        color = if (remaining >= 0) PosAccent else PosDanger,
                        trackColor = PosMuted
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (remaining >= 0) "Remaining: ${remaining} ${cap.baseUnit}" else "Shortfall: ${-remaining} ${cap.baseUnit}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (remaining >= 0) PosAccent else PosDanger,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
fun AddIngredientDialog(onDismiss: () -> Unit, onSave: (String, String, String, Double, Double, Double) -> Unit) {
    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var baseUnit by remember { mutableStateOf("g") }
    var currentStockText by remember { mutableStateOf("") }
    var minStockText by remember { mutableStateOf("") }
    var costPerUnitText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Ingredient", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = baseUnit, onValueChange = { baseUnit = it }, label = { Text("Base Unit (g, ml, pcs)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = currentStockText, onValueChange = { currentStockText = it }, label = { Text("Current Stock") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = minStockText, onValueChange = { minStockText = it }, label = { Text("Minimum Stock") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = costPerUnitText, onValueChange = { costPerUnitText = it }, label = { Text("Cost Per Unit (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val currentStock = currentStockText.toDoubleOrNull() ?: 0.0
                    val minStock = minStockText.toDoubleOrNull() ?: 0.0
                    val costPerUnit = costPerUnitText.toDoubleOrNull() ?: 0.0
                    if (name.isNotBlank() && category.isNotBlank() && baseUnit.isNotBlank()) {
                        onSave(name, category, baseUnit, currentStock, minStock, costPerUnit)
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

@Composable
fun AdjustStockDialog(ingredient: Ingredient, onDismiss: () -> Unit, onConfirm: (Double, String) -> Unit) {
    var amountText by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var isAdd by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Adjust Stock: ${ingredient.name}", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = isAdd, onClick = { isAdd = true }, colors = RadioButtonDefaults.colors(selectedColor = PosAccent))
                    Text("Add Stock", color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.width(16.dp))
                    RadioButton(selected = !isAdd, onClick = { isAdd = false }, colors = RadioButtonDefaults.colors(selectedColor = PosDanger))
                    Text("Reduce (Waste)", color = MaterialTheme.colorScheme.onSurface)
                }
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text("Amount (${ingredient.baseUnit})") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val delta = amountText.toDoubleOrNull() ?: 0.0
                    onConfirm(if (isAdd) delta else -delta, notes)
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Confirm", fontWeight = FontWeight.SemiBold)
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

@Composable
fun StockHistoryTab(viewModel: CafeViewModel) {
    val transactions by viewModel.allTransactions.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())
    val ingrMap = ingredients.associateBy { it.id }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(transactions) { txn ->
                val ing = ingrMap[txn.ingredientId]
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(ing?.name ?: "Unknown", style = MaterialTheme.typography.bodyMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                                Text(dateFormatter.format(Date(txn.createdAt)), style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                txn.notes?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosInkSoft) }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(txn.type, style = MaterialTheme.typography.labelMedium, color = if (txn.quantity > 0) PosAccent else PosDanger, fontWeight = FontWeight.Bold)
                                Text("${if (txn.quantity > 0) "+" else ""}${txn.quantity} ${ing?.baseUnit ?: ""}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PurchasesTab(viewModel: CafeViewModel) {
    val purchases by viewModel.allPurchases.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    val ingrMap = ingredients.associateBy { it.id }

    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(purchases) { txn ->
            val ing = ingrMap[txn.ingredientId]
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(ing?.name ?: "Unknown ingredient", style = MaterialTheme.typography.bodyMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                            Text(dateFormatter.format(Date(txn.createdAt)), style = MaterialTheme.typography.bodySmall, color = PosMuted)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = currencyFormatter.format(txn.quantity * (ing?.costPerUnit ?: 0.0)),
                                style = MaterialTheme.typography.titleMedium,
                                color = PosGold,
                                fontWeight = FontWeight.Bold
                            )
                            Text(txn.type, style = MaterialTheme.typography.labelSmall, color = PosMuted)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierFormDialog(supplier: Supplier?, onDismiss: () -> Unit, onSave: (Supplier) -> Unit) {
    var name by remember { mutableStateOf(supplier?.name ?: "") }
    var contactPerson by remember { mutableStateOf(supplier?.contactPerson ?: "") }
    var phone by remember { mutableStateOf(supplier?.phone ?: "") }
    var email by remember { mutableStateOf(supplier?.email ?: "") }
    var address by remember { mutableStateOf(supplier?.address ?: "") }
    var notes by remember { mutableStateOf(supplier?.notes ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (supplier == null) "New Supplier" else "Edit Supplier", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = contactPerson, onValueChange = { contactPerson = it }, label = { Text("Contact Person") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Address") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val saved = if (supplier == null) {
                            Supplier(name = name, contactPerson = contactPerson.ifBlank { null }, phone = phone.ifBlank { null }, email = email.ifBlank { null }, address = address.ifBlank { null }, notes = notes.ifBlank { null })
                        } else {
                            supplier.copy(name = name, contactPerson = contactPerson.ifBlank { null }, phone = phone.ifBlank { null }, email = email.ifBlank { null }, address = address.ifBlank { null }, notes = notes.ifBlank { null })
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
fun PurchaseIngredientDialog(
    ingredients: List<Ingredient>,
    suppliers: List<Supplier>,
    onDismiss: () -> Unit,
    onConfirm: (ingredientId: Int, quantity: Double, cost: Double, supplierId: Int?, notes: String?) -> Unit
) {
    var selectedIngredientId by remember { mutableStateOf<Int?>(null) }
    var quantityText by remember { mutableStateOf("") }
    var costText by remember { mutableStateOf("") }
    var selectedSupplierId by remember { mutableStateOf<Int?>(null) }
    var notes by remember { mutableStateOf("") }
    var ingredientExpanded by remember { mutableStateOf(false) }
    var supplierExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Record Purchase", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text("Ingredient", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                ExposedDropdownMenuBox(expanded = ingredientExpanded, onExpandedChange = { ingredientExpanded = it }) {
                    OutlinedTextField(
                        value = ingredients.find { it.id == selectedIngredientId }?.name ?: "Select ingredient",
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier.fillMaxWidth(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = ingredientExpanded) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                    ExposedDropdownMenu(expanded = ingredientExpanded, onDismissRequest = { ingredientExpanded = false }) {
                        ingredients.forEach { ing ->
                            DropdownMenuItem(text = { Text(ing.name) }, onClick = { selectedIngredientId = ing.id; ingredientExpanded = false })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                Text("Supplier", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                ExposedDropdownMenuBox(expanded = supplierExpanded, onExpandedChange = { supplierExpanded = it }) {
                    OutlinedTextField(
                        value = suppliers.find { it.id == selectedSupplierId }?.name ?: "Select supplier (optional)",
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier.fillMaxWidth(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = supplierExpanded) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                    ExposedDropdownMenu(expanded = supplierExpanded, onDismissRequest = { supplierExpanded = false }) {
                        suppliers.forEach { sup ->
                            DropdownMenuItem(text = { Text(sup.name) }, onClick = { selectedSupplierId = sup.id; supplierExpanded = false })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(value = quantityText, onValueChange = { quantityText = it }, label = { Text("Quantity") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = costText, onValueChange = { costText = it }, label = { Text("Cost per Unit (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val qty = quantityText.toDoubleOrNull()
                    val cost = costText.toDoubleOrNull()
                    if (selectedIngredientId != null && qty != null && cost != null) {
                        onConfirm(selectedIngredientId!!, qty, cost, selectedSupplierId, notes.ifBlank { null })
                        onDismiss()
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Record", fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}
