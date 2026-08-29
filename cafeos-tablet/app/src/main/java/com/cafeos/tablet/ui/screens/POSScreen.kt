package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Product
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.CartItem
import java.text.NumberFormat
import java.util.Locale

@Composable
fun POSScreen(viewModel: CafeViewModel) {
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val categories by viewModel.categories.collectAsState(initial = emptyList())
    val cartItems = viewModel.cartItems
    val totalAmount by viewModel.totalAmount.collectAsState()
    
    var selectedCategoryId by remember { mutableStateOf<Int?>(null) }
    
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))

    Row(modifier = Modifier.fillMaxSize()) {
        // Product Catalog (Left Side)
        Column(modifier = Modifier.weight(1f).padding(16.dp)) {
            ScrollableTabRow(
                selectedTabIndex = categories.indexOfFirst { it.id == selectedCategoryId }.let { if (it == -1) 0 else it + 1 },
                edgePadding = 0.dp,
                divider = {}
            ) {
                Tab(
                    selected = selectedCategoryId == null,
                    onClick = { selectedCategoryId = null },
                    text = { Text("All") }
                )
                categories.forEach { category ->
                    Tab(
                        selected = selectedCategoryId == category.id,
                        onClick = { selectedCategoryId = category.id },
                        text = { Text(category.name) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            val filteredProducts = if (selectedCategoryId == null) {
                products
            } else {
                products.filter { it.categoryId == selectedCategoryId }
            }

            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 160.dp),
                contentPadding = PaddingValues(8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredProducts) { product ->
                    ProductCard(product, currencyFormatter) {
                        viewModel.addToCart(product)
                    }
                }
            }
        }

        // Cart (Right Side)
        Surface(
            modifier = Modifier.width(350.dp).fillMaxHeight(),
            tonalElevation = 2.dp,
            shadowElevation = 8.dp
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Current Order", style = MaterialTheme.typography.headlineSmall)
                Divider(modifier = Modifier.padding(vertical = 8.dp))
                
                LazyColumn(modifier = Modifier.weight(1f)) {
                    items(cartItems) { item ->
                        CartItemRow(item, currencyFormatter, viewModel)
                    }
                }

                Divider(modifier = Modifier.padding(vertical = 8.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Total", style = MaterialTheme.typography.titleLarge)
                    Text(currencyFormatter.format(totalAmount), style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = { viewModel.placeOrder("Walk-in Customer", "CASH") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = cartItems.isNotEmpty()
                ) {
                    Text("Complete Order")
                }
            }
        }
    }
}

@Composable
fun ProductCard(product: Product, formatter: NumberFormat, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(product.name, style = MaterialTheme.typography.titleMedium, maxLines = 2)
            Text(formatter.format(product.price), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
fun CartItemRow(item: CartItem, formatter: NumberFormat, viewModel: CafeViewModel) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(item.product.name, style = MaterialTheme.typography.bodyLarge)
            Text(formatter.format(item.product.price), style = MaterialTheme.typography.bodySmall)
        }
        
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { viewModel.updateCartItemQuantity(item, item.quantity - 1) }) {
                Icon(Icons.Default.Remove, contentDescription = "Decrease")
            }
            Text("${item.quantity}", modifier = Modifier.padding(horizontal = 8.dp))
            IconButton(onClick = { viewModel.updateCartItemQuantity(item, item.quantity + 1) }) {
                Icon(Icons.Default.Add, contentDescription = "Increase")
            }
            IconButton(onClick = { viewModel.removeFromCart(item) }) {
                Icon(Icons.Default.Delete, contentDescription = "Remove", tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}
