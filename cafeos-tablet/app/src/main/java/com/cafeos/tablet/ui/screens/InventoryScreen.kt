package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.grid.itemsIndexed as gridItemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ArrowDropUp
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.ProductCapacityInfo
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.first
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

/** Formats a stock value without trailing ".0" when it is a whole number. */
private fun trimStock(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString() else "%.2f".format(value)

@Composable
fun InventoryScreen(viewModel: CafeViewModel) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Products", "Ingredients", "Suppliers", "Capacity", "History", "Purchases", "Alerts")

    PremiumScreen {
        PremiumHeader("Inventory", "Keep stock levels accurate and calm")
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
            6 -> LowStockAlertTab(viewModel)
        }
    }
}

@Composable
fun InventoryProductsTab(viewModel: CafeViewModel) {
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    var producible by remember { mutableStateOf<Map<Int, Int?>>(emptyMap()) }

    // A product's true availability = how many units the current ingredient
    // supply can produce (limiting ingredient wins), matching the web café
    // model where prepared items draw their stock from ingredients.
    LaunchedEffect(products.map { it.id }, ingredients.map { it.id to it.currentStock }) {
        val map = mutableMapOf<Int, Int?>()
        for (product in products) {
            val recipe = viewModel.getProductIngredients(product.id)
            val units = if (recipe.isEmpty()) {
                null
            } else {
                val perIngredient = recipe.mapNotNull { item ->
                    if (item.quantity <= 0.0) return@mapNotNull null
                    val ing = ingredients.find { it.id == item.ingredientId } ?: return@mapNotNull null
                    (ing.currentStock / item.quantity).toInt()
                }
                perIngredient.minOrNull()
            }
            map[product.id] = units
        }
        producible = map
    }

    // Product stock cards in a fixed 5-per-row grid.
    LazyVerticalGrid(
        columns = GridCells.Fixed(5),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        gridItems(products) { product ->
            val units = producible[product.id]

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp)
                ) {
                    Text(
                        product.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = PosPaper,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text("₱${product.price}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = when {
                            units == null -> "—"
                            units > 0 -> NumberFormat.getNumberInstance(Locale.US).format(units)
                            else -> "0"
                        },
                        style = MaterialTheme.typography.titleLarge,
                        color = when {
                            units == null -> PosMuted
                            units > 0 -> PosAccent
                            else -> PosDanger
                        },
                        fontWeight = FontWeight.Bold
                    )
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
    var showBulkDialog by remember { mutableStateOf(false) }
    var historyIngredient by remember { mutableStateOf<Ingredient?>(null) }
    val scope = rememberCoroutineScope()
    val supplierById = suppliers.associateBy { it.id }
    var importMessage by remember { mutableStateOf<String?>(null) }
    val templateLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        uri?.let { scope.launch { viewModel.writeIngredientsTemplate(it) } }
    }
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        uri?.let { scope.launch { viewModel.exportIngredientsCsv(it) } }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { scope.launch { importMessage = viewModel.importIngredientsCsv(it) } }
    }

    Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(onClick = { templateLauncher.launch("ingredients-template.csv") }, modifier = Modifier.weight(1f)) { Text("Template") }
            OutlinedButton(onClick = { importLauncher.launch(arrayOf("text/*", "application/vnd.ms-excel")) }, modifier = Modifier.weight(1f)) { Text("Import") }
            Button(onClick = { exportLauncher.launch("ingredients.csv") }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = PosAccent)) { Text("Export") }
        }
        importMessage?.let { Text(it, color = PosAccent, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp)) }
        // Ingredients in a dense 5-per-row grid (same as the Products tab) so a
        // tablet shows the whole pantry at a glance; tap a card to adjust stock.
        LazyVerticalGrid(
            columns = GridCells.Fixed(5),
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            gridItems(ingredients) { ingredient ->
                val isLow = ingredient.currentStock <= ingredient.minStock
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showAdjustDialog = ingredient },
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp)
                    ) {
                        Text(
                            ingredient.name,
                            style = MaterialTheme.typography.titleMedium,
                            color = PosPaper,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(ingredient.category, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "${trimStock(ingredient.currentStock)} ${ingredient.baseUnit}",
                            style = MaterialTheme.typography.titleLarge,
                            color = if (isLow) PosDanger else PosGold,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                        if (isLow) {
                            Text("Low Stock", color = PosDanger, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        }
                        ingredient.lastSupplierId?.let { supplierId ->
                            supplierById[supplierId]?.let { supplier ->
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "Last from: ${supplier.name}",
                                    color = PosAccent,
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End
                        ) {
                            Text(
                                "History",
                                color = PosInfo,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier
                                    .clickable { historyIngredient = ingredient }
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            )
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

        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(
            onClick = { showBulkDialog = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, PosInfo)
        ) {
            Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp), tint = PosInfo)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Bulk Adjust Stock", color = PosInfo, fontWeight = FontWeight.SemiBold)
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

    historyIngredient?.let { ingredient ->
        IngredientHistoryDialog(
            ingredient = ingredient,
            suppliers = suppliers,
            viewModel = viewModel,
            onDismiss = { historyIngredient = null }
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
            onConfirm = { ingredientId, purchaseUnit, quantity, totalCost, supplierId, notes ->
                scope.launch {
                    viewModel.purchaseIngredientWithUnits(ingredientId, purchaseUnit, quantity, totalCost, supplierId, notes)
                    showPurchaseDialog = false
                }
            }
        )
    }

    if (showBulkDialog) {
        BulkAdjustDialog(
            ingredients = ingredients,
            onDismiss = { showBulkDialog = false },
            onApply = { lines ->
                viewModel.bulkAdjustStock(lines)
                showBulkDialog = false
            }
        )
    }
}

@Composable
fun InventorySuppliersTab(viewModel: CafeViewModel) {
    val suppliers by viewModel.suppliers.collectAsState(initial = emptyList())
    var showAddDialog by remember { mutableStateOf(false) }
    var editingSupplier by remember { mutableStateOf<Supplier?>(null) }
    var detailSupplier by remember { mutableStateOf<Supplier?>(null) }
    val scope = rememberCoroutineScope()

    Column {
        LazyVerticalGrid(
            columns = GridCells.Fixed(5),
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            gridItems(suppliers) { supplier ->
                Column {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { detailSupplier = supplier },
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    supplier.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = PosPaper,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    color = if (supplier.status == "ACTIVE") PosAccent.copy(alpha = 0.15f) else PosDanger.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(20.dp)
                                ) {
                                    Text(
                                        text = supplier.status,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (supplier.status == "ACTIVE") PosAccent else PosDanger,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1
                                    )
                                }
                            }
                            supplier.contactPerson?.let { Text("Contact: $it", style = MaterialTheme.typography.bodySmall, color = PosMuted, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                            supplier.phone?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosMuted) }
                            supplier.email?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosMuted, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
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

    detailSupplier?.let { supplier ->
        SupplierDetailDialog(
            supplier = supplier,
            viewModel = viewModel,
            onDismiss = { detailSupplier = null }
        )
    }
}

@Composable
fun InventoryCapacityTab(viewModel: CafeViewModel) {
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    var capacity by remember { mutableStateOf<List<ProductCapacityInfo>>(emptyList()) }

    LaunchedEffect(products, ingredients) {
        capacity = products.mapNotNull { product ->
            val recipe = viewModel.getProductIngredients(product.id)
            if (recipe.isEmpty()) return@mapNotNull null
            val limits = recipe.mapNotNull { item ->
                ingredients.find { it.id == item.ingredientId }?.let { ingredient ->
                    if (item.quantity > 0.0) ingredient.currentStock / item.quantity to ingredient.name else null
                }
            }
            if (limits.isEmpty()) null else ProductCapacityInfo(product.name, limits.minOf { it.first }.toInt(), limits.minByOrNull { it.first }?.second ?: "")
        }
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(5),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        gridItems(capacity) { cap ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(cap.productName, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Can produce: ${cap.producibleUnits} units", style = MaterialTheme.typography.bodyMedium, color = PosPaper)
                    Text("Limited by: ${cap.limitingIngredient}", style = MaterialTheme.typography.bodySmall, color = PosMuted, maxLines = 2)
                    Spacer(modifier = Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = (cap.producibleUnits / 100.0).coerceIn(0.0, 1.0).toFloat(),
                        modifier = Modifier.fillMaxWidth(),
                        color = if (cap.producibleUnits > 0) PosAccent else PosDanger,
                        trackColor = PosMuted
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${cap.producibleUnits} product(s)",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (cap.producibleUnits > 0) PosAccent else PosDanger,
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
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy hh:mm a", Locale.getDefault())
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

@Composable
fun LowStockAlertTab(viewModel: CafeViewModel) {
    val lowStockIngredients by viewModel.lowStockIngredients.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))

    if (lowStockIngredients.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = PosAccent, modifier = Modifier.size(48.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text("All ingredients are sufficiently stocked.", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
            }
        }
    } else {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(lowStockIngredients) { ingredient ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = PosDangerSoft),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(ingredient.name, style = MaterialTheme.typography.titleMedium, color = PosDanger, fontWeight = FontWeight.Bold)
                                Text(ingredient.category, style = MaterialTheme.typography.bodySmall, color = PosInkSoft)
                            }
                            Surface(
                                color = PosDanger.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(20.dp)
                            ) {
                                Text(
                                    "LOW STOCK",
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = PosDanger,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Current: ${ingredient.currentStock} ${ingredient.baseUnit}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosPaper
                            )
                            Text(
                                "Min: ${ingredient.minStock} ${ingredient.baseUnit}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = PosMuted
                            )
                        }
                        Text(
                            "Value: ${currencyFormatter.format(ingredient.currentStock * ingredient.costPerUnit)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = PosInkSoft
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchaseIngredientDialog(
    ingredients: List<Ingredient>,
    suppliers: List<Supplier>,
    onDismiss: () -> Unit,
    onConfirm: (ingredientId: Int, purchaseUnit: String, quantity: Double, totalCost: Double, supplierId: Int?, notes: String?) -> Unit
) {
    var selectedIngredientId by remember { mutableStateOf<Int?>(null) }
    var purchaseUnit by remember { mutableStateOf("") }
    var quantityText by remember { mutableStateOf("") }
    var totalCostText by remember { mutableStateOf("") }
    var selectedSupplierId by remember { mutableStateOf<Int?>(null) }
    var notes by remember { mutableStateOf("") }
    var ingredientExpanded by remember { mutableStateOf(false) }
    var supplierExpanded by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }
    val scrollState = rememberScrollState()
    val selectedIngredient = ingredients.find { it.id == selectedIngredientId }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Record Purchase", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.verticalScroll(scrollState)) {
                Text("Ingredient", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(6.dp))
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { ingredientExpanded = !ingredientExpanded; supplierExpanded = false },
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            ingredients.find { it.id == selectedIngredientId }?.name ?: "Select ingredient",
                            color = if (selectedIngredientId != null) MaterialTheme.colorScheme.onSurface else PosMuted,
                            fontWeight = if (selectedIngredientId != null) FontWeight.SemiBold else FontWeight.Normal
                        )
                        Icon(
                            if (ingredientExpanded) Icons.Default.ArrowDropUp else Icons.Default.ArrowDropDown,
                            contentDescription = null,
                            tint = PosAccent
                        )
                    }
                }
                if (ingredientExpanded) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            ingredients.forEach { ing ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            selectedIngredientId = ing.id
                                            purchaseUnit = ing.baseUnit
                                            quantityText = ""
                                            ingredientExpanded = false
                                        }
                                        .padding(horizontal = 14.dp, vertical = 10.dp)
                                ) {
                                    Text(ing.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                                    Spacer(modifier = Modifier.weight(1f))
                                    Text("${ing.currentStock} ${ing.baseUnit} in stock", color = PosMuted, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(14.dp))

                Text("Supplier (optional)", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(6.dp))
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { supplierExpanded = !supplierExpanded; ingredientExpanded = false },
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            suppliers.find { it.id == selectedSupplierId }?.name ?: "No supplier",
                            color = if (selectedSupplierId != null) MaterialTheme.colorScheme.onSurface else PosMuted,
                            fontWeight = if (selectedSupplierId != null) FontWeight.SemiBold else FontWeight.Normal
                        )
                        Icon(
                            if (supplierExpanded) Icons.Default.ArrowDropUp else Icons.Default.ArrowDropDown,
                            contentDescription = null,
                            tint = PosAccent
                        )
                    }
                }
                if (supplierExpanded) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedSupplierId = null; supplierExpanded = false }
                                    .padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text("No supplier", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                            }
                            suppliers.forEach { sup ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { selectedSupplierId = sup.id; supplierExpanded = false }
                                        .padding(horizontal = 14.dp, vertical = 10.dp)
                                ) {
                                    Text(sup.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(14.dp))

                if (selectedIngredient != null) {
                    Text("Purchase unit", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(6.dp))
                    val unitOptions = PurchaseUnits.purchaseUnitOptions(selectedIngredient.baseUnit)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        unitOptions.forEach { unit ->
                            FilterChip(
                                selected = purchaseUnit == unit,
                                onClick = { purchaseUnit = unit },
                                label = { Text(unit) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                            )
                        }
                    }
                    if (!PurchaseUnits.canConvert(selectedIngredient.baseUnit, purchaseUnit)) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "Unit \"$purchaseUnit\" cannot be converted to the ingredient's base unit (${selectedIngredient.baseUnit}).",
                            color = PosDanger, style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                OutlinedTextField(value = quantityText, onValueChange = { quantityText = it }, label = { Text("Quantity received (${if (purchaseUnit.isNotBlank()) purchaseUnit else "units"})") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = totalCostText, onValueChange = { totalCostText = it }, label = { Text("Total purchase cost (₱)") }, supportingText = { Text("Unit cost is calculated automatically — you only enter the amount you paid") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                val baseUnit = selectedIngredient?.baseUnit
                val qtyParsed = quantityText.toDoubleOrNull()
                val totalParsed = totalCostText.toDoubleOrNull()
                if (baseUnit != null && purchaseUnit.isNotBlank() && qtyParsed != null && totalParsed != null && qtyParsed > 0.0 && totalParsed >= 0.0) {
                    val perBase = PurchaseUnits.unitCost(baseUnit, purchaseUnit, qtyParsed, totalParsed)
                    Spacer(modifier = Modifier.height(6.dp))
                    if (perBase != null) {
                        Text(
                            "Auto cost: ₱${"%.2f".format(totalParsed / qtyParsed)} per $purchaseUnit  ·  ₱${"%.2f".format(perBase)} per $baseUnit",
                            color = PosAccent, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold
                        )
                    } else {
                        Text("Unit cost cannot be calculated for this unit combination.", color = PosDanger, style = MaterialTheme.typography.bodySmall)
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                validationError?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(it, color = PosDanger, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val qty = quantityText.toDoubleOrNull()
                    val totalCost = totalCostText.toDoubleOrNull()
                    val base = selectedIngredient?.baseUnit
                    validationError = when {
                        selectedIngredientId == null -> "Select an ingredient."
                        purchaseUnit.isBlank() -> "Choose a purchase unit."
                        base == null || !PurchaseUnits.canConvert(base, purchaseUnit) ->
                            "Unit \"$purchaseUnit\" cannot be converted to the ingredient's base unit."
                        qty == null || qty <= 0.0 -> "Enter a quantity greater than zero."
                        totalCost == null || totalCost < 0.0 -> "Enter a valid total purchase cost."
                        else -> null
                    }
                    if (validationError == null && selectedIngredientId != null && qty != null && totalCost != null) {
                        onConfirm(selectedIngredientId!!, purchaseUnit, qty, totalCost, selectedSupplierId, notes.ifBlank { null })
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

/** Purchase history for one ingredient with supplier and price change vs previous (spec 014, US2). */
@Composable
fun IngredientHistoryDialog(
    ingredient: Ingredient,
    suppliers: List<Supplier>,
    viewModel: CafeViewModel,
    onDismiss: () -> Unit
) {
    var transactions by remember(ingredient.id) { mutableStateOf<List<IngredientTransaction>?>(null) }
    var refresh by remember { mutableStateOf(0) }
    var pendingVoid by remember { mutableStateOf<IngredientTransaction?>(null) }
    val supplierById = suppliers.associateBy { it.id }
    val formatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy hh:mm a", Locale.getDefault())

    LaunchedEffect(ingredient.id, refresh) {
        transactions = viewModel.getTransactionsForIngredient(ingredient.id).first()
    }

    // Purchase rows in ledger (id) order with the change vs the previous
    // non-void purchase — row-id order, not timestamps, defines "previous".
    val rows = remember(transactions) {
        val purchases = transactions.orEmpty()
            .filter { it.type == "PURCHASE" }
            .sortedBy { it.id }
        val seen = java.util.ArrayDeque<Double>() // previous unit costs, ledger order
        purchases.map { txn ->
            val previousCost = seen.peekLast()
            if (txn.unitCost != null) seen.addLast(txn.unitCost!!)
            Triple(txn, previousCost, PriceTrends.change(previousCost, txn.unitCost ?: 0.0))
        }.asReversed()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("${ingredient.name} — Purchase History", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.height(420.dp)) {
                if (transactions == null) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PosAccent)
                    }
                } else if (rows.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No purchases recorded yet.", color = PosMuted)
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(rows.size) { index ->
                            val (txn, previousCost, change) = rows[index]
                            val supplier = txn.referenceId?.let { supplierById[it] }
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                        Text(
                                            dateFormatter.format(Date(txn.createdAt)),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = PosMuted
                                        )
                                        if (supplier != null) {
                                            Text(
                                                supplier.name,
                                                style = MaterialTheme.typography.labelMedium,
                                                color = PosAccent,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        } else {
                                            Text("No supplier", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                                        }
                                        if (txn.type == "PURCHASE") {
                                            TextButton(
                                                onClick = { pendingVoid = txn },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp)
                                            ) {
                                                Text("Void", color = PosDanger, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                        Column {
                                            val qtyDisplay = if (!txn.purchaseUnit.isNullOrBlank()) {
                                                "${trimStock(txn.quantity)} ${ingredient.baseUnit} (${txn.purchaseUnit} bought)"
                                            } else {
                                                "${trimStock(txn.quantity)} ${ingredient.baseUnit}"
                                            }
                                            Text(qtyDisplay, style = MaterialTheme.typography.bodyMedium, color = PosPaper)
                                            txn.unitCost?.let { unit ->
                                                Text("Unit cost: ${formatter.format(unit)}", style = MaterialTheme.typography.bodyMedium, color = PosPaper)
                                            }
                                            txn.purchaseCost?.let { total ->
                                                Text("Total: ${formatter.format(total)}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                            }
                                            if (change != null) {
                                                val up = change.delta >= 0
                                                Text(
                                                    text = if (previousCost == null) "" else "${if (up) "+" else ""}${formatter.format(change.delta)} (${if (up) "+" else ""}${"%.2f".format(change.percent)}%) vs previous",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = if (up) PosDanger else PosAccent,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            } else {
                                                Text("First purchase — no previous price", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )

    pendingVoid?.let { txn ->
        AdminPasscodeDialog(
            viewModel = viewModel,
            onDismiss = { pendingVoid = null },
            onAuthorized = {
                viewModel.voidPurchase(txn)
                pendingVoid = null
                refresh++
            }
        )
    }
}

/** Supplier "page": every ingredient bought from this supplier with latest price
 *  and ₱/% change vs the previous price from the same supplier (spec 014, US3). */
@Composable
fun SupplierDetailDialog(
    supplier: Supplier,
    viewModel: CafeViewModel,
    onDismiss: () -> Unit
) {
    var rows by remember(supplier.id) { mutableStateOf<List<SupplierIngredientTrend>?>(null) }
    val formatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))

    LaunchedEffect(supplier.id) {
        rows = viewModel.supplierIngredientTrends(supplier.id)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Supplier: ${supplier.name}", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.height(440.dp)) {
                if (rows == null) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PosAccent)
                    }
                } else if (rows!!.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No purchases from this supplier yet.", color = PosMuted)
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(rows!!.size) { index ->
                            val row = rows!![index]
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(row.ingredientName, style = MaterialTheme.typography.bodyLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                                        Text("${row.purchaseCount} purchase(s)", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        row.latestUnitCost?.let {
                                            Text("${formatter.format(it)} / ${row.baseUnit}", style = MaterialTheme.typography.bodyMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                                        }
                                        if (row.change != null) {
                                            val up = row.change.delta >= 0
                                            Text(
                                                "${if (up) "+" else ""}${formatter.format(row.change.delta)} (${if (up) "+" else ""}${"%.2f".format(row.change.percent)}%)",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = if (up) PosDanger else PosAccent,
                                                fontWeight = FontWeight.Bold
                                            )
                                        } else {
                                            Text("First purchase", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}
