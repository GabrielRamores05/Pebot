package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Ingredient
import com.cafeos.tablet.ui.theme.*

/**
 * Bulk stock corrections (spec 014, US4): enter +/− amounts for many
 * ingredients, then apply in one batch. Stock-only — never touches cost or
 * supplier, and no row may drive stock below zero.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BulkAdjustDialog(
    ingredients: List<Ingredient>,
    onDismiss: () -> Unit,
    onApply: (List<Pair<Int, Double>>) -> Unit
) {
    val amounts = remember(ingredients) { mutableStateMapOf<Int, String>() }
    var notes by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Bulk Adjust Stock", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.height(460.dp)) {
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Reason (optional, shared by the batch)") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("Enter + to receive, − to correct down (stock can't go below zero).", color = PosMuted, style = MaterialTheme.typography.bodySmall)
                Spacer(modifier = Modifier.height(8.dp))
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    ingredients.forEach { ingredient ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(ingredient.name, style = MaterialTheme.typography.bodyMedium, color = PosPaper, maxLines = 1)
                                Text("${trimStockValue(ingredient.currentStock)} ${ingredient.baseUnit} in stock", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                            }
                            OutlinedTextField(
                                value = amounts[ingredient.id] ?: "",
                                onValueChange = { amounts[ingredient.id] = it.filter { c -> c.isDigit() || c == '.' || c == '-' } },
                                label = { Text("Δ") },
                                singleLine = true,
                                modifier = Modifier.width(120.dp)
                            )
                        }
                    }
                }
                error?.let {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(it, color = PosDanger, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val lines = mutableListOf<Pair<Int, Double>>()
                    error = null
                    for (ingredient in ingredients) {
                        val text = amounts[ingredient.id]?.trim().orEmpty()
                        if (text.isEmpty()) continue
                        val delta = text.toDoubleOrNull()
                        if (delta == null) {
                            error = "Enter a valid number for ${ingredient.name}."
                            return@Button
                        }
                        if (delta != 0.0 && ingredient.currentStock + delta < 0.0) {
                            error = "${ingredient.name} would drop below zero (only ${trimStockValue(ingredient.currentStock)} ${ingredient.baseUnit} left)."
                            return@Button
                        }
                        if (delta != 0.0) lines.add(ingredient.id to delta)
                    }
                    if (lines.isEmpty()) {
                        error = "Enter at least one adjustment."
                        return@Button
                    }
                    onApply(lines)
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(12.dp)
            ) { Text("Apply All") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}

private fun trimStockValue(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString() else "%.2f".format(value)
