package com.cafeos.tablet.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Order
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.*
import java.io.File
import java.io.FileWriter
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun AnalyticsScreen(viewModel: CafeViewModel) {
    val orders by viewModel.allOrders.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = java.text.SimpleDateFormat("MMM dd", Locale.getDefault())

    var selectedRange by remember { mutableStateOf("TODAY") }
    val ranges = listOf("TODAY", "WEEK", "MONTH", "QUARTER", "YEAR", "ALL")

    val now = System.currentTimeMillis()
    val startOfDay = when (selectedRange) {
        "TODAY" -> {
            val cal = Calendar.getInstance().apply { clear(); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
            cal.timeInMillis
        }
        "WEEK" -> now - 7 * 24 * 3600_000L
        "MONTH" -> now - 30 * 24 * 3600_000L
        "QUARTER" -> now - 90 * 24 * 3600_000L
        "YEAR" -> now - 365 * 24 * 3600_000L
        else -> 0L
    }

    val filteredOrders = if (selectedRange == "ALL") {
        orders
    } else {
        orders.filter { it.createdAt >= startOfDay }
    }

    val totalSales = filteredOrders.sumOf { it.totalAmount }
    val orderCount = filteredOrders.size
    val avgOrderValue = if (orderCount > 0) totalSales / orderCount else 0.0
    val salesByPaymentMethod = filteredOrders.groupBy { it.paymentMethod }.mapValues { it.value.sumOf { o -> o.totalAmount } }

    var salesByDay by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }
    var dayLabels by remember { mutableStateOf<List<String>>(emptyList()) }
    var salesByCategory by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }
    var topProducts by remember { mutableStateOf<List<ProductSalesInfo>>(emptyList()) }
    var customerMetrics by remember { mutableStateOf<CustomerMetrics?>(null) }
    var voucherMetrics by remember { mutableStateOf<VoucherMetrics?>(null) }

    val productsState by viewModel.allProducts.collectAsState(initial = emptyList())
    val categoriesState by viewModel.categories.collectAsState(initial = emptyList())
    val customers by viewModel.allCustomers.collectAsState(initial = emptyList())
    val vouchers by viewModel.activeVouchers.collectAsState(initial = emptyList())

    LaunchedEffect(selectedRange, orders.size) {
        val cal = Calendar.getInstance()
        val newDayLabels = mutableListOf<String>()
        val newSalesByDay = mutableMapOf<String, Double>()
        when (selectedRange) {
            "TODAY" -> {
                for (h in 0..23) {
                    val dayCal = Calendar.getInstance().apply { clear(); set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
                    val label = String.format("%02d:00", h)
                    newDayLabels.add(label)
                    val hourMs = dayCal.timeInMillis
                    newSalesByDay[label] = filteredOrders.filter { it.createdAt >= hourMs && it.createdAt < hourMs + 3600_000L }.sumOf { it.totalAmount }
                }
            }
            "WEEK" -> {
                for (d in 6 downTo 0) {
                    cal.timeInMillis = now - d * 24 * 3600_000L
                    val label = dateFormatter.format(Date(cal.timeInMillis))
                    newDayLabels.add(label)
                    val dayStart = cal.apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
                    newSalesByDay[label] = filteredOrders.filter { it.createdAt >= dayStart && it.createdAt < dayStart + 24 * 3600_000L }.sumOf { it.totalAmount }
                }
            }
            "MONTH", "QUARTER", "YEAR" -> {
                filteredOrders.groupBy { dateFormatter.format(Date(it.createdAt)) }.forEach { (k, v) ->
                    newDayLabels.add(k)
                    newSalesByDay[k] = v.sumOf { it.totalAmount }
                }
            }
            "ALL" -> {
                val months = linkedMapOf<String, Double>()
                val monthFmt = java.text.SimpleDateFormat("MMM yyyy", Locale.getDefault())
                filteredOrders.groupBy { monthFmt.format(Date(it.createdAt)) }.forEach { (k, v) ->
                    months[k] = v.sumOf { it.totalAmount }
                }
                newDayLabels.addAll(months.keys.toList())
                months.forEach { (k, v) -> newSalesByDay[k] = v }
            }
        }
        dayLabels = newDayLabels
        salesByDay = newSalesByDay

        val catMap = categoriesState.associateBy { it.id }
        val prodMap = productsState.associateBy { it.id }
        val newCatSales = mutableMapOf<String, Double>()
        filteredOrders.forEach { order ->
            viewModel.getOrderItemsSync(order.id).forEach { item ->
                val prod = prodMap[item.productId]
                val cat = prod?.let { catMap[it.categoryId] }
                if (cat != null) {
                    newCatSales[cat.name] = (newCatSales[cat.name] ?: 0.0) + item.subtotal
                }
            }
        }
        salesByCategory = newCatSales

        val productSales = mutableMapOf<Int, ProductSalesInfo>()
        filteredOrders.forEach { order ->
            viewModel.getOrderItemsSync(order.id).forEach { item ->
                val prod = prodMap[item.productId]
                if (prod != null) {
                    val existing = productSales[prod.id]
                    productSales[prod.id] = existing?.let {
                        it.copy(quantity = it.quantity + item.quantity, revenue = it.revenue + item.subtotal)
                    } ?: ProductSalesInfo(name = prod.name, quantity = item.quantity, revenue = item.subtotal)
                }
            }
        }
        topProducts = productSales.values.sortedByDescending { it.revenue }.take(5)

        val customerNames = filteredOrders.mapNotNull { it.customerName }.toSet()
        val customerOrderCounts = mutableMapOf<String, Int>()
        val customerTotalSpents = mutableMapOf<String, Double>()
        filteredOrders.forEach { order ->
            val name = order.customerName
            if (name.isNotBlank()) {
                customerOrderCounts[name] = (customerOrderCounts[name] ?: 0) + 1
                customerTotalSpents[name] = (customerTotalSpents[name] ?: 0.0) + order.totalAmount
            }
        }
        val totalCustomerRevenue = customerTotalSpents.values.sum()
        val avgCustomerSpent = if (customerTotalSpents.isNotEmpty()) totalCustomerRevenue / customerTotalSpents.size else 0.0
        customerMetrics = CustomerMetrics(
            totalCustomers = customerNames.size,
            avgSpentPerCustomer = avgCustomerSpent,
            topCustomers = customerTotalSpents.entries.sortedByDescending { it.value }.take(5).map { CustomerSpending(it.key, it.value, customerOrderCounts[it.key] ?: 0) }
        )

        val totalVoucherUses = vouchers.sumOf { it.usedCount }
        val totalVoucherSavings = vouchers.sumOf { it.discountValue * it.usedCount }
        voucherMetrics = VoucherMetrics(
            totalVouchers = vouchers.size,
            totalUses = totalVoucherUses,
            totalSavings = totalVoucherSavings,
            redemptionRates = vouchers.map { it.code to if (it.usageLimit > 0) (it.usedCount.toDouble() / it.usageLimit * 100.0) else 0.0 }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(20.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Default.BarChart, contentDescription = null, tint = PosGold, modifier = Modifier.size(28.dp))
                Text("Analytics", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            }
            TextButton(onClick = {
                selectedRange = "ALL"
            }) { Text("Reset", color = PosMuted) }
            TextButton(onClick = {
                exportReport(
                    filteredOrders,
                    currencyFormatter,
                    android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS).absolutePath + "/Pebot_Analytics_" + java.text.SimpleDateFormat("yyyyMMdd_HHmmss", java.util.Locale.getDefault()).format(java.util.Date()) + ".csv"
                )
            }) {
                Icon(Icons.Default.FileDownload, contentDescription = "Export CSV", tint = PosGold, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Export CSV", color = PosGold)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))

        ScrollableTabRow(
            selectedTabIndex = ranges.indexOf(selectedRange),
            edgePadding = 0.dp,
            divider = {},
            containerColor = PosCoffeeLight,
            contentColor = PosGold
        ) {
            ranges.forEach { range ->
                Tab(
                    selected = selectedRange == range,
                    onClick = { selectedRange = range },
                    text = { Text(range) }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = PosAccent),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                ) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Text("Gross Sales", style = MaterialTheme.typography.titleMedium, color = PosPaper.copy(alpha = 0.9f))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            currencyFormatter.format(totalSales),
                            style = MaterialTheme.typography.headlineLarge,
                            color = PosPaper,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Orders", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = "$orderCount", style = MaterialTheme.typography.headlineMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                        }
                    }
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Avg Order", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = currencyFormatter.format(avgOrderValue), style = MaterialTheme.typography.headlineMedium, color = PosGold, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            item {
                if (dayLabels.isNotEmpty()) {
                    Text("Sales Trend", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(12.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.BottomEnd
                    ) {
                        val animatedProgress by animateFloatAsState(targetValue = 1f, animationSpec = androidx.compose.animation.core.tween(durationMillis = 800))
                        Canvas(modifier = Modifier
                            .fillMaxSize()
                            .padding(top = 24.dp, end = 8.dp, bottom = 24.dp)
                        ) {
                            val maxVal = salesByDay.values.maxOrNull() ?: 1.0
                            val actualMax = if (maxVal > 0) maxVal else 1.0
                            val barWidth = size.width / (dayLabels.size * 2)
                            val chartHeight = size.height

                            dayLabels.forEachIndexed { index, label ->
                                val barHeight = (salesByDay[label] ?: 0.0) / actualMax * chartHeight * 0.8f * animatedProgress
                                val left = index * (barWidth * 2) + 4
                                val top = chartHeight - barHeight
                                drawRoundRect(
                                    color = PosGold,
                                    topLeft = Offset(left.toFloat(), top.toFloat()),
                                    size = Size(barWidth - 4, barHeight.toFloat()),
                                    cornerRadius = CornerRadius(8f)
                                )
                            }

                            drawLine(
                                color = PosMuted,
                                strokeWidth = 2f,
                                start = Offset(0f, chartHeight),
                                end = Offset(size.width, chartHeight)
                            )
                            drawLine(
                                color = PosMuted,
                                strokeWidth = 1f,
                                start = Offset(0f, chartHeight * 0.5f),
                                end = Offset(size.width, chartHeight * 0.5f)
                            )
                            drawContext.canvas.nativeCanvas.apply {
                                drawText(
                                    currencyFormatter.format(actualMax).takeIf { it.isNotBlank() } ?: "",
                                    0f,
                                    chartHeight * 0.5f - 16,
                                    android.text.TextPaint().apply { textSize = 24f; color = android.graphics.Color.parseColor("#FFFFFF"); typeface = android.graphics.Typeface.DEFAULT_BOLD; isAntiAlias = true }
                                )
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(start = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            dayLabels.forEach { label ->
                                Text(label, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                            }
                        }
                    }
                }
            }

            customerMetrics?.let { metrics ->
                if (metrics.totalCustomers > 0) {
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Customer Analytics", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("Customers", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                                    Text("${metrics.totalCustomers}", style = MaterialTheme.typography.headlineMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                                }
                            }
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("Avg Spent", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                                    Text(currencyFormatter.format(metrics.avgSpentPerCustomer), style = MaterialTheme.typography.headlineMedium, color = PosGold, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    items(metrics.topCustomers, key = { it.name }) { customer ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(customer.name, style = MaterialTheme.typography.bodyLarge, color = PosPaper, fontWeight = FontWeight.Medium)
                                    Text("${customer.orders} orders", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                }
                                Text(currencyFormatter.format(customer.totalSpent), style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            voucherMetrics?.let { metrics ->
                if (metrics.totalVouchers > 0) {
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Voucher Analytics", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("Active Vouchers", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                                    Text("${metrics.totalVouchers}", style = MaterialTheme.typography.headlineMedium, color = PosPaper, fontWeight = FontWeight.Bold)
                                }
                            }
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("Total Savings", style = MaterialTheme.typography.labelMedium, color = PosMuted)
                                    Text(currencyFormatter.format(metrics.totalSavings), style = MaterialTheme.typography.headlineMedium, color = PosGold, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    items(metrics.redemptionRates, key = { it.first }) { (code, rate) ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(code, style = MaterialTheme.typography.bodyLarge, color = PosPaper, fontWeight = FontWeight.Medium)
                                    Text("${metrics.totalUses} uses", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                                }
                                Text("${"%.1f".format(rate)}%", style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            if (salesByPaymentMethod.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Payment Method Breakdown", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(12.dp))
                    PieChart(data = salesByPaymentMethod)
                    Spacer(modifier = Modifier.height(12.dp))
                }
                items(salesByPaymentMethod.entries.toList()) { (method, total) ->
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
                            Text(method, style = MaterialTheme.typography.bodyLarge, color = PosPaper, fontWeight = FontWeight.Medium)
                            Text(currencyFormatter.format(total), style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            if (salesByCategory.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Category Breakdown", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(12.dp))
                }
                items(salesByCategory.entries.toList()) { (cat, total) ->
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
                            Text(cat, style = MaterialTheme.typography.bodyLarge, color = PosPaper, fontWeight = FontWeight.Medium)
                            Text(currencyFormatter.format(total), style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            if (topProducts.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Top Products", style = MaterialTheme.typography.titleLarge, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(12.dp))
                }
                items(topProducts) { prod ->
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
                                Text(prod.name, style = MaterialTheme.typography.bodyLarge, color = PosPaper, fontWeight = FontWeight.Medium)
                                Text("${prod.quantity} sold", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                            }
                            Text(currencyFormatter.format(prod.revenue), style = MaterialTheme.typography.titleMedium, color = PosGold, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

fun exportReport(orders: List<Order>, formatter: NumberFormat, filePath: String) {
    try {
        val file = File(filePath)
        val writer = FileWriter(file)
        writer.append("Order Number,Customer,Date,Total Amount,Payment Method,Order Type,Status\n")
        val dateFmt = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
        orders.forEach { order ->
            writer.append("${order.orderNumber},")
            writer.append("${order.customerName},")
            writer.append("${dateFmt.format(Date(order.createdAt))},")
            writer.append("${formatter.format(order.totalAmount).replace(",", "")},")
            writer.append("${order.paymentMethod},")
            writer.append("${order.orderType},")
            writer.append("${order.status}\n")
        }
        writer.flush()
        writer.close()
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

data class ProductSalesInfo(val name: String, val quantity: Int, val revenue: Double)

data class CustomerMetrics(
    val totalCustomers: Int,
    val avgSpentPerCustomer: Double,
    val topCustomers: List<CustomerSpending>
)

data class CustomerSpending(
    val name: String,
    val totalSpent: Double,
    val orders: Int
)

data class VoucherMetrics(
    val totalVouchers: Int,
    val totalUses: Int,
    val totalSavings: Double,
    val redemptionRates: List<Pair<String, Double>>
)

@Composable
fun PieChart(data: Map<String, Double>, modifier: Modifier = Modifier, colors: List<Color> = listOf(PosAccent, PosGold, Color(0xFF60A5FA), PosDanger, PosInkSoft)) {
    if (data.isEmpty()) return
    val total = data.values.sum()
    if (total <= 0) return
    val animatedProgress by animateFloatAsState(targetValue = 1f, animationSpec = androidx.compose.animation.core.tween(durationMillis = 1000))
    Card(modifier = modifier.fillMaxWidth().height(200.dp), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = PosCoffeeLight)) {
        Box(modifier = Modifier.padding(16.dp)) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val center = Offset(size.width / 2, size.height / 2)
                val radius = minOf(size.width, size.height) / 2 * 0.8f
                var startAngle = -90f
                val sweepAngles = data.values.map { (it / total * 360f * animatedProgress).toFloat() }
                sweepAngles.forEachIndexed { index, sweep ->
                    drawArc(
                        color = colors[index % colors.size],
                        startAngle = startAngle,
                        sweepAngle = sweep,
                        useCenter = true,
                        topLeft = Offset(center.x - radius, center.y - radius),
                        size = Size(radius * 2, radius * 2)
                    )
                    startAngle += sweep
                }
            }
        }
    }
}
