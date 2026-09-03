package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Customer
import com.cafeos.tablet.data.LoyaltyCard
import com.cafeos.tablet.data.Order
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import java.text.NumberFormat
import java.util.*

@Composable
fun CustomerAnalyticsScreen(viewModel: CafeViewModel) {
    val customers by viewModel.allCustomers.collectAsState(initial = emptyList())
    val orders by viewModel.allOrders.collectAsState(initial = emptyList())
    val loyaltyCards by viewModel.allLoyaltyCards.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))

    val customerNames = orders.mapNotNull { it.customerName }.toSet()
    val customerSpendings = mutableMapOf<String, Double>()
    val customerOrderCounts = mutableMapOf<String, Int>()
    orders.forEach { order ->
        val name = order.customerName
        if (name.isNotBlank()) {
            customerSpendings[name] = (customerSpendings[name] ?: 0.0) + order.totalAmount
            customerOrderCounts[name] = (customerOrderCounts[name] ?: 0) + 1
        }
    }

    val topCustomers = customerSpendings.entries.sortedByDescending { it.value }.take(5)
    val avgSpent = if (customerSpendings.isNotEmpty()) customerSpendings.values.average() else 0.0

    val totalUniqueCustomers = customers.size + customerNames.size
    val newThisMonth = if (orders.isNotEmpty()) {
        val oneMonthAgo = System.currentTimeMillis() - 30 * 24 * 3600_000L
        orders.filter { it.createdAt >= oneMonthAgo }.mapNotNull { it.customerName }.toSet().size
    } else 0

    val tierCounts = loyaltyCards.groupBy { it.tier }.mapValues { it.value.size }

    PremiumScreen {
        PremiumHeader("Customer Analytics", "Understand loyalty and repeat visits")
        Text("Customer Analytics", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
        Text("Insights into customer behavior and loyalty", style = MaterialTheme.typography.bodyMedium, color = PosMuted, modifier = Modifier.padding(top = 4.dp))

        Spacer(modifier = Modifier.height(24.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Total Customers",
                        value = "$totalUniqueCustomers",
                        color = PosPaper
                    )
                    MetricCard(
                        modifier = Modifier.weight(1f),
                        title = "New (30d)",
                        value = "$newThisMonth",
                        color = PosGold
                    )
                    MetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Avg Spend",
                        value = currencyFormatter.format(avgSpent),
                        color = PosPaper
                    )
                }
            }

            if (tierCounts.isNotEmpty()) {
                item {
                    Text("Loyalty Tiers", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        tierCounts.entries.forEach { (tier, count) ->
                            TierCard(
                                modifier = Modifier.weight(1f),
                                tier = tier,
                                count = count,
                                currencyFormatter = currencyFormatter
                            )
                        }
                    }
                }
            }

            item {
                Text("Top Customers by Spend", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(12.dp))
            }

            if (topCustomers.isEmpty()) {
                item {
                    Text("No customer data available.", style = MaterialTheme.typography.bodyMedium, color = PosMuted)
                }
            } else {
                items(topCustomers) { (name, total) ->
                    CustomerSpendingCard(
                        name = name,
                        totalSpent = total,
                        orders = customerOrderCounts[name] ?: 0,
                        currencyFormatter = currencyFormatter
                    )
                }
            }

            item {
                Text("All Customers", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(12.dp))
            }

            if (customers.isEmpty()) {
                item {
                    Text("No customers saved. Customers from orders are tracked above.", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                }
            } else {
                items(customers, key = { it.id }) { customer ->
                    CustomerCard(
                        customer = customer,
                        currencyFormatter = currencyFormatter
                    )
                }
            }
        }
    }
}

@Composable
fun MetricCard(modifier: Modifier = Modifier, title: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = PosMuted)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, color = color, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun TierCard(modifier: Modifier = Modifier, tier: String, count: Int, currencyFormatter: NumberFormat) {
    val tierColor = when (tier) {
        "VIP" -> PosGold
        "REGULAR" -> PosAccent
        "CASUAL" -> PosMuted
        else -> PosInkSoft
    }

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = if (tier == "VIP") Icons.Default.Star else Icons.Default.StarBorder,
                contentDescription = null,
                tint = tierColor,
                modifier = Modifier.size(24.dp)
            )
            Text(tier, style = MaterialTheme.typography.titleMedium, color = tierColor, fontWeight = FontWeight.Bold)
            Text("$count customers", style = MaterialTheme.typography.bodySmall, color = PosMuted)
        }
    }
}

@Composable
fun CustomerSpendingCard(name: String, totalSpent: Double, orders: Int, currencyFormatter: NumberFormat) {
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
                Text(name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                Text("$orders orders", style = MaterialTheme.typography.bodySmall, color = PosMuted)
            }
            Text(currencyFormatter.format(totalSpent), style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerCard(customer: Customer, currencyFormatter: NumberFormat) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(customer.name, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                    customer.contact?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = PosMuted) }
                }
                Text(
                    "Points: ${customer.loyaltyPoints}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = PosGold,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}