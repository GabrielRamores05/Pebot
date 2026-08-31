package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Ingredient
import com.cafeos.tablet.ui.CafeViewModel

@Composable
fun InventoryScreen(viewModel: CafeViewModel) {
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    var showAdjustDialog by remember { mutableStateOf<Ingredient?>(null) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Ingredient Inventory", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(ingredients) { ingredient ->
                IngredientRow(ingredient) {
                    showAdjustDialog = ingredient
                }
            }
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
}

@Composable
fun IngredientRow(ingredient: Ingredient, onAdjust: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onAdjust
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(ingredient.name, style = MaterialTheme.typography.titleMedium)
                Text(ingredient.category, style = MaterialTheme.typography.bodySmall)
            }
            
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${ingredient.currentStock} ${ingredient.baseUnit}",
                    style = MaterialTheme.typography.titleLarge,
                    color = if (ingredient.currentStock <= ingredient.minStock) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                )
                if (ingredient.currentStock <= ingredient.minStock) {
                    Text("Low Stock", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
fun AdjustStockDialog(
    ingredient: Ingredient,
    onDismiss: () -> Unit,
    onConfirm: (Double, String) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var isAdd by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Adjust Stock: ${ingredient.name}") },
        text = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = isAdd, onClick = { isAdd = true })
                    Text("Add Stock")
                    Spacer(modifier = Modifier.width(16.dp))
                    RadioButton(selected = !isAdd, onClick = { isAdd = false })
                    Text("Reduce (Waste)")
                }
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text("Amount (${ingredient.baseUnit})") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(onClick = {
                val delta = amountText.toDoubleOrNull() ?: 0.0
                onConfirm(if (isAdd) delta else -delta, notes)
            }) {
                Text("Confirm")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
