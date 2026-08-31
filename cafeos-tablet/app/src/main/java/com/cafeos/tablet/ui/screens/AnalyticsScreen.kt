package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.ui.CafeViewModel
import java.text.NumberFormat
import java.util.Locale

@Composable
fun AnalyticsScreen(viewModel: CafeViewModel) {
    val dailySales by viewModel.getDailySales().collectAsState(initial = 0.0)
    val topProducts by viewModel.getTopSellingProducts().collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Minimal Analytics", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(24.dp))

        Card(
            modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text("Today's Gross Sales", style = MaterialTheme.typography.titleMedium)
                Text(currencyFormatter.format(dailySales ?: 0.0), style = MaterialTheme.typography.headlineLarge)
            }
        }

        Text("Top Products (by Volume)", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn {
            items(topProducts) { topProduct ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp, horizontal = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(topProduct.productName, modifier = Modifier.weight(1f))
                    Text("${topProduct.totalSold} sold", style = MaterialTheme.typography.bodyMedium)
                }
                Divider()
            }
        }
    }
}
