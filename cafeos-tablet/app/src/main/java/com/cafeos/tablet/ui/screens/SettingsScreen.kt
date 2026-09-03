package com.cafeos.tablet.ui.screens

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.BusinessSettings
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: CafeViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val businessSettings by viewModel.businessSettings.collectAsState(initial = null)
    var exportPath by remember { mutableStateOf<String?>(null) }
    var importing by remember { mutableStateOf(false) }
    var importResult by remember { mutableStateOf<String?>(null) }
    var exporting by remember { mutableStateOf(false) }

    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("System", "Business", "Payments", "Receipts", "Voice")

    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            importing = true
            scope.launch {
                try {
                    val result = viewModel.importAllData(context, uri)
                    importResult = if (result.success) {
                        "Imported: ${result.imported}. Skipped: ${result.skipped}"
                    } else {
                        result.message ?: "Import failed"
                    }
                } catch (e: Exception) {
                    importResult = "Error: ${e.message}"
                } finally {
                    importing = false
                }
            }
        }
    }

    PremiumScreen {
        PremiumHeader("Settings", "Workspace preferences and data controls")
        Spacer(modifier = Modifier.height(16.dp))

        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            edgePadding = 0.dp,
            divider = {},
            containerColor = PosCoffeeDeep,
            contentColor = Color.White
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) },
                    selectedContentColor = Color.White,
                    unselectedContentColor = PosCream.copy(alpha = 0.72f)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        when (selectedTab) {
            0 -> SystemSettingsContent(
                exporting = exporting,
                importResult = importResult,
                exportPath = exportPath,
                onExport = {
                    exporting = true
                    scope.launch {
                        try {
                            exportPath = viewModel.exportAllData()
                        } catch (e: Exception) {
                            exportPath = "Error: ${e.message}"
                        } finally {
                            exporting = false
                        }
                    }
                },
                onImport = { importLauncher.launch(arrayOf("application/json")) },
                importing = importing
            )
            1 -> BusinessSettingsContent(
                businessSettings = businessSettings,
                onSave = { updated -> scope.launch { viewModel.updateBusinessSettings(updated) } }
            )
            2 -> PaymentSettingsContent(
                businessSettings = businessSettings,
                onSave = { updated -> scope.launch { viewModel.updateBusinessSettings(updated) } }
            )
            3 -> ReceiptSettingsContent(
                businessSettings = businessSettings,
                onSave = { updated -> scope.launch { viewModel.updateBusinessSettings(updated) } }
            )
            4 -> VoiceSettingsContent(
                businessSettings = businessSettings,
                onSave = { updated -> scope.launch { viewModel.updateBusinessSettings(updated) } }
            )
        }
    }
}

@Composable
fun VoiceSettingsContent(businessSettings: BusinessSettings?, onSave: (BusinessSettings) -> Unit) {
    var voiceEnabled by remember { mutableStateOf(businessSettings?.voiceEnabled ?: true) }
    var voiceVolume by remember { mutableStateOf(businessSettings?.voiceVolume ?: 1.0f) }
    var voiceSpeed by remember { mutableStateOf(businessSettings?.voiceSpeed ?: 1.0f) }
    var orderMessage by remember { mutableStateOf(businessSettings?.voiceOrderMessage ?: "New order {order} for {customer} received at {table}.") }
    var quotaMessage by remember { mutableStateOf(businessSettings?.voiceQuotaMessage ?: "Congratulations! Daily quota reached: {current} of {target}.") }

    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Voice Notifications", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("Enable Voice", color = MaterialTheme.colorScheme.onSurface)
                    Switch(checked = voiceEnabled, onCheckedChange = { voiceEnabled = it }, colors = SwitchDefaults.colors(checkedThumbColor = PosAccent))
                }

                Spacer(modifier = Modifier.height(24.dp))
                Text("Volume: ${(voiceVolume * 100).toInt()}%", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                Slider(value = voiceVolume, onValueChange = { voiceVolume = it }, colors = SliderDefaults.colors(thumbColor = PosAccent, activeTrackColor = PosAccent))

                Spacer(modifier = Modifier.height(16.dp))
                Text("Speed: ${"%.1f".format(voiceSpeed)}x", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                Slider(value = voiceSpeed, onValueChange = { voiceSpeed = it }, valueRange = 0.5f..2.0f, colors = SliderDefaults.colors(thumbColor = PosGold, activeTrackColor = PosGold))

                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(value = orderMessage, onValueChange = { orderMessage = it }, label = { Text("Order notification") }, supportingText = { Text("Use {order}, {customer}, and {table}") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(value = quotaMessage, onValueChange = { quotaMessage = it }, label = { Text("Quota notification") }, supportingText = { Text("Use {current} and {target}") }, modifier = Modifier.fillMaxWidth(), minLines = 2)

                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = { onSave((businessSettings ?: BusinessSettings()).copy(voiceEnabled = voiceEnabled, voiceVolume = voiceVolume, voiceSpeed = voiceSpeed, voiceOrderMessage = orderMessage, voiceQuotaMessage = quotaMessage)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                ) {
                    Text("Save Voice Settings", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
fun SystemSettingsContent(
    exporting: Boolean,
    importing: Boolean,
    exportPath: String?,
    importResult: String?,
    onExport: () -> Unit,
    onImport: () -> Unit
) {
    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Data Management", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedButton(
                    onClick = onExport,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !exporting,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    if (exporting) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Exporting...")
                    } else {
                        Icon(Icons.Default.FileDownload, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Export All Data")
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedButton(
                    onClick = onImport,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !importing,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                ) {
                    if (importing) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Importing...")
                    } else {
                        Icon(Icons.Default.FileUpload, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Import Data")
                    }
                }

                exportPath?.let { path ->
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = "Exported to: $path", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                }

                importResult?.let { result ->
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = result, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("About", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Version 1.0.0", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Offline-first POS terminal", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun BusinessSettingsContent(businessSettings: BusinessSettings?, onSave: (BusinessSettings) -> Unit) {
    var shopName by remember { mutableStateOf(businessSettings?.shopName ?: "Pebot") }
    var tin by remember { mutableStateOf(businessSettings?.tin ?: "") }
    var branchCode by remember { mutableStateOf(businessSettings?.branchCode ?: "") }
    var vatRate by remember { mutableStateOf((businessSettings?.vatRate ?: 12.0).toString()) }
    var studentPwdRate by remember { mutableStateOf((businessSettings?.studentPwdDiscountRate ?: 20.0).toString()) }
    var quotaMode by remember { mutableStateOf(businessSettings?.dailyQuotaMode ?: "ORDERS") }
    var quotaTarget by remember { mutableStateOf((businessSettings?.dailyQuotaTarget ?: 0.0).toString()) }

    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Business Information", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = shopName, onValueChange = { shopName = it },
                    label = { Text("Shop Name") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = tin, onValueChange = { tin = it },
                    label = { Text("BIR TIN") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = branchCode, onValueChange = { branchCode = it },
                    label = { Text("Branch Code") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = vatRate, onValueChange = { vatRate = it },
                    label = { Text("VAT Rate (%)") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = studentPwdRate, onValueChange = { studentPwdRate = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Student / PWD Discount (%)") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )

                Spacer(modifier = Modifier.height(16.dp))
                Text("Daily Quota", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("ORDERS", "REVENUE").forEach { mode ->
                        FilterChip(selected = quotaMode == mode, onClick = { quotaMode = mode }, label = { Text(if (mode == "ORDERS") "Products" else "Revenue") })
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = quotaTarget, onValueChange = { quotaTarget = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text(if (quotaMode == "ORDERS") "Daily product target" else "Daily revenue target (₱)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )

                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { onSave((businessSettings ?: BusinessSettings()).copy(shopName = shopName, tin = tin.ifBlank { null }, branchCode = branchCode.ifBlank { null }, vatRate = vatRate.toDoubleOrNull() ?: 12.0, studentPwdDiscountRate = studentPwdRate.toDoubleOrNull() ?: 20.0, dailyQuotaMode = quotaMode, dailyQuotaTarget = quotaTarget.toDoubleOrNull() ?: 0.0)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                ) {
                    Text("Save Business Settings", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
fun PaymentSettingsContent(businessSettings: BusinessSettings?, onSave: (BusinessSettings) -> Unit) {
    var gcashName by remember { mutableStateOf(businessSettings?.gcashAccountName ?: "") }
    var paymayaName by remember { mutableStateOf(businessSettings?.paymayaAccountName ?: "") }
    var gcashQrPath by remember { mutableStateOf(businessSettings?.gcashQrPath) }
    var paymayaQrPath by remember { mutableStateOf(businessSettings?.paymayaQrPath) }

    val context = LocalContext.current
    val gcashLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            val file = java.io.File(context.filesDir, "gcash_qr.jpg")
            context.contentResolver.openInputStream(it)?.use { input ->
                file.outputStream().use { output -> input.copyTo(output) }
            }
            gcashQrPath = file.absolutePath
        }
    }
    val paymayaLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            val file = java.io.File(context.filesDir, "paymaya_qr.jpg")
            context.contentResolver.openInputStream(it)?.use { input ->
                file.outputStream().use { output -> input.copyTo(output) }
            }
            paymayaQrPath = file.absolutePath
        }
    }

    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Payment Methods", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = gcashName, onValueChange = { gcashName = it },
                    label = { Text("GCash Account Name") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(onClick = { gcashLauncher.launch("image/*") }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.QrCode, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (gcashQrPath != null) "Change GCash QR" else "Upload GCash QR")
                }
                QrPreview(path = gcashQrPath, label = "GCash QR")

                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = paymayaName, onValueChange = { paymayaName = it },
                    label = { Text("PayMaya Account Name") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(onClick = { paymayaLauncher.launch("image/*") }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.QrCode, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (paymayaQrPath != null) "Change PayMaya QR" else "Upload PayMaya QR")
                }
                QrPreview(path = paymayaQrPath, label = "PayMaya QR")

                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = { 
                        onSave((businessSettings ?: BusinessSettings()).copy(
                            gcashAccountName = gcashName.ifBlank { null }, 
                            paymayaAccountName = paymayaName.ifBlank { null },
                            gcashQrPath = gcashQrPath,
                            paymayaQrPath = paymayaQrPath
                        )) 
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                ) {
                    Text("Save Payment Settings", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
fun ReceiptSettingsContent(businessSettings: BusinessSettings?, onSave: (BusinessSettings) -> Unit) {
    var receiptPrefix by remember { mutableStateOf(businessSettings?.receiptPrefix ?: "INV") }
    var lastNumber by remember { mutableStateOf((businessSettings?.lastReceiptNumber ?: 0).toString()) }
var footerText by remember { mutableStateOf(businessSettings?.footerMessage ?: "Thank you for your visit!") }

    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Receipt / BIR Numbering", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = receiptPrefix, onValueChange = { receiptPrefix = it.uppercase() },
                    label = { Text("Receipt Prefix") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = lastNumber, onValueChange = { lastNumber = it.filter { c -> c.isDigit() } },
                    label = { Text("Last Receipt Number") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Next receipt will be: ${receiptPrefix}-${((lastNumber.toIntOrNull() ?: 0) + 1).toString().padStart(6, '0')}",
                    style = MaterialTheme.typography.bodySmall,
                    color = PosMuted
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = footerText, onValueChange = { footerText = it },
                    label = { Text("Receipt Footer Message") }, modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PosAccent, unfocusedBorderColor = MaterialTheme.colorScheme.outline)
                )

                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { onSave((businessSettings ?: BusinessSettings()).copy(receiptPrefix = receiptPrefix, lastReceiptNumber = lastNumber.toIntOrNull() ?: 0, footerMessage = footerText)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                ) {
                    Text("Save Receipt Settings", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

/** Shows the uploaded e-wallet QR so staff can confirm it before saving. */
@Composable
fun QrPreview(path: String?, label: String) {
    if (path == null) return
    val bitmap = remember(path) {
        runCatching { BitmapFactory.decodeFile(path) }.getOrNull()
    }
    Spacer(modifier = Modifier.height(8.dp))
    if (bitmap != null) {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = label,
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp),
            contentScale = ContentScale.Fit
        )
    } else {
        Text(
            "QR file missing — please upload again.",
            style = MaterialTheme.typography.bodySmall,
            color = PosDanger
        )
    }
}
