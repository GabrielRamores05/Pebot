package com.cafeos.tablet.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import com.cafeos.tablet.data.*
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.IngredientSpendInfo
import com.cafeos.tablet.ui.IngredientSpendTrendPoint
import com.cafeos.tablet.ui.ProductProfitInfo
import com.cafeos.tablet.ui.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.io.File
import java.util.*
import android.os.Environment
import android.widget.Toast
import android.content.ContentValues
import android.provider.MediaStore
import android.graphics.Bitmap
import android.graphics.Canvas as AndroidCanvas
import android.view.View
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen

/** Inventory health summary in Analytics (spec 014, US5): threshold-driven counts + stock value. */
@Composable
fun InventoryHealthPanel(summary: StockSummary, formatter: NumberFormat) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text("Inventory Health", style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HealthStat("Healthy", summary.healthy, PosAccent)
                HealthStat("Low", summary.low, PosGold)
                HealthStat("Out", summary.out, PosDanger)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text("Stock value: ${formatter.format(summary.totalValue)}", style = MaterialTheme.typography.bodyMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun HealthStat(label: String, count: Int, color: Color) {
    Surface(
        color = color.copy(alpha = 0.12f),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(count.toString(), style = MaterialTheme.typography.titleLarge, color = color, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.labelSmall, color = color, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun AnalyticsScreen(viewModel: CafeViewModel) {
    val orders by viewModel.allOrders.collectAsState(initial = emptyList())
    val expenses by viewModel.allExpenses.collectAsState(initial = emptyList())
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val categories by viewModel.categories.collectAsState(initial = emptyList())
    val settings by viewModel.businessSettings.collectAsState(initial = null)
    val lowStockIngredients by viewModel.lowStockIngredients.collectAsState(initial = emptyList())
    val ingredients by viewModel.ingredients.collectAsState(initial = emptyList())
    var range by remember { mutableStateOf("TODAY") }
    var metrics by remember { mutableStateOf<com.cafeos.tablet.ui.PeriodMetrics?>(null) }
    var productProfit by remember { mutableStateOf<List<ProductProfitInfo>>(emptyList()) }
    var ingredientSpend by remember { mutableStateOf<List<IngredientSpendInfo>>(emptyList()) }
    var ingredientSpendTrend by remember { mutableStateOf<List<IngredientSpendTrendPoint>>(emptyList()) }
    var salesByHour by remember { mutableStateOf(List(24) { 0.0 }) }
    var paymentMix by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }
    var categoryMix by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }
    var orderStatusMix by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }
    var peakDays by remember { mutableStateOf<List<Pair<String, Double>>>(emptyList()) }
    var salesTrend by remember { mutableStateOf<List<IngredientSpendTrendPoint>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val formatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val inventorySummary = remember(ingredients) { StockSummaryRule.summarize(ingredients) }
    val now = System.currentTimeMillis()
    val start = when (range) {
        "TODAY" -> Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        "YESTERDAY" -> Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        "7 DAYS" -> now - 7 * 86400000L
        "THIS MONTH" -> Calendar.getInstance().apply { set(Calendar.DAY_OF_MONTH, 1); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        "THIS YEAR" -> Calendar.getInstance().apply { set(Calendar.DAY_OF_YEAR, 1); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        else -> 0L
    }
    val visibleOrders = orders.filter { it.createdAt >= start && it.createdAt <= now && it.status != "CANCELLED" }
    val rangeProductUnits by remember(range) { viewModel.getProductUnitCount(start, now) }.collectAsState(initial = 0)
    val context = LocalContext.current
    val dateFormatter = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
    val rangeLabel = when (range) {
        "TODAY" -> "Today, ${dateFormatter.format(Date())}"
        "YESTERDAY" -> "Yesterday, ${dateFormatter.format(Date(start))}"
        else -> "${dateFormatter.format(Date(start))} to ${dateFormatter.format(Date(now))}"
    }

    LaunchedEffect(range, orders, expenses, products, categories) {
        metrics = viewModel.calculatePeriodMetrics(visibleOrders, start, now)
        productProfit = viewModel.calculateProductProfitability(visibleOrders)
        ingredientSpend = viewModel.calculateIngredientSpend(visibleOrders).take(8)
        ingredientSpendTrend = viewModel.calculateIngredientSpendTrend(visibleOrders)
        salesByHour = List(24) { hour -> visibleOrders.filter { Calendar.getInstance().apply { timeInMillis = it.createdAt }.get(Calendar.HOUR_OF_DAY) == hour }.sumOf { it.totalAmount } }
        paymentMix = visibleOrders.groupBy { it.paymentMethod }.mapValues { (_, values) -> values.sumOf { it.totalAmount } }
        orderStatusMix = visibleOrders.groupBy { it.status }.mapValues { (_, values) -> values.size.toDouble() }
        val weekdayNames = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
        val weekdaySales = visibleOrders.groupBy { order ->
            val day = Calendar.getInstance().apply { timeInMillis = order.createdAt }.get(Calendar.DAY_OF_WEEK)
            weekdayNames[(day + 5) % 7]
        }.mapValues { (_, dayOrders) -> dayOrders.sumOf { it.totalAmount } }
        val dailySales = visibleOrders.groupBy { order ->
            Calendar.getInstance().apply {
                timeInMillis = order.createdAt
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            }.timeInMillis
        }.toSortedMap()
        salesTrend = dailySales.map { (day, dayOrders) -> IngredientSpendTrendPoint(day, dayOrders.sumOf { it.totalAmount }) }
        peakDays = weekdayNames.map { it to (weekdaySales[it] ?: 0.0) }
        val categoryMap = categories.associateBy { it.id }
        val mix = mutableMapOf<String, Double>()
        visibleOrders.forEach { order ->
            viewModel.getOrderItemsSync(order.id).forEach { item ->
                categoryMap[products.find { it.id == item.productId }?.categoryId]?.name?.let { name -> mix[name] = (mix[name] ?: 0.0) + item.subtotal }
            }
        }
        categoryMix = mix
        isLoading = false
    }

    PremiumScreen {
        PremiumHeader(
            "Business Analytics",
            rangeLabel,
            action = {
                IconButton(onClick = {
                    val savedName = captureAnalyticsScreen(context)
                    Toast.makeText(context, savedName ?: "Unable to capture Analytics", Toast.LENGTH_SHORT).show()
                }) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = "Capture Analytics", tint = PosAccent)
                }
            }
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            listOf("TODAY", "YESTERDAY", "7 DAYS", "THIS MONTH", "THIS YEAR").forEach { option ->
                FilterChip(selected = range == option, onClick = { range = option }, label = { Text(option, style = MaterialTheme.typography.labelSmall) }, shape = RoundedCornerShape(50.dp), colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosCoffeeDeep, selectedLabelColor = Color.White, containerColor = PosSurface, labelColor = PosInkSoft))
            }
        }
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (isLoading) {
                item {
                    LoadingPanel()
                }
            } else if (visibleOrders.isEmpty()) {
                item {
                    EmptyAnalyticsPanel(range)
                }
            }
            item {
                InventoryHealthPanel(inventorySummary, formatter)
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard(Modifier.weight(1f), "Total Sales", metrics?.totalRevenue ?: 0.0, formatter, Icons.Default.AttachMoney, PosAccent)
                            KpiCard(Modifier.weight(1f), "Gross Profit", metrics?.grossProfit ?: 0.0, formatter, Icons.Default.TrendingUp, PosAccent)
                            KpiCard(Modifier.weight(1f), "Net Profit", metrics?.netProfit ?: 0.0, formatter, Icons.Default.AccountBalance, PosGold)
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            KpiCard(Modifier.weight(1f), "COGS", metrics?.totalCOGS ?: 0.0, formatter, Icons.Default.Inventory, PosDanger)
                            KpiCard(Modifier.weight(1f), "Total Orders", visibleOrders.size.toDouble(), NumberFormat.getIntegerInstance(), Icons.Default.ReceiptLong, PosGold)
                            KpiCard(Modifier.weight(1f), "Avg Order", if (visibleOrders.isEmpty()) 0.0 else visibleOrders.sumOf { it.totalAmount } / visibleOrders.size, formatter, Icons.Default.TrendingUp, PosAccent)
                            if (settings?.dailyQuotaTarget ?: 0.0 > 0.0) {
                                val achieved = if (settings?.dailyQuotaMode == "REVENUE") visibleOrders.sumOf { it.totalAmount } else rangeProductUnits.toDouble()
                                KpiCard(Modifier.weight(1f), "Daily Quota", achieved, if (settings?.dailyQuotaMode == "REVENUE") formatter else NumberFormat.getIntegerInstance(), Icons.Default.Flag, PosGold)
                            }
                    }
                }
            }
            item {
                val quotaTarget = settings?.dailyQuotaTarget ?: 0.0
                val quotaMode = settings?.dailyQuotaMode ?: "ORDERS"
                val quotaValue = if (quotaMode == "REVENUE") visibleOrders.sumOf { it.totalAmount } else rangeProductUnits.toDouble()
                AnalyticsQuotaPanel(quotaValue, quotaTarget, quotaMode, formatter)
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KpiCard(Modifier.weight(1f), "Operating Expenses", metrics?.totalExpenses ?: 0.0, formatter, Icons.Default.Receipt, PosDanger)
                    KpiCard(Modifier.weight(1f), "Profit Margin", if ((metrics?.totalRevenue ?: 0.0) > 0.0) ((metrics?.netProfit ?: 0.0) / (metrics?.totalRevenue ?: 1.0) * 100.0) else 0.0, NumberFormat.getNumberInstance().apply { maximumFractionDigits = 1 }, Icons.Default.Percent, PosAccent)
                }
            }
            item {
                        ReportPanel("Sales Trend", onExport = {
                    val file = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "CafeOS_Analytics_${range.replace(' ', '-')}.csv")
                    exportReport(visibleOrders, formatter, file.absolutePath)
                    Toast.makeText(context, "Exported ${file.name}", Toast.LENGTH_SHORT).show()
                }) { TrendChart(salesTrend, PosGold) }
            }
            item {
                ReportPanel("Order Status") { HorizontalBarChart(orderStatusMix.toList(), NumberFormat.getIntegerInstance(), PosAccent) }
            }
            item {
                ReportPanel("Peak Hours") { BarChart(values = salesByHour, color = PosGold) }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ReportPanel(Modifier.weight(1f), "Mode of Payment") { HorizontalBarChart(paymentMix.toList(), formatter, PosAccent) }
                    ReportPanel(Modifier.weight(1f), "Peak Days") { HorizontalBarChart(peakDays, formatter, PosGold) }
                }
            }
            item {
                ReportPanel("Sales by Category") { HorizontalBarChart(categoryMix.toList(), formatter, PosAccent) }
            }
            item {
                ReportPanel("Best Sellers: Top 5") { HorizontalBarChart(productProfit.take(5).map { it.name to it.revenue }, formatter, PosGold) }
            }
            item {
                ReportPanel("Profit by Product: All Products") { HorizontalBarChart(productProfit.map { it.name to it.profit }, formatter, PosAccent) }
            }
            if (ingredientSpend.isNotEmpty()) {
                item {
                    ReportPanel("Ingredient Spend Trend") {
                        TrendChart(ingredientSpendTrend, PosDanger)
                    }
                }
                item { ReportPanel("Ingredient Spend by Item") { ingredientSpend.forEach { item -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(item.name, color = PosInk); Text(formatter.format(item.amount), color = PosDanger, fontWeight = FontWeight.Bold) } } } }
            }
            item {
                ReportPanel("Low Stock Ingredients") {
                    if (lowStockIngredients.isEmpty()) Text("All ingredients are above minimum stock.", color = PosInkSoft)
                    else lowStockIngredients.forEach { ingredient -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(ingredient.name, color = PosInk); Text("${ingredient.currentStock} ${ingredient.baseUnit}", color = PosDanger, fontWeight = FontWeight.Bold) } }
                }
            }
        }
    }
}

@Composable
private fun KpiCard(modifier: Modifier, label: String, value: Double, formatter: NumberFormat, icon: androidx.compose.ui.graphics.vector.ImageVector, accent: Color) {
    Card(modifier, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(PosSurface), elevation = CardDefaults.cardElevation(2.dp)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = accent.copy(alpha = .13f), shape = RoundedCornerShape(8.dp)) { Icon(icon, null, tint = accent, modifier = Modifier.padding(7.dp).size(16.dp)) }
            Spacer(Modifier.width(8.dp))
            Column { Text(formatter.format(value), color = PosInk, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold); Text(label, color = PosInkSoft, style = MaterialTheme.typography.labelSmall) }
        }
    }
}

@Composable
private fun AnalyticsQuotaPanel(current: Double, target: Double, mode: String, formatter: NumberFormat) {
    ReportPanel("Daily Quota") {
        if (target <= 0.0) {
            Text("No daily quota configured. Set one in Settings > Business.", color = PosInkSoft, style = MaterialTheme.typography.bodyMedium)
        } else {
            val progress = (current / target).coerceIn(0.0, 1.0).toFloat()
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text(if (mode == "REVENUE") formatter.format(current) else "${current.toInt()} products", color = PosInk, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("of ${if (mode == "REVENUE") formatter.format(target) else "${target.toInt()} products"}", color = PosInkSoft, style = MaterialTheme.typography.bodySmall)
                }
                Text(if (progress >= 1f) "Reached" else "${(progress * 100).toInt()}%", color = if (progress >= 1f) PosAccent else PosGold, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(progress = progress, modifier = Modifier.fillMaxWidth().height(8.dp), color = if (progress >= 1f) PosAccent else PosGold, trackColor = PosBorder)
            Text(if (progress >= 1f) "Daily target reached." else "${if (mode == "REVENUE") formatter.format((target - current).coerceAtLeast(0.0)) else "${(target - current).coerceAtLeast(0.0).toInt()} products"} remaining", color = PosInkSoft, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
private fun ReportPanel(title: String, onExport: () -> Unit = {}, content: @Composable ColumnScope.() -> Unit) = ReportPanel(Modifier.fillMaxWidth(), title, onExport, content)

@Composable
private fun ReportPanel(modifier: Modifier, title: String, onExport: () -> Unit = {}, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(PosSurface), elevation = CardDefaults.cardElevation(2.dp)) {
        Column(Modifier.padding(16.dp)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(title, color = PosInk, fontWeight = FontWeight.Bold); IconButton(onClick = onExport, modifier = Modifier.size(28.dp)) { Icon(Icons.Default.FileDownload, "Export", tint = PosInkSoft, modifier = Modifier.size(16.dp)) } }; Spacer(Modifier.height(10.dp)); content() }
    }
}

private fun captureAnalyticsScreen(context: android.content.Context): String? {
    val view = (context as? android.app.Activity)?.window?.decorView ?: return null
    if (view.width <= 0 || view.height <= 0) return null
    return try {
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        view.draw(AndroidCanvas(bitmap))
        val name = "CafeOS_Analytics_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())}.png"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/CafeOS")
        }
        val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return null
        context.contentResolver.openOutputStream(uri)?.use { output -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, output) }
        bitmap.recycle()
        "Saved $name"
    } catch (_: Exception) {
        null
    }
}

@Composable
private fun BarChart(values: List<Double>, color: Color) {
    var selectedIndex by remember(values) { mutableStateOf<Int?>(null) }
    val max = values.maxOrNull()?.coerceAtLeast(1.0) ?: 1.0
    val progress by animateFloatAsState(1f, label = "chart")
    Box(Modifier.fillMaxWidth().height(210.dp)) {
        Canvas(Modifier.fillMaxWidth().height(180.dp).pointerInput(values) {
            detectTapGestures { position ->
                if (values.isNotEmpty()) {
                    selectedIndex = (position.x / (size.width / values.size)).toInt().coerceIn(0, values.lastIndex)
                }
            }
        }) {
            values.forEachIndexed { index, value ->
                val width = size.width / values.size
                val height = (value / max * size.height * .88f * progress).toFloat()
                drawRoundRect(color, Offset(index * width + width * .18f, size.height - height), androidx.compose.ui.geometry.Size(width * .64f, height), androidx.compose.ui.geometry.CornerRadius(5f))
            }
            drawLine(PosBorder, Offset(0f, size.height), Offset(size.width, size.height), 2f)
        }
        selectedIndex?.let { index ->
            Surface(color = PosCoffeeDeep, shape = RoundedCornerShape(8.dp), modifier = Modifier.align(Alignment.TopCenter)) {
                Text("${formatHour(index)}  ${NumberFormat.getCurrencyInstance(Locale("en", "PH")).format(values[index])}", color = Color.White, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 184.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            listOf(0, 6, 12, 18, 23).forEach { Text(formatHour(it), color = PosInkSoft, style = MaterialTheme.typography.labelSmall) }
        }
    }
}

private fun formatHour(hour: Int): String {
    val normalized = hour % 24
    val displayHour = when {
        normalized == 0 -> 12
        normalized > 12 -> normalized - 12
        else -> normalized
    }
    val period = if (normalized < 12) "AM" else "PM"
    return "$displayHour $period"
}

@Composable
private fun TrendChart(points: List<IngredientSpendTrendPoint>, color: Color) {
    var selectedIndex by remember(points) { mutableStateOf<Int?>(null) }
    val max = points.maxOfOrNull { it.amount }?.coerceAtLeast(1.0) ?: 1.0
    Box(Modifier.fillMaxWidth().height(210.dp)) {
        Canvas(Modifier.fillMaxWidth().height(180.dp).pointerInput(points) {
            detectTapGestures { position ->
                if (points.isNotEmpty()) {
                    val spacing = size.width / points.size.coerceAtLeast(1)
                    selectedIndex = (position.x / spacing).toInt().coerceIn(0, points.lastIndex)
                }
            }
        }) {
        if (points.isEmpty()) return@Canvas
        val width = if (points.size == 1) size.width else size.width / (points.size - 1)
        val coordinates = points.mapIndexed { index, point ->
            Offset(index * width, size.height - (point.amount / max * size.height * .88f).toFloat())
        }
        drawLine(PosBorder, Offset(0f, size.height), Offset(size.width, size.height), 2f)
        coordinates.zipWithNext().forEach { (from, to) -> drawLine(color, from, to, 5f) }
        coordinates.forEach { point -> drawCircle(color, 7f, point) }
        }
        selectedIndex?.let { index ->
            val point = points[index]
            Surface(color = PosCoffeeDeep, shape = RoundedCornerShape(8.dp), modifier = Modifier.align(Alignment.TopCenter)) {
                Text("${SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(point.day))}  ${NumberFormat.getCurrencyInstance(Locale("en", "PH")).format(point.amount)}", color = Color.White, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
            }
        }
        if (points.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().padding(top = 184.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf(points.first(), points[points.size / 2], points.last()).distinctBy { it.day }.forEach { point ->
                    Text(SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(point.day)), color = PosInkSoft, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun LoadingPanel() {
    ReportPanel("Loading analytics") {
        Row(Modifier.fillMaxWidth().padding(vertical = 26.dp), horizontalArrangement = Arrangement.Center) {
            CircularProgressIndicator(color = PosAccent, modifier = Modifier.size(28.dp), strokeWidth = 3.dp)
        }
    }
}

@Composable
private fun EmptyAnalyticsPanel(range: String) {
    ReportPanel("No sales in $range") {
        Text("Try a wider date range to see performance trends.", color = PosInkSoft, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun HorizontalBarChart(data: List<Pair<String, Double>>, formatter: NumberFormat, color: Color) {
    if (data.isEmpty()) {
        Text("No data for this range.", color = PosInkSoft, style = MaterialTheme.typography.bodyMedium)
        return
    }
    val max = data.maxOf { it.second }.coerceAtLeast(1.0)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        data.forEach { (label, value) ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(label, color = PosInk, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                    Text(formatter.format(value), color = color, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                }
                LinearProgressIndicator(progress = (value / max).toFloat().coerceIn(0f, 1f), modifier = Modifier.fillMaxWidth().height(7.dp), color = color, trackColor = PosMuted.copy(alpha = .3f))
            }
        }
    }
}

fun exportReport(orders: List<Order>, formatter: NumberFormat, filePath: String) { try { File(filePath).bufferedWriter().use { writer -> writer.appendLine("Order Number,Customer,Date,Total Amount,Payment Method,Order Type,Status"); val dateFmt = SimpleDateFormat("yyyy-MM-dd hh:mm a", Locale.getDefault()); orders.forEach { writer.appendLine("${it.orderNumber},${it.customerName},${dateFmt.format(Date(it.createdAt))},${formatter.format(it.totalAmount).replace(",", "")},${it.paymentMethod},${it.orderType},${it.status}") } } } catch (_: Exception) { } }
