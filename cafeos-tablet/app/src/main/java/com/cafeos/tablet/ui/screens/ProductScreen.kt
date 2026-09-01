package com.cafeos.tablet.ui.screens

import android.app.Application
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.io.InputStream
import java.text.NumberFormat
import java.util.*

@Composable
fun ProductScreen(viewModel: CafeViewModel) {
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val categories by viewModel.categories.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))

    var selectedCategoryId by remember { mutableStateOf<Int?>(null) }
    var editingProduct by remember { mutableStateOf<Product?>(null) }
    var showProductForm by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<Category?>(null) }
    var showCategoryForm by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(20.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Products", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Spacer(modifier = Modifier.weight(1f))
            IconButton(onClick = { showCategoryForm = true }) {
                Icon(Icons.Default.List, contentDescription = "Manage Categories", tint = PosPaper)
            }
            IconButton(onClick = {
                editingProduct = Product(name = "", price = 0.0, categoryId = selectedCategoryId ?: (categories.firstOrNull()?.id ?: 0))
                showProductForm = true
            }) {
                Icon(Icons.Default.Add, contentDescription = "Add Product", tint = PosPaper)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        ScrollableTabRow(
            selectedTabIndex = categories.indexOfFirst { it.id == selectedCategoryId }.let { if (it == -1) 0 else it + 1 },
            edgePadding = 0.dp,
            divider = {},
            containerColor = PosCoffeeLight,
            contentColor = PosPaper
        ) {
            Tab(
                selected = selectedCategoryId == null,
                onClick = { selectedCategoryId = null },
                text = { Text("All") },
                selectedContentColor = PosGold,
                unselectedContentColor = PosMuted
            )
            categories.forEach { category ->
                Tab(
                    selected = selectedCategoryId == category.id,
                    onClick = { selectedCategoryId = category.id },
                    text = { Text(category.name) },
                    selectedContentColor = PosGold,
                    unselectedContentColor = PosMuted
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        val filtered = if (selectedCategoryId == null) products else products.filter { it.categoryId == selectedCategoryId }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(filtered) { product ->
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

    if (showProductForm) {
        ProductFormDialog(
            product = editingProduct,
            viewModel = viewModel,
            categories = categories,
            ingredients = ingredients,
            onDismiss = { showProductForm = false; editingProduct = null },
            onSave = { saved ->
                viewModel.saveProduct(saved)
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
}

@Composable
fun ProductCardEditable(product: Product, category: Category?, formatter: NumberFormat, onEdit: () -> Unit, onDelete: () -> Unit) {
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
                category?.let {
                    Text(it.name, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                }
                Text(
                    text = formatter.format(product.price),
                    style = MaterialTheme.typography.labelMedium,
                    color = PosAccent,
                    fontWeight = FontWeight.Bold
                )
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductFormDialog(product: Product?, viewModel: CafeViewModel, categories: List<Category>, ingredients: List<Ingredient>, onDismiss: () -> Unit, onSave: (Product) -> Unit) {
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

    val scope = rememberCoroutineScope()

    LaunchedEffect(product?.id) {
        if (product != null && product.id != 0) {
            val savedIngredients = viewModel.getProductIngredients(product.id)
            val recipeMap = savedIngredients.associate { it.ingredientId to it.quantity }.toMutableMap()
            recipe = ingredients.map { ing -> (ing.id to (recipeMap[ing.id] ?: 0.0)) }
            capitalCost = viewModel.calculateCapitalFromRecipe(product.id).toString()
        }
    }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            val context = viewModel.getApplication<Application>()
            val persistentPath = viewModel.saveProductImage(context, it)
            imageUri = persistentPath?.let { path -> Uri.fromFile(java.io.File(path)) }
            try {
                val input = context.contentResolver.openInputStream(it)
                val bitmap = BitmapFactory.decodeStream(input)
                imageBitmap = bitmap
                input?.close()
            } catch (e: Exception) {
                e.printStackTrace()
            }
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
                        OutlinedTextField(value = categories.find { it.id == selectedCategoryId }?.name ?: "", onValueChange = {}, readOnly = true, label = { Text("Category") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            categories.forEach { cat -> DropdownMenuItem(text = { Text(cat.name) }, onClick = { selectedCategoryId = cat.id; expanded = false }) }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = prepTime, onValueChange = { prepTime = it.filter { c -> c.isDigit() } }, label = { Text("Prep Time (min)") }, modifier = Modifier.weight(1f), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
                        var stationExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(expanded = stationExpanded, onExpandedChange = { stationExpanded = it }) {
                            OutlinedTextField(value = stationType.replaceFirstChar { it.uppercase() }, onValueChange = {}, readOnly = true, label = { Text("Station") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = stationExpanded) }, modifier = Modifier.weight(1f), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
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
                            OutlinedTextField(value = marginType, onValueChange = {}, readOnly = true, label = { Text("Margin Type") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = marginExpanded) }, modifier = Modifier.weight(1f), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline))
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
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Recipe", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
                        Spacer(modifier = Modifier.weight(1f))
                        Button(onClick = { showRecipeEditor = true }, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = PosAccent)) { Text("Edit Recipe") }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Capital from recipe: ${currencyFormatter.format(capitalCost.toDoubleOrNull() ?: 0.0)}", style = MaterialTheme.typography.bodySmall, color = PosMuted)

                    Spacer(modifier = Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { imagePicker.launch("image/*") }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                            Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Image")
                        }
                        if (imageBitmap != null) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Selected", style = MaterialTheme.typography.bodySmall, color = PosAccent)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val price = calculatedPrice.takeIf { it > 0 } ?: capitalCost.toDoubleOrNull() ?: 0.0
                    val finalCategoryId = if (selectedCategoryId == 0 && categories.isNotEmpty()) categories.first().id else selectedCategoryId
                    val saved = if (product == null) {
                        Product(name = name, price = price, categoryId = finalCategoryId, description = description.ifBlank { null }, available = available, imageUrl = imageUri?.toString(), capitalCost = capitalCost.toDoubleOrNull() ?: 0.0, marginType = marginType, marginValue = marginValue.toDoubleOrNull() ?: 30.0, vatExempt = vatExempt, prepTimeMinutes = prepTime.toIntOrNull() ?: 5, stationType = stationType)
                    } else {
                        product.copy(name = name, price = price, categoryId = finalCategoryId, description = description.ifBlank { null }, available = available, imageUrl = imageUri?.toString() ?: product.imageUrl, capitalCost = capitalCost.toDoubleOrNull() ?: 0.0, marginType = marginType, marginValue = marginValue.toDoubleOrNull() ?: 30.0, vatExempt = vatExempt, prepTimeMinutes = prepTime.toIntOrNull() ?: 5, stationType = stationType)
                    }
                    onSave(saved)
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
            Column(modifier = Modifier.height(400.dp)) {
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(ingredients) { ingredient ->
                        val existing = recipe.find { it.first == ingredient.id }
                        val qty = existing?.second ?: 0.0
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(ingredient.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
                                Text("${ingredient.baseUnit} · ₱${ingredient.costPerUnit}/unit", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                IconButton(onClick = { recipe = recipe.map { if (it.first == ingredient.id) it.first to (it.second - 1).coerceAtLeast(0.0) else it }.toMutableList() }) {
                                    Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = PosDanger)
                                }
                                Text("${qty.toInt()}", modifier = Modifier.width(30.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                                IconButton(onClick = { recipe = recipe.map { if (it.first == ingredient.id) it.first to it.second + 1 else it }.toMutableList() }) {
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
                Text("Save", fontWeight = FontWeight.SemiBold)
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
