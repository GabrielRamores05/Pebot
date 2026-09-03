package com.cafeos.tablet.ui.screens

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumPanel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.io.InputStream
import java.text.NumberFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductScreen(viewModel: CafeViewModel) {
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val categories by viewModel.categories.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    val optionGroups by viewModel.allOptionGroups.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))

    var selectedCategoryId by remember { mutableStateOf<Int?>(null) }
    var editingProduct by remember { mutableStateOf<Product?>(null) }
    var showProductForm by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<Category?>(null) }
    var showCategoryForm by remember { mutableStateOf(false) }
    var showIngredientForm by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) }
    var searchQuery by remember { mutableStateOf("") }

    PremiumScreen {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Menu Catalog", style = MaterialTheme.typography.headlineMedium, color = PosInk, fontWeight = FontWeight.Bold)
                Text("Products, options, and availability", style = MaterialTheme.typography.bodySmall, color = PosInkSoft)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(
                    onClick = { showIngredientForm = true },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.filledTonalButtonColors(containerColor = PosAccentSoft, contentColor = PosAccent)
                ) {
                    Icon(Icons.Default.Inventory, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Ingredients")
                }
                FilledTonalButton(
                    onClick = { showCategoryForm = true },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.filledTonalButtonColors(containerColor = PosAccentSoft, contentColor = PosAccent)
                ) {
                    Icon(Icons.Default.Category, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Categories")
                }
                Button(
                    onClick = {
                        editingProduct = null
                        showProductForm = true
                    },
                    enabled = categories.isNotEmpty(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("New Product")
                }
            }
        }

        if (categories.isEmpty()) {
            PremiumPanel(title = "Start with a category") {
                Text("Create a category before adding products to your catalog.", color = PosInkSoft, style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(12.dp))
                Text("Use Categories above to create your first menu group.", color = PosAccent, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = PosSurface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp)) {
                    Text("CATALOG", style = MaterialTheme.typography.labelSmall, color = PosInkSoft, fontWeight = FontWeight.Bold)
                    Text("${products.size}", style = MaterialTheme.typography.headlineSmall, color = PosInk, fontWeight = FontWeight.Bold)
                }
            }
            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = PosAccentSoft),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp)) {
                    Text("GROUPS", style = MaterialTheme.typography.labelSmall, color = PosAccentHover, fontWeight = FontWeight.Bold)
                    Text("${categories.size}", style = MaterialTheme.typography.headlineSmall, color = PosAccent, fontWeight = FontWeight.Bold)
                }
            }
            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = PosSurface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp)) {
                    Text("LIVE MENU", style = MaterialTheme.typography.labelSmall, color = PosInkSoft, fontWeight = FontWeight.Bold)
                    Text("${products.count { it.available }}/${products.size}", style = MaterialTheme.typography.headlineSmall, color = PosAccent, fontWeight = FontWeight.Bold)
                }
            }
        }

        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = PosSurface,
            contentColor = PosInk
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = { Text("Products") },
                selectedContentColor = PosAccent,
                unselectedContentColor = PosInkSoft
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = { Text("Options") },
                selectedContentColor = PosAccent,
                unselectedContentColor = PosInkSoft
            )
        }

        when (selectedTab) {
            0 -> {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search the catalog") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = PosInkSoft) },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PosAccent,
                        unfocusedBorderColor = PosBorder,
                        focusedTextColor = PosInk,
                        unfocusedTextColor = PosInk,
                        cursorColor = PosAccent
                    )
                )

                ScrollableTabRow(
                    selectedTabIndex = categories.indexOfFirst { it.id == selectedCategoryId }.let { if (it == -1) 0 else it + 1 },
                    edgePadding = 0.dp,
                    divider = {},
                    containerColor = PosSurface,
                    contentColor = PosInk
                ) {
                    Tab(
                        selected = selectedCategoryId == null,
                        onClick = { selectedCategoryId = null },
                        text = { Text("All") },
                        selectedContentColor = PosAccent,
                        unselectedContentColor = PosInkSoft
                    )
                    categories.forEach { category ->
                        Tab(
                            selected = selectedCategoryId == category.id,
                            onClick = { selectedCategoryId = category.id },
                            text = { Text(category.name) },
                            selectedContentColor = PosAccent,
                            unselectedContentColor = PosInkSoft
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                val filtered = products.filter { product ->
                    (selectedCategoryId == null || product.categoryId == selectedCategoryId) &&
                        product.name.contains(searchQuery, ignoreCase = true)
                }

                LazyVerticalGrid(
                    modifier = Modifier.weight(1f),
                    columns = GridCells.Adaptive(minSize = 240.dp),
                    contentPadding = PaddingValues(bottom = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filtered, key = { it.id }) { product ->
                        ProductCardEditable(
                            product = product,
                            category = categories.find { it.id == product.categoryId },
                            formatter = currencyFormatter,
                            onEdit = { editingProduct = product; showProductForm = true },
                            onDelete = { viewModel.deleteProduct(product) }
                        )
                    }
                }
            }
            1 -> {
                Column(modifier = Modifier.fillMaxSize()) {
                    val productOptionGroups by viewModel.allOptionGroups.collectAsState(initial = emptyList())
                    val optionMap = remember { mutableStateMapOf<Int, List<Option>>() }
                    var showCreateDialog by remember { mutableStateOf(false) }
                    var editingGroup by remember { mutableStateOf<OptionGroup?>(null) }
                    var refreshTick by remember { mutableStateOf(0) }
                    val scope = rememberCoroutineScope()

                    LaunchedEffect(productOptionGroups, refreshTick) {
                        productOptionGroups.forEach { group ->
                            optionMap[group.id] = viewModel.getOptionsForGroup(group.id)
                        }
                        optionMap.keys.filterNot { groupId -> productOptionGroups.any { it.id == groupId } }.forEach(optionMap::remove)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Option Groups", style = MaterialTheme.typography.titleLarge, color = PosPaper)
                        Button(
                            onClick = { editingGroup = null; showCreateDialog = true },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Add Group", fontWeight = FontWeight.SemiBold)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(productOptionGroups) { group ->
                            OptionGroupCard(
                                viewModel = viewModel,
                                group = group,
                                options = optionMap[group.id].orEmpty(),
                                ingredients = ingredients,
                                onEdit = { editingGroup = group; showCreateDialog = true },
                                onDelete = {
                                    scope.launch { viewModel.deleteOptionGroup(group) }
                                    refreshTick++
                                },
                                onDeleteOption = { option ->
                                    scope.launch { viewModel.deleteOption(option) }
                                    refreshTick++
                                },
                                onChanged = { refreshTick++ }
                            )
                        }
                    }

                    if (showCreateDialog) {
                        OptionGroupFormDialog(
                            group = editingGroup,
                            onDismiss = { showCreateDialog = false; editingGroup = null },
                            onSave = { saved ->
                                viewModel.saveOptionGroup(saved)
                                showCreateDialog = false
                                editingGroup = null
                            }
                        )
                    }
                }
            }
        }
    }

    if (showProductForm) {
        ProductFormDialog(
            product = editingProduct,
            viewModel = viewModel,
            categories = categories,
            ingredients = ingredients,
            optionGroups = optionGroups,
            onDismiss = { showProductForm = false; editingProduct = null },
            onSave = { _ ->
                showProductForm = false
                editingProduct = null
            }
        )
    }

    if (showCategoryForm) {
        CategoryManagerDialog(
            categories = categories,
            onDismiss = { showCategoryForm = false; editingCategory = null },
            onSave = { viewModel.saveCategory(it) },
            onDelete = { viewModel.deleteCategory(it) }
        )
    }

    if (showIngredientForm) {
        AddIngredientDialog(
            onDismiss = { showIngredientForm = false },
            onSave = { name, category, baseUnit, currentStock, minStock, costPerUnit ->
                viewModel.addIngredient(name, category, baseUnit, currentStock, minStock, costPerUnit)
                showIngredientForm = false
            }
        )
    }
}

@Composable
fun ProductCardEditable(product: Product, category: Category?, formatter: NumberFormat, onEdit: () -> Unit, onDelete: () -> Unit) {
    val imageBitmap = remember(product.imageUrl) {
        val path = product.imageUrl ?: return@remember null
        val file = java.io.File(path)
        if (file.exists()) BitmapFactory.decodeFile(file.absolutePath) else null
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (imageBitmap != null) {
                Image(
                    bitmap = imageBitmap.asImageBitmap(),
                    contentDescription = product.name,
                    modifier = Modifier
                        .size(72.dp)
                        .background(PosAccentSoft, RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .background(PosAccentSoft, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Image, contentDescription = null, tint = PosInkSoft)
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(product.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                category?.let {
                    Text(it.name, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = formatter.format(product.price),
                        style = MaterialTheme.typography.labelLarge,
                        color = PosGold,
                        fontWeight = FontWeight.Bold
                    )
                    if (!product.available) {
                        Surface(color = PosDangerSoft, shape = RoundedCornerShape(20.dp)) {
                            Text("Unavailable", modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), color = PosDanger, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
            Row {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold)
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ProductFormDialog(product: Product?, viewModel: CafeViewModel, categories: List<Category>, ingredients: List<Ingredient>, optionGroups: List<OptionGroup>, onDismiss: () -> Unit, onSave: (Product) -> Unit) {
    var name by remember { mutableStateOf(product?.name ?: "") }
    var description by remember { mutableStateOf(product?.description ?: "") }
    var selectedCategoryId by remember { mutableStateOf(product?.categoryId ?: (categories.firstOrNull()?.id ?: 0)) }
    var available by remember { mutableStateOf(product?.available ?: true) }
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var imageBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var prepTime by remember { mutableStateOf(product?.prepTimeMinutes?.toString() ?: "5") }
    var stationType by remember { mutableStateOf(product?.stationType ?: "general") }

    var capitalCost by remember { mutableStateOf(product?.capitalCost?.toString() ?: "0") }
    var marginType by remember { mutableStateOf(product?.marginType ?: "PERCENTAGE") }
    var marginValue by remember { mutableStateOf(product?.marginValue?.toString() ?: "30") }
    var vatExempt by remember { mutableStateOf(product?.vatExempt ?: false) }
    var calculatedPrice by remember { mutableStateOf(product?.price ?: 0.0) }

    var recipe by remember { mutableStateOf<List<Pair<Int, Double>>>(emptyList()) }
    var showRecipeEditor by remember { mutableStateOf(false) }
    var linkedGroupIds by remember { mutableStateOf<Set<Int>>(emptySet()) }

    val scope = rememberCoroutineScope()

    LaunchedEffect(product?.id, product?.imageUrl) {
        if (product != null && product.id != 0) {
            val savedIngredients = viewModel.getProductIngredients(product.id)
            val recipeMap = savedIngredients.associate { it.ingredientId to it.quantity }.toMutableMap()
            recipe = ingredients.map { ing -> (ing.id to (recipeMap[ing.id] ?: 0.0)) }
            linkedGroupIds = viewModel.getOptionGroupsForProduct(product.id).map { it.id }.toSet()
            capitalCost = viewModel.calculateCapitalFromRecipe(product.id).toString()
            val existingImage = product.imageUrl
            if (!existingImage.isNullOrBlank()) {
                val file = java.io.File(existingImage)
                if (file.exists()) {
                    imageBitmap = BitmapFactory.decodeFile(file.absolutePath)
                    imageUri = Uri.fromFile(file)
                }
            }
        }
    }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            val context = viewModel.getApplication<Application>()
            val persistentPath = viewModel.saveProductImage(context, it)
            val savedFile = persistentPath?.let { path -> java.io.File(path) }
            imageUri = savedFile?.let { file -> Uri.fromFile(file) }
            imageBitmap = savedFile?.let { file -> BitmapFactory.decodeFile(file.absolutePath) }
        }
    }

    fun updateCalculatedPrice() {
        val cap = capitalCost.toDoubleOrNull() ?: 0.0
        val margin = marginValue.toDoubleOrNull() ?: 0.0
        calculatedPrice = viewModel.calculateBirPrice(cap, marginType, margin, vatExempt)
    }

    LaunchedEffect(capitalCost, marginType, marginValue, vatExempt) {
        updateCalculatedPrice()
    }

    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "PH")) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (product == null) "New Product" else "Edit Product", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.height(500.dp)) {
                Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                    Spacer(modifier = Modifier.height(12.dp))
                    var expanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                        OutlinedTextField(value = categories.find { it.id == selectedCategoryId }?.name ?: "", onValueChange = {}, readOnly = true, label = { Text("Category") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            categories.forEach { cat -> DropdownMenuItem(text = { Text(cat.name) }, onClick = { selectedCategoryId = cat.id; expanded = false }) }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = PosAccentSoft),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (imageBitmap != null) {
                                Image(
                                    bitmap = imageBitmap!!.asImageBitmap(),
                                    contentDescription = "Product image preview",
                                    modifier = Modifier
                                        .size(76.dp)
                                        .background(PosMuted, RoundedCornerShape(12.dp)),
                                    contentScale = ContentScale.Crop
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .size(76.dp)
                                        .background(PosMuted, RoundedCornerShape(12.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Image, contentDescription = null, tint = PosInkSoft)
                                }
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Text("Product image", style = MaterialTheme.typography.labelLarge, color = PosAccent, fontWeight = FontWeight.Bold)
                                Text("Upload a hero image for the POS menu", style = MaterialTheme.typography.bodySmall, color = PosInkSoft)
                            }

                            OutlinedButton(
                                onClick = { imagePicker.launch("image/*") },
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, PosAccent)
                            ) {
                                Icon(Icons.Default.Image, contentDescription = null, tint = PosAccent)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Select", color = PosAccent)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = prepTime, onValueChange = { prepTime = it.filter { c -> c.isDigit() } }, label = { Text("Prep Time (min)") }, modifier = Modifier.weight(1f), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                        var stationExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(expanded = stationExpanded, onExpandedChange = { stationExpanded = it }) {
                            OutlinedTextField(value = stationType.replaceFirstChar { it.uppercase() }, onValueChange = {}, readOnly = true, label = { Text("Station") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = stationExpanded) }, modifier = Modifier.weight(1f).menuAnchor(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                            ExposedDropdownMenu(expanded = stationExpanded, onDismissRequest = { stationExpanded = false }) {
                                listOf("general", "coffee", "kitchen", "bar", "pastry").forEach { st ->
                                    DropdownMenuItem(text = { Text(st.replaceFirstChar { it.uppercase() }) }, onClick = { stationType = st; stationExpanded = false })
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = available, onCheckedChange = { available = it }, colors = CheckboxDefaults.colors(checkedColor = PosAccent))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Available", color = MaterialTheme.colorScheme.onSurface)
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Pricing", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(value = capitalCost, onValueChange = { capitalCost = it; updateCalculatedPrice() }, label = { Text("Capital Cost (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        var marginExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(expanded = marginExpanded, onExpandedChange = { marginExpanded = it }) {
                            OutlinedTextField(value = marginType, onValueChange = {}, readOnly = true, label = { Text("Margin Type") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = marginExpanded) }, modifier = Modifier.weight(1f).menuAnchor(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                            ExposedDropdownMenu(expanded = marginExpanded, onDismissRequest = { marginExpanded = false }) {
                                listOf("PERCENTAGE", "FIXED").forEach { mt -> DropdownMenuItem(text = { Text(mt) }, onClick = { marginType = mt; marginExpanded = false; updateCalculatedPrice() }) }
                            }
                        }
                        OutlinedTextField(value = marginValue, onValueChange = { marginValue = it; updateCalculatedPrice() }, label = { Text("Margin Value") }, modifier = Modifier.weight(1f), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = vatExempt, onCheckedChange = { vatExempt = it; updateCalculatedPrice() }, colors = CheckboxDefaults.colors(checkedColor = PosAccent))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("VAT Exempt", color = MaterialTheme.colorScheme.onSurface)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Calculated Price: ${currencyFormatter.format(calculatedPrice)}", style = MaterialTheme.typography.bodyMedium, color = PosAccent, fontWeight = FontWeight.Bold)

                    Spacer(modifier = Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Recipe", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
                        Spacer(modifier = Modifier.weight(1f))
                        Button(onClick = { showRecipeEditor = true }, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = PosAccent)) { Text("Edit Recipe") }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Capital from recipe: ${currencyFormatter.format(capitalCost.toDoubleOrNull() ?: 0.0)}", style = MaterialTheme.typography.bodySmall, color = PosMuted)

                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Linked option groups", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.height(8.dp))
                    if (optionGroups.isEmpty()) {
                        Text("No option groups available yet.", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                    } else {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            optionGroups.forEach { group ->
                                FilterChip(
                                    selected = linkedGroupIds.contains(group.id),
                                    onClick = {
                                        linkedGroupIds = if (linkedGroupIds.contains(group.id)) {
                                            linkedGroupIds - group.id
                                        } else {
                                            linkedGroupIds + group.id
                                        }
                                    },
                                    label = { Text(group.name) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = PosAccentSoft,
                                        selectedLabelColor = PosAccent,
                                        containerColor = PosSurface,
                                        labelColor = PosInk
                                    )
                                )
                            }
                        }
                    }

                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    scope.launch {
                        val price = calculatedPrice.takeIf { it > 0 } ?: capitalCost.toDoubleOrNull() ?: 0.0
                        val finalCategoryId = if (selectedCategoryId == 0 && categories.isNotEmpty()) categories.first().id else selectedCategoryId
                        val normalizedImageUrl = when {
                            imageUri != null && imageUri!!.scheme == "file" -> imageUri!!.path
                            imageUri != null -> imageUri!!.toString()
                            else -> product?.imageUrl
                        }
                        val saved = if (product == null) {
                            Product(name = name, price = price, categoryId = finalCategoryId, description = description.ifBlank { null }, available = available, imageUrl = normalizedImageUrl, capitalCost = capitalCost.toDoubleOrNull() ?: 0.0, marginType = marginType, marginValue = marginValue.toDoubleOrNull() ?: 30.0, vatExempt = vatExempt, prepTimeMinutes = prepTime.toIntOrNull() ?: 5, stationType = stationType)
                        } else {
                            product.copy(name = name, price = price, categoryId = finalCategoryId, description = description.ifBlank { null }, available = available, imageUrl = normalizedImageUrl ?: product.imageUrl, capitalCost = capitalCost.toDoubleOrNull() ?: 0.0, marginType = marginType, marginValue = marginValue.toDoubleOrNull() ?: 30.0, vatExempt = vatExempt, prepTimeMinutes = prepTime.toIntOrNull() ?: 5, stationType = stationType)
                        }
                        val savedProductId = viewModel.saveProductAndReturnId(saved)
                        val persistedRecipe = recipe.filter { it.second > 0.0 }
                        if (persistedRecipe.isNotEmpty()) {
                            viewModel.saveProductRecipe(savedProductId, persistedRecipe.map { it.first }, persistedRecipe.map { it.second })
                        } else {
                            viewModel.clearProductRecipe(savedProductId)
                        }
                        viewModel.saveProductOptionGroups(savedProductId, linkedGroupIds.toList())
                        onSave(saved.copy(id = savedProductId))
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

    if (showRecipeEditor) {
        RecipeEditorDialog(
            ingredients = ingredients,
            initialRecipe = recipe,
            onDismiss = { showRecipeEditor = false },
            onSave = { newRecipe ->
                val productId = product?.id ?: 0
                if (productId != 0) {
                    viewModel.saveProductRecipe(productId, newRecipe.map { it.first }, newRecipe.map { it.second })
                }
                recipe = newRecipe
                showRecipeEditor = false
            }
        )
    }
}

@Composable
fun RecipeEditorDialog(ingredients: List<Ingredient>, initialRecipe: List<Pair<Int, Double>>, onDismiss: () -> Unit, onSave: (List<Pair<Int, Double>>) -> Unit) {
    var recipe by remember { mutableStateOf(initialRecipe.toMutableList()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Recipe", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.height(420.dp)) {
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(ingredients) { ingredient ->
                        val existing = recipe.find { it.first == ingredient.id }
                        val qty = existing?.second ?: 0.0
                        val step = when (ingredient.baseUnit.lowercase()) {
                            "g", "ml" -> 25.0
                            "l" -> 0.5
                            else -> 1.0
                        }

                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(ingredient.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                                Text("${ingredient.baseUnit} · ₱${ingredient.costPerUnit}/unit", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }

                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                IconButton(
                                    onClick = { recipe = recipe.map { if (it.first == ingredient.id) it.first to (it.second - step).coerceAtLeast(0.0) else it }.toMutableList() },
                                    modifier = Modifier.size(30.dp)
                                ) {
                                    Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = PosDanger)
                                }
                                OutlinedTextField(
                                    value = qty.toString(),
                                    onValueChange = { value ->
                                        val parsed = value.toDoubleOrNull() ?: 0.0
                                        recipe = recipe.map { if (it.first == ingredient.id) it.first to parsed.coerceAtLeast(0.0) else it }.toMutableList()
                                    },
                                    modifier = Modifier.width(82.dp),
                                    singleLine = true,
                                    textStyle = MaterialTheme.typography.bodyMedium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = PosAccent,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                                    )
                                )
                                Text(ingredient.baseUnit, style = MaterialTheme.typography.labelSmall, color = PosMuted)
                                IconButton(
                                    onClick = { recipe = recipe.map { if (it.first == ingredient.id) it.first to (it.second + step) else it }.toMutableList() },
                                    modifier = Modifier.size(30.dp)
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = "Increase", tint = PosAccent)
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onSave(recipe) }, colors = ButtonDefaults.buttonColors(containerColor = PosAccent), shape = RoundedCornerShape(12.dp)) { Text("Save Recipe", fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryManagerDialog(categories: List<Category>, onDismiss: () -> Unit, onSave: (Category) -> Unit, onDelete: (Category) -> Unit) {
    var name by remember { mutableStateOf("") }
    var icon by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<Category?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Categories", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                LazyColumn(modifier = Modifier.height(200.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(categories) { cat ->
                        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                            Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(cat.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                                    cat.icon?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                }
                                Row {
                                    IconButton(onClick = { editing = cat; name = cat.name; icon = cat.icon ?: "" }) {
                                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold)
                                    }
                                    IconButton(onClick = { onDelete(cat) }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger)
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.weight(1f), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                    OutlinedTextField(value = icon, onValueChange = { icon = it }, label = { Text("Icon") }, modifier = Modifier.weight(1f), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val saved = if (editing == null) Category(name = name, icon = icon.ifBlank { null }) else editing!!.copy(name = name, icon = icon.ifBlank { null })
                        onSave(saved)
                        name = ""
                        icon = ""
                        editing = null
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(if (editing == null) "Add Category" else "Save Category", fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}
