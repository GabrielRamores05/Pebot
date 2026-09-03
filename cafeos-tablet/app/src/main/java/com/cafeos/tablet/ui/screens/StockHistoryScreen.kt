package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockHistoryScreen(viewModel: CafeViewModel) {
    val transactions by viewModel.allTransactions.collectAsState(initial = emptyList())
    val purchases by viewModel.allPurchases.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy hh:mm a", Locale.getDefault())
    val ingrMap = ingredients.associateBy { it.id }

    var searchQuery by remember { mutableStateOf("") }
    var filterType by remember { mutableStateOf<String?>(null) }

    val combinedTx = (transactions + purchases).sortedByDescending { it.createdAt }

    val filteredTx = combinedTx.filter { txn ->
        val matchesFilter = filterType == null || txn.type == filterType
        val ing = ingrMap[txn.ingredientId]
        val matchesSearch = searchQuery.isBlank() ||
            (ing?.name?.contains(searchQuery, ignoreCase = true) == true) ||
            (txn.notes?.contains(searchQuery, ignoreCase = true) == true) ||
            txn.type.contains(searchQuery, ignoreCase = true)
        matchesFilter && matchesSearch
    }

    PremiumScreen {
        Text("Stock History", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
        Text(
            "Every ingredient movement — purchases in, orders out",
            style = MaterialTheme.typography.bodySmall,
            color = PosMuted
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            label = { Text("Search ingredient or notes...") },
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

        val filters = listOf<Pair<String?, String>>(null to "All", "PURCHASE" to "Purchases", "USAGE" to "Used by orders")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            filters.forEach { (type, label) ->
                FilterChip(
                    selected = filterType == type,
                    onClick = { filterType = type },
                    label = { Text(label) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = PosAccentSoft,
                        selectedLabelColor = PosAccent
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(filteredTx) { txn ->
                val ing = ingrMap[txn.ingredientId]
                val isInbound = txn.quantity > 0
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    ing?.name ?: "Unknown ingredient",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = PosPaper,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    dateFormatter.format(Date(txn.createdAt)),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosMuted
                                )
                                txn.notes?.let { note ->
                                    if (note.isNotBlank()) {
                                        Text(note, style = MaterialTheme.typography.bodySmall, color = PosInkSoft)
                                    }
                                }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    txn.type,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (isInbound) PosAccent else PosDanger,
                                    fontWeight = FontWeight.Bold
                                )
                                val qtyText = "${if (isInbound) "+" else ""}${txn.quantity} ${ing?.baseUnit ?: ""}"
                                Text(qtyText, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}
