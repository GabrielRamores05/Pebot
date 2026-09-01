package com.cafeos.tablet.ui.screens

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Product
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.CartItem
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import com.cafeos.tablet.data.Order

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun POSScreen(viewModel: CafeViewModel) {
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val categories by viewModel.categories.collectAsState(initial = emptyList())
    val cartItems = viewModel.cartItems
    val totalAmount by viewModel.totalAmount.collectAsState()
    val showProductOptions by viewModel.showProductOptions.collectAsState()
    val showCheckout by viewModel.showCheckout.collectAsState()
    val placedOrder by viewModel.placedOrder.collectAsState()

    var selectedCategoryId by remember { mutableStateOf<Int?>(null) }
    var optionGroups by remember { mutableStateOf<List<com.cafeos.tablet.data.OptionGroup>>(emptyList()) }
    var groupOptions by remember { mutableStateOf<Map<Int, List<com.cafeos.tablet.data.Option>>>(emptyMap()) }

    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))

    LaunchedEffect(showProductOptions) {
        showProductOptions?.let { product ->
            val groups = viewModel.getOptionGroupsForProduct(product.id)
            optionGroups = groups
            val opts = mutableMapOf<Int, List<com.cafeos.tablet.data.Option>>()
            for (g in optionGroups) {
                opts[g.id] = viewModel.getOptionsForGroup(g.id)
            }
            groupOptions = opts
        }
    }

    LaunchedEffect(Unit) {
        snapshotFlow { viewModel.cartItems }.collect {
            // Cart updated
        }
    }

    Row(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .weight(1f)
                .background(PosCoffee)
                .padding(16.dp)
        ) {
            Text("Menu", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Spacer(modifier = Modifier.height(12.dp))

            var searchQuery by remember { mutableStateOf("") }
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Search products") },
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

            val filteredProducts = if (selectedCategoryId == null) {
                products.filter { it.name.contains(searchQuery, ignoreCase = true) }
            } else {
                products.filter { it.categoryId == selectedCategoryId && it.name.contains(searchQuery, ignoreCase = true) }
            }

            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 160.dp),
                contentPadding = PaddingValues(4.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredProducts) { product ->
                    ProductCard(
                        product = product,
                        formatter = currencyFormatter,
                        onClick = { viewModel.openProductOptions(product) }
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .width(380.dp)
                .fillMaxHeight()
                .background(PosCoffeeLight)
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Current Order", style = MaterialTheme.typography.titleLarge, color = PosPaper)
                if (cartItems.isNotEmpty()) {
                    TextButton(onClick = { viewModel.clearCart() }) {
                        Text("Clear", color = PosDanger, style = MaterialTheme.typography.labelMedium)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(cartItems) { item ->
                    CartItemRow(item, currencyFormatter, viewModel)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Divider(color = PosBorder)

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Total", style = MaterialTheme.typography.titleLarge, color = PosInkSoft)
                Text(
                    currencyFormatter.format(totalAmount),
                    style = MaterialTheme.typography.headlineMedium,
                    color = PosGold,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = { viewModel.openCheckout() },
                modifier = Modifier.fillMaxWidth(),
                enabled = cartItems.isNotEmpty(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent, disabledContainerColor = PosMuted)
            ) {
                Text("Checkout", fontWeight = FontWeight.SemiBold)
            }
        }
    }

    showProductOptions?.let { product ->
        ProductOptionsBottomSheet(
            product = product,
            optionGroups = optionGroups,
            groupOptions = groupOptions,
            onDismiss = { viewModel.closeProductOptions() },
            onConfirm = { selectedOptions, priceDelta ->
                viewModel.addToCart(product, selectedOptions, priceDelta)
                viewModel.closeProductOptions()
            }
        )
    }

    if (showCheckout) {
        CheckoutDialog(
            viewModel = viewModel,
            onDismiss = { viewModel.closeCheckout() }
        )
    }

    placedOrder?.let { order ->
        OrderConfirmationDialog(
            viewModel = viewModel,
            order = order,
            onDismiss = { viewModel.dismissPlacedOrder() }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductCard(product: Product, formatter: NumberFormat, onClick: () -> Unit) {
    var bitmap by remember(product.imageUrl) { mutableStateOf<android.graphics.Bitmap?>(null) }

    LaunchedEffect(product.imageUrl) {
        product.imageUrl?.let { path ->
            val file = java.io.File(path)
            if (file.exists()) {
                bitmap = android.graphics.BitmapFactory.decodeFile(file.absolutePath)
            }
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosCream),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            if (bitmap != null) {
                Image(
                    bitmap = bitmap!!.asImageBitmap(),
                    contentDescription = product.name,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentScale = ContentScale.Crop
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
            Text(
                text = product.name,
                style = MaterialTheme.typography.titleMedium,
                color = PosInk,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = formatter.format(product.price),
                style = MaterialTheme.typography.bodyMedium,
                color = PosAccent,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun CartItemRow(item: CartItem, formatter: NumberFormat, viewModel: CafeViewModel) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = PosCream),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(item.product.name, style = MaterialTheme.typography.bodyLarge, color = PosInk, fontWeight = FontWeight.Medium)
                if (item.selectedOptions.isNotEmpty()) {
                    Text(
                        text = item.selectedOptions.joinToString(", ") { it.second },
                        style = MaterialTheme.typography.bodySmall,
                        color = PosInkSoft
                    )
                }
                Text(
                    text = formatter.format(item.product.price * item.quantity + item.priceDelta * item.quantity),
                    style = MaterialTheme.typography.labelMedium,
                    color = PosAccent,
                    fontWeight = FontWeight.Bold
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { viewModel.updateCartItemQuantity(item, item.quantity - 1) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = PosInkSoft, modifier = Modifier.size(18.dp))
                }
                Text("${item.quantity}", style = MaterialTheme.typography.bodyMedium, color = PosInk, modifier = Modifier.padding(horizontal = 8.dp))
                IconButton(
                    onClick = { viewModel.updateCartItemQuantity(item, item.quantity + 1) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Increase", tint = PosInk, modifier = Modifier.size(18.dp))
                }
                IconButton(
                    onClick = { viewModel.removeFromCart(item) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Delete, contentDescription = "Remove", tint = PosDanger, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductOptionsBottomSheet(
    product: Product,
    optionGroups: List<com.cafeos.tablet.data.OptionGroup>,
    groupOptions: Map<Int, List<com.cafeos.tablet.data.Option>>,
    onDismiss: () -> Unit,
    onConfirm: (List<Pair<String, String>>, Double) -> Unit
) {
    val selectedValues = remember { mutableStateMapOf<Int, String>() }
    val selectedMultiValues = remember { mutableStateMapOf<Int, MutableList<String>>() }

    LaunchedEffect(optionGroups) {
        selectedValues.clear()
        selectedMultiValues.clear()
        for (group in optionGroups) {
            val opts = groupOptions[group.id] ?: emptyList()
            if (group.selectionType.equals("single", ignoreCase = true) && opts.isNotEmpty()) {
                selectedValues[group.id] = opts.first().name
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(product.name, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(16.dp))

            if (optionGroups.isEmpty()) {
                Text("No options configured", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(24.dp))
                Button(onClick = {
                    onConfirm(emptyList(), 0.0)
                }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = PosAccent)) {
                    Text("Add to Order", fontWeight = FontWeight.SemiBold)
                }
                Spacer(modifier = Modifier.height(16.dp))
                return@ModalBottomSheet
            }

            for (group in optionGroups) {
                val options = groupOptions[group.id] ?: emptyList()
                Text(group.name, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                if (group.selectionType.equals("single", ignoreCase = true)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (option in options) {
                            val isSelected = selectedValues[group.id] == option.name
                            val leadingIcon: @Composable (() -> Unit)? = if (isSelected) {
                                { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                            } else null
                            
                            FilterChip(
                                selected = isSelected,
                                onClick = { selectedValues[group.id] = option.name },
                                label = { Text("${option.name}${if (option.priceDelta > 0) " +₱${option.priceDelta}" else ""}") },
                                leadingIcon = leadingIcon,
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PosAccentSoft,
                                    selectedLabelColor = PosAccent
                                )
                            )
                        }
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (option in options) {
                            val current = selectedMultiValues.getOrPut(group.id) { mutableStateListOf() }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        if (current.contains(option.name)) current.remove(option.name) else current.add(option.name)
                                    }
                                    .padding(vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("${option.name}${if (option.priceDelta > 0) " +₱${option.priceDelta}" else ""}", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
                                Checkbox(
                                    checked = current.contains(option.name),
                                    onCheckedChange = { checked ->
                                        if (checked) current.add(option.name) else current.remove(option.name)
                                    },
                                    colors = CheckboxDefaults.colors(checkedColor = PosAccent)
                                )
                            }
                            Divider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            val totalDelta = optionGroups.sumOf { group ->
                val options = groupOptions[group.id] ?: emptyList()
                if (group.selectionType.equals("single", ignoreCase = true)) {
                    val selected = selectedValues[group.id]
                    options.find { it.name == selected }?.priceDelta ?: 0.0
                } else {
                    val selected = selectedMultiValues[group.id] ?: emptyList()
                    options.filter { selected.contains(it.name) }.sumOf { it.priceDelta }
                }
            }

            val finalOptions = optionGroups.flatMap { group ->
                val options = groupOptions[group.id] ?: emptyList()
                if (group.selectionType.equals("single", ignoreCase = true)) {
                    val selected = selectedValues[group.id]
                    listOf(group.name to (selected ?: ""))
                } else {
                    val selected = selectedMultiValues[group.id] ?: emptyList()
                    selected.map { group.name to it }
                }
            }

            Button(
                onClick = {
                    onConfirm(finalOptions, totalDelta)
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Text("Add to Order", fontWeight = FontWeight.SemiBold)
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutDialog(viewModel: CafeViewModel, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val totalAmount by viewModel.totalAmount.collectAsState()
    val paymentMethod by viewModel.paymentMethod.collectAsState()
    val amountTendered by viewModel.amountTendered.collectAsState()
    val discountType by viewModel.discountType.collectAsState()
    val selectedTableId by viewModel.selectedTableId.collectAsState()
    val tables by viewModel.tables.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val change = (amountTendered.toDoubleOrNull() ?: 0.0) - totalAmount

    var tableExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Checkout", color = MaterialTheme.colorScheme.onSurface) },
        text = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Total:", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(currencyFormatter.format(totalAmount), style = MaterialTheme.typography.headlineMedium, color = PosGold, fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text("Table", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                ExposedDropdownMenuBox(expanded = tableExpanded, onExpandedChange = { tableExpanded = it }) {
                    OutlinedTextField(
                        value = tables.find { it.id == selectedTableId }?.name ?: "Select table",
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier.fillMaxWidth(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = tableExpanded) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                    ExposedDropdownMenu(expanded = tableExpanded, onDismissRequest = { tableExpanded = false }) {
                        tables.forEach { table ->
                            DropdownMenuItem(text = { Text("${table.name} (${table.currentOccupants}/${table.capacity})") }, onClick = { viewModel.setSelectedTableId(table.id); tableExpanded = false })
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text("Discount", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("NONE", "PWD", "STUDENT").forEach { type ->
                        FilterChip(
                            selected = discountType == type,
                            onClick = { viewModel.setDiscountType(type) },
                            label = { Text(if (type == "NONE") "None" else type) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PosAccentSoft,
                                selectedLabelColor = PosAccent
                            )
                        )
                    }
                }
                if (discountType != "NONE") {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "20% discount applied",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosAccent,
                        fontWeight = FontWeight.Medium
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text("Payment Method", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("CASH", "GCASH", "PAYMAYA").forEach { method ->
                        FilterChip(
                            selected = paymentMethod == method,
                            onClick = { viewModel.setPaymentMethod(method) },
                            label = { Text(method) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PosAccentSoft,
                                selectedLabelColor = PosAccent
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                if (paymentMethod == "CASH") {
                    OutlinedTextField(
                        value = amountTendered,
                        onValueChange = { viewModel.setAmountTendered(it) },
                        label = { Text("Amount Tendered") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PosAccent,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline
                        )
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Change: ${currencyFormatter.format(change.coerceAtLeast(0.0))}",
                        style = MaterialTheme.typography.bodyLarge,
                        color = if (change >= 0) PosAccent else PosDanger,
                        fontWeight = FontWeight.Bold
                    )
                }

                val screenshotPath by viewModel.screenshotPath.collectAsState()
                val screenshotLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: android.net.Uri? ->
                    if (uri != null) {
                        val inputStream = context.contentResolver.openInputStream(uri)
                        val bitmap = BitmapFactory.decodeStream(inputStream)
                        val file = java.io.File(context.filesDir, "payment_${System.currentTimeMillis()}.jpg")
                        java.io.FileOutputStream(file).use { out ->
                            bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, out)
                        }
                        viewModel.setScreenshotPath(file.absolutePath)
                    }
                }

                if (paymentMethod == "GCASH" || paymentMethod == "PAYMAYA") {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Payment Proof", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(8.dp))
                    if (screenshotPath != null) {
                        val file = java.io.File(screenshotPath!!)
                        if (file.exists()) {
                            val bitmap = BitmapFactory.decodeFile(file.absolutePath)
                            Image(
                                bitmap = bitmap.asImageBitmap(),
                                contentDescription = "Payment proof",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(120.dp)
                                    .clickable { screenshotLauncher.launch("image/*") },
                                contentScale = ContentScale.Crop
                            )
                        }
                    } else {
                        OutlinedButton(
                            onClick = { screenshotLauncher.launch("image/*") },
                            modifier = Modifier.fillMaxWidth(),
                            border = androidx.compose.foundation.BorderStroke(1.dp, PosBorder)
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, tint = PosGold, modifier = Modifier.size(24.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Upload Payment Screenshot", color = PosGold)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { viewModel.placeOrder() },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Text("Complete Order", fontWeight = FontWeight.SemiBold)
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
fun OrderConfirmationDialog(viewModel: CafeViewModel, order: Order, onDismiss: () -> Unit) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = PosAccent, modifier = Modifier.size(32.dp))
                Text("Order Confirmed!", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column {
                Text("Order Number", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                Text(order.orderNumber, style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(12.dp))

                Text("Total", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                Text(currencyFormatter.format(order.totalAmount), style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(16.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .background(Color(0xFFF5F0E8), shape = RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.size(100.dp)) {
                        val barWidth = 4f
                        val barHeight = 100f
                        val spacing = 2f
                        val chars = order.barcodeValue ?: order.orderNumber
                        for (i in chars.indices) {
                            val barHeightActual = if (i % 2 == 0) barHeight else barHeight * 0.6f
                            drawRect(
                                color = PosCoffee,
                                topLeft = Offset(i * (barWidth + spacing), 0f),
                                size = Size(barWidth, barHeightActual)
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            val scope = rememberCoroutineScope()
            val products by viewModel.allProducts.collectAsState(initial = emptyList())
            val businessSettings by viewModel.businessSettings.collectAsState(initial = null)

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = {
                    scope.launch {
                        val items = viewModel.getOrderItemsSync(order.id)
                        viewModel.receiptPrinter.printReceipt(order, items, products, businessSettings)
                    }
                }, shape = RoundedCornerShape(12.dp), border = androidx.compose.foundation.BorderStroke(1.dp, PosGold)) {
                    Icon(Icons.Default.Print, contentDescription = null, tint = PosGold)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Print Receipt", color = PosGold)
                }
                Button(onClick = onDismiss, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = PosAccent)) {
                    Text("Done", fontWeight = FontWeight.SemiBold)
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}
