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
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Expense
import com.cafeos.tablet.data.ExpenseCategory
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpensesScreen(viewModel: CafeViewModel) {
    val expenses by viewModel.allExpenses.collectAsState(initial = emptyList())
    val expenseCategories by viewModel.allExpenseCategories.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    var showAddDialog by remember { mutableStateOf(false) }
    var showCategories by remember { mutableStateOf(false) }
    var editingExpense by remember { mutableStateOf<Expense?>(null) }
    val scope = rememberCoroutineScope()

    PremiumScreen {
        PremiumHeader("Expenses", "Track operating costs with clarity")
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedButton(
                onClick = { showCategories = true },
                border = androidx.compose.foundation.BorderStroke(1.dp, PosBorder)
            ) { Text("Categories", color = PosGold) }
            Spacer(modifier = Modifier.width(8.dp))
            Button(
                onClick = { editingExpense = null; showAddDialog = true },
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
                Text("Total Expenses", style = MaterialTheme.typography.titleMedium, color = Color.White.copy(alpha = 0.9f))
                Spacer(modifier = Modifier.height(8.dp))
                Text(currencyFormatter.format(totalExpenses), style = MaterialTheme.typography.headlineLarge, color = Color.White, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                                    TextButton(onClick = { editingExpense = expense; showAddDialog = true }) {
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
            categories = expenseCategories,
            onDismiss = { showAddDialog = false; editingExpense = null },
            onSave = { saved ->
                viewModel.addExpense(saved)
                showAddDialog = false
                editingExpense = null
            }
        )
    }

    if (showCategories) {
        ExpenseCategoriesDialog(
            categories = expenseCategories,
            onDismiss = { showCategories = false },
            onAdd = { name -> viewModel.addExpenseCategory(name.trim()) },
            onDelete = { category -> scope.launch { viewModel.deleteExpenseCategory(category) } }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExpenseCategoriesDialog(
    categories: List<ExpenseCategory>,
    onDismiss: () -> Unit,
    onAdd: (String) -> Unit,
    onDelete: (ExpenseCategory) -> Unit
) {
    var nameText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Expense Categories", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.height(300.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = nameText,
                        onValueChange = { nameText = it },
                        label = { Text("New category") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (nameText.isNotBlank()) {
                                onAdd(nameText)
                                nameText = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Add", fontWeight = FontWeight.SemiBold) }
                }
                Spacer(modifier = Modifier.height(8.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(categories) { category ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(category.name, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
                            IconButton(onClick = { onDelete(category) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done", color = PosAccent) } },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseFormDialog(
    expense: Expense?,
    categories: List<ExpenseCategory> = emptyList(),
    onDismiss: () -> Unit,
    onSave: (Expense) -> Unit
) {
    var itemNameText by remember { mutableStateOf(expense?.category ?: "") }
    var amountText by remember { mutableStateOf((expense?.amount ?: 0.0).toString()) }
    var notesText by remember { mutableStateOf(expense?.notes ?: "") }
    var paidByText by remember { mutableStateOf(expense?.paidBy ?: "") }
    var paymentMethod by remember { mutableStateOf(expense?.paymentMethod ?: "CASH") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (expense == null) "New Expense" else "Edit Expense", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = itemNameText,
                    onValueChange = { itemNameText = it },
                    label = { Text("Expense item name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
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
                Text("Payment Method", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("CASH", "GCASH", "BANK").forEach { method ->
                        FilterChip(
                            selected = paymentMethod == method,
                            onClick = { paymentMethod = method },
                            label = { Text(method) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent)
                        )
                    }
                }
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
                    if (itemNameText.isNotBlank() && amount > 0) {
                        // Link the category id when the typed name matches a
                        // configured expense category (v18 field parity).
                        val matchedCategory = categories.firstOrNull { it.name.equals(itemNameText.trim(), ignoreCase = true) }
                        val saved = if (expense == null) {
                            Expense(category = itemNameText.trim(), categoryId = matchedCategory?.id, supplierId = null, amount = amount, notes = notesText.ifBlank { null }, paidBy = paidByText.ifBlank { null }, paymentMethod = paymentMethod)
                        } else {
                            expense.copy(category = itemNameText.trim(), categoryId = matchedCategory?.id, supplierId = null, amount = amount, notes = notesText.ifBlank { null }, paidBy = paidByText.ifBlank { null }, paymentMethod = paymentMethod)
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
