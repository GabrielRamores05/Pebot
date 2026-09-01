package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Expense
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpensesScreen(viewModel: CafeViewModel) {
    val expenses by viewModel.allExpenses.collectAsState(initial = emptyList())
    val suppliers by viewModel.suppliers.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    var showAddDialog by remember { mutableStateOf(false) }
    var editingExpense by remember { mutableStateOf<Expense?>(null) }
    var expenseCategory by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    val expenseCategories = listOf("Ingredients", "Utilities", "Rent", "Labor", "Equipment", "Marketing", "Other")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Expenses", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Button(
                onClick = { editingExpense = null; expenseCategory = ""; showAddDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Expense", fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        val totalExpenses = expenses.sumOf { it.amount }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = PosAccent),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Total Expenses", style = MaterialTheme.typography.titleMedium, color = PosPaper.copy(alpha = 0.9f))
                Spacer(modifier = Modifier.height(8.dp))
                Text(currencyFormatter.format(totalExpenses), style = MaterialTheme.typography.headlineLarge, color = PosPaper, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(expenses) { expense ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(expense.category, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                                Text(dateFormatter.format(Date(expense.createdAt)), style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                expense.notes?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosInkSoft) }
                                if (!expense.paidBy.isNullOrBlank()) {
                                    Text("Paid by: ${expense.paidBy}", style = MaterialTheme.typography.labelSmall, color = PosMuted)
                                }
                                if (!expense.paymentMethod.isNullOrBlank()) {
                                    Text("via ${expense.paymentMethod}", style = MaterialTheme.typography.labelSmall, color = PosGold)
                                }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(currencyFormatter.format(expense.amount), style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
                                Row {
                                    TextButton(onClick = { editingExpense = expense; expenseCategory = expense.category; showAddDialog = true }) {
                                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(16.dp))
                                    }
                                    TextButton(onClick = { scope.launch { viewModel.deleteExpense(expense) } }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(16.6.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        ExpenseFormDialog(
            expense = editingExpense,
            suppliers = suppliers,
            categories = expenseCategories,
            selectedCategory = expenseCategory,
            onDismiss = { showAddDialog = false; editingExpense = null },
            onSave = { saved ->
                viewModel.addExpense(saved)
                showAddDialog = false
                editingExpense = null
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseFormDialog(
    expense: Expense?,
    suppliers: List<com.cafeos.tablet.data.Supplier>,
    categories: List<String>,
    selectedCategory: String,
    onDismiss: () -> Unit,
    onSave: (Expense) -> Unit
) {
    var categoryText by remember { mutableStateOf(expense?.category ?: selectedCategory) }
    var supplierId by remember { mutableStateOf(expense?.supplierId) }
    var amountText by remember { mutableStateOf((expense?.amount ?: 0.0).toString()) }
    var notesText by remember { mutableStateOf(expense?.notes ?: "") }
    var paidByText by remember { mutableStateOf(expense?.paidBy ?: "") }
    var paymentMethod by remember { mutableStateOf(expense?.paymentMethod ?: "CASH") }
    var categoryExpanded by remember { mutableStateOf(false) }
    var supplierExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (expense == null) "New Expense" else "Edit Expense", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text("Category", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                ExposedDropdownMenuBox(expanded = categoryExpanded, onExpandedChange = { categoryExpanded = it }) {
                    OutlinedTextField(
                        value = categoryText,
                        onValueChange = { if (it in categories) categoryText = it },
                        readOnly = true,
                        modifier = Modifier.fillMaxWidth(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                    ExposedDropdownMenu(expanded = categoryExpanded, onDismissRequest = { categoryExpanded = false }) {
                        categories.forEach { cat ->
                            DropdownMenuItem(text = { Text(cat) }, onClick = { categoryText = cat; categoryExpanded = false })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))

                Text("Supplier", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                ExposedDropdownMenuBox(expanded = supplierExpanded, onExpandedChange = { supplierExpanded = it }) {
                    OutlinedTextField(
                        value = suppliers.find { it.id == supplierId }?.name ?: "None (optional)",
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier.fillMaxWidth(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = supplierExpanded) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                    ExposedDropdownMenu(expanded = supplierExpanded, onDismissRequest = { supplierExpanded = false }) {
                        DropdownMenuItem(text = { Text("None") }, onClick = { supplierId = null; supplierExpanded = false })
                        suppliers.forEach { sup ->
                            DropdownMenuItem(text = { Text(sup.name) }, onClick = { supplierId = sup.id; supplierExpanded = false })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Amount (₱)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = paidByText,
                    onValueChange = { paidByText = it },
                    label = { Text("Paid By") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = notesText,
                    onValueChange = { notesText = it },
                    label = { Text("Notes") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amount = amountText.toDoubleOrNull() ?: 0.0
                    if (categoryText.isNotBlank() && amount > 0) {
                        val saved = if (expense == null) {
                            Expense(category = categoryText, supplierId = supplierId, amount = amount, notes = notesText.ifBlank { null }, paidBy = paidByText.ifBlank { null }, paymentMethod = paymentMethod)
                        } else {
                            expense.copy(category = categoryText, supplierId = supplierId, amount = amount, notes = notesText.ifBlank { null }, paidBy = paidByText.ifBlank { null }, paymentMethod = paymentMethod)
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
