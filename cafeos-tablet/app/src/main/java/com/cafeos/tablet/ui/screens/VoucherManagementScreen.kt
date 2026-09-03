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
import com.cafeos.tablet.data.LoyaltyVoucher
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun VoucherManagementScreen(viewModel: CafeViewModel) {
    val vouchers by viewModel.activeVouchers.collectAsState(initial = emptyList())
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    var showAddDialog by remember { mutableStateOf(false) }
    var editingVoucher by remember { mutableStateOf<LoyaltyVoucher?>(null) }
    val scope = rememberCoroutineScope()

    PremiumScreen {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Loyalty Vouchers", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
            Button(
                onClick = { editingVoucher = null; showAddDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Voucher", fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(vouchers) { voucher ->
                VoucherCard(
                    voucher = voucher,
                    currencyFormatter = currencyFormatter,
                    dateFormatter = dateFormatter,
                    onEdit = { editingVoucher = voucher; showAddDialog = true },
                    onDelete = { scope.launch { viewModel.deleteVoucher(voucher) } }
                )
            }
        }
    }

    if (showAddDialog) {
        VoucherFormDialog(
            voucher = editingVoucher,
            onDismiss = { showAddDialog = false; editingVoucher = null },
            onSave = { saved ->
                viewModel.saveVoucher(saved)
                showAddDialog = false
                editingVoucher = null
            }
        )
    }
}

@Composable
fun VoucherCard(voucher: LoyaltyVoucher, currencyFormatter: NumberFormat, dateFormatter: SimpleDateFormat, onEdit: () -> Unit, onDelete: () -> Unit) {
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
                    Text(voucher.code, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
                    Text(voucher.type, style = MaterialTheme.typography.bodySmall, color = PosMuted)
                    Text("${dateFormatter.format(Date(voucher.startDate))} - ${dateFormatter.format(Date(voucher.endDate))}", style = MaterialTheme.typography.bodySmall, color = PosMuted)
                }
                Row {
                    IconButton(onClick = onEdit) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = PosGold, modifier = Modifier.size(18.dp))
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = PosDanger, modifier = Modifier.size(18.dp))
                    }
                }
            }
            Text("Used: ${voucher.usedCount}/${voucher.usageLimit}", style = MaterialTheme.typography.bodySmall, color = PosInkSoft)
        }
    }
}

private fun formatVoucherDate(millis: Long): String =
    java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date(millis))

private fun parseVoucherDate(text: String): Long? = try {
    java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(text)?.time
} catch (_: Exception) {
    null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoucherFormDialog(voucher: LoyaltyVoucher?, onDismiss: () -> Unit, onSave: (LoyaltyVoucher) -> Unit) {
    var code by remember { mutableStateOf(voucher?.code ?: "") }
    var type by remember { mutableStateOf(voucher?.type ?: "PROMO") }
    var discountType by remember { mutableStateOf(voucher?.discountType ?: "PERCENTAGE") }
    var discountValueText by remember { mutableStateOf((voucher?.discountValue ?: 0.0).toString()) }
    var minOrderText by remember { mutableStateOf((voucher?.minOrderAmount ?: 0.0).toString()) }
    var maxDiscountText by remember { mutableStateOf((voucher?.maxDiscount ?: 0.0).toString()) }
    var usageLimitText by remember { mutableStateOf((voucher?.usageLimit ?: 0).toString()) }
    var startDateText by remember { mutableStateOf(voucher?.let { formatVoucherDate(it.startDate) } ?: formatVoucherDate(System.currentTimeMillis())) }
    var endDateText by remember { mutableStateOf(voucher?.let { formatVoucherDate(it.endDate) } ?: formatVoucherDate(System.currentTimeMillis() + 30L * 24 * 3600_000L)) }
    var active by remember { mutableStateOf(voucher?.active ?: true) }

    val voucherTypes = listOf("PROMO", "REWARD", "MILESTONE")
    val discountTypes = listOf("PERCENTAGE", "FIXED")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (voucher == null) "New Voucher" else "Edit Voucher", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = code, onValueChange = { code = it.uppercase() }, label = { Text("Code") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))

                Text("Voucher Type", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    voucherTypes.forEach { t ->
                        FilterChip(selected = type == t, onClick = { type = t }, label = { Text(t) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))

                Text("Discount Type", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    discountTypes.forEach { d ->
                        FilterChip(selected = discountType == d, onClick = { discountType = d }, label = { Text(d) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(value = discountValueText, onValueChange = { discountValueText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Discount Value") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = minOrderText, onValueChange = { minOrderText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Min Order Amount (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = maxDiscountText, onValueChange = { maxDiscountText = it.filter { c -> c.isDigit() || c == '.' } }, label = { Text("Max Discount (₱)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = usageLimitText, onValueChange = { usageLimitText = it.filter { c -> c.isDigit() } }, label = { Text("Usage Limit") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = startDateText, onValueChange = { startDateText = it }, label = { Text("Start date (yyyy-MM-dd)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = endDateText, onValueChange = { endDateText = it }, label = { Text("Expiry date (yyyy-MM-dd)") }, modifier = Modifier.fillMaxWidth(), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline), singleLine = true)
                Spacer(modifier = Modifier.height(12.dp))

                Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Active", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                    Switch(checked = active, onCheckedChange = { active = it }, colors = SwitchDefaults.colors(checkedThumbColor = PosAccent))
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (code.isNotBlank()) {
                        val fallbackStart = voucher?.startDate ?: System.currentTimeMillis()
                        val fallbackEnd = voucher?.endDate ?: (System.currentTimeMillis() + 30L * 24 * 3600_000L)
                        var startDate = parseVoucherDate(startDateText) ?: fallbackStart
                        var endDate = parseVoucherDate(endDateText) ?: fallbackEnd
                        if (endDate < startDate) endDate = startDate
                        val saved = if (voucher == null) {
                            LoyaltyVoucher(
                                code = code, type = type, discountType = discountType,
                                discountValue = discountValueText.toDoubleOrNull() ?: 0.0,
                                minOrderAmount = minOrderText.toDoubleOrNull() ?: 0.0,
                                maxDiscount = maxDiscountText.toDoubleOrNull() ?: 0.0,
                                usageLimit = usageLimitText.toIntOrNull() ?: 0,
                                startDate = startDate, endDate = endDate, active = active
                            )
                        } else {
                            voucher.copy(
                                code = code, type = type, discountType = discountType,
                                discountValue = discountValueText.toDoubleOrNull() ?: 0.0,
                                minOrderAmount = minOrderText.toDoubleOrNull() ?: 0.0,
                                maxDiscount = maxDiscountText.toDoubleOrNull() ?: 0.0,
                                usageLimit = usageLimitText.toIntOrNull() ?: 0,
                                startDate = startDate, endDate = endDate, active = active
                            )
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
