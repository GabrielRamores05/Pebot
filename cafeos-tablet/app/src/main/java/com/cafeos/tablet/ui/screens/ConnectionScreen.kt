package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.Image
import android.graphics.Bitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumHeader
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.PosAccent
import com.cafeos.tablet.ui.theme.PosCoffee
import com.cafeos.tablet.ui.theme.PosInk
import com.cafeos.tablet.ui.theme.PosInkSoft
import com.cafeos.tablet.ui.theme.PosPaper
import com.cafeos.tablet.ui.theme.PosMuted

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectionScreen(viewModel: CafeViewModel) {
    val connected by viewModel.isConnectedToSync.collectAsState(initial = false)
    val hostAddress by viewModel.webHostAddress.collectAsState(initial = null)
    val discoveredHosts by viewModel.discoveredSyncHosts.collectAsState(initial = emptyList())

    var selectedMode by remember { mutableStateOf(viewModel.savedSyncMode) }
    var selectedRole by remember { mutableStateOf("pos") }
    var serverUrl by remember { mutableStateOf(viewModel.savedSyncUrl) }
    var statusText by remember { mutableStateOf("Disconnected") }

    val instructions = listOf(
        "1. Turn on the main tablet's hotspot, or connect both devices to the same Wi-Fi.",
        "2. On the main tablet, choose Host POS and tap Start Host.",
        "3. On the phone, choose Connect to POS and enter the address shown on the tablet.",
        "4. Tap Connect and wait until the status shows Connected.",
        "5. Orders and kitchen updates will sync live after connection."
    )

    LaunchedEffect(connected) {
        statusText = if (connected) "Connected" else "Disconnected"
    }

    DisposableEffect(selectedMode) {
        if (selectedMode == "client") viewModel.startSyncDiscovery() else viewModel.stopSyncDiscovery()
        onDispose { viewModel.stopSyncDiscovery() }
    }

    PremiumScreen(modifier = Modifier.verticalScroll(rememberScrollState())) {
        PremiumHeader("Device Connection", "Connect the POS, kitchen, and service stations")

        Spacer(modifier = Modifier.height(20.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Connection Setup", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(16.dp))

                Text("Mode")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = selectedMode == "host",
                        onClick = { selectedMode = "host" },
                        label = { Text("Host POS") }
                    )
                    FilterChip(
                        selected = selectedMode == "client",
                        onClick = { selectedMode = "client" },
                        label = { Text("Connect to POS") }
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text("Role")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = selectedRole == "pos",
                        onClick = { selectedRole = "pos" },
                        label = { Text("Main POS") }
                    )
                    FilterChip(
                        selected = selectedRole == "kitchen",
                        onClick = { selectedRole = "kitchen" },
                        label = { Text("Kitchen") }
                    )
                    FilterChip(
                        selected = selectedRole == "barista",
                        onClick = { selectedRole = "barista" },
                        label = { Text("Barista") }
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (selectedMode == "client") {
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it },
                        label = { Text("POS tablet address") },
                        placeholder = { Text("http://192.168.43.1:3001") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    discoveredHosts.forEach { address ->
                        TextButton(onClick = { serverUrl = address }) {
                            Icon(Icons.Default.Wifi, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text(address)
                        }
                    }
                } else {
                    Text("The tablet will host browser pages and local orders on port 3000.", color = PosMuted)
                }

                Spacer(modifier = Modifier.height(18.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(
                        onClick = {
                            if (selectedMode == "host") viewModel.startSyncHost()
                            else viewModel.initializeSync(serverUrl)
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                    ) {
                        Icon(Icons.Default.Wifi, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (selectedMode == "host") "Start Host" else "Connect")
                    }

                    OutlinedButton(
                        onClick = { viewModel.disconnectSync() },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Disconnect")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Surface(
                    color = if (connected) PosAccent.copy(alpha = 0.12f) else PosMuted.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (connected) Icons.Default.CheckCircle else Icons.Default.Info,
                            contentDescription = null,
                            tint = if (connected) PosAccent else MaterialTheme.colorScheme.primary
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(statusText, fontWeight = FontWeight.SemiBold)
                    }
                }
                hostAddress?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Customer menu", style = MaterialTheme.typography.labelLarge, color = PosInk, fontWeight = FontWeight.Bold)
                    Text("$it/menu", color = PosAccent, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Scan to open the menu", style = MaterialTheme.typography.labelMedium, color = PosInkSoft)
                    LocalUrlQrCode(url = "$it/menu")
                    Text("Kitchen: $it/kitchen", color = PosAccent, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("How to connect another tablet", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(12.dp))

                instructions.forEach { line ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text("• ", fontWeight = FontWeight.Bold)
                        Text(line)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    "The main tablet is the host. Start Host there, turn on its hotspot, connect the phone to that hotspot, then enter the displayed address on the phone.",
                    color = PosMuted
                )
            }
        }
    }
}

@Composable
private fun LocalUrlQrCode(url: String) {
    val bitmap = remember(url) {
        try {
            val matrix = MultiFormatWriter().encode(url, BarcodeFormat.QR_CODE, 520, 520)
            Bitmap.createBitmap(520, 520, Bitmap.Config.RGB_565).also { image ->
                for (x in 0 until 520) for (y in 0 until 520) {
                    image.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
                }
            }
        } catch (_: Exception) {
            null
        }
    }
    bitmap?.let {
        Surface(color = Color.White, shape = RoundedCornerShape(16.dp)) {
            Image(
                bitmap = it.asImageBitmap(),
                contentDescription = "QR code for $url",
                modifier = Modifier.padding(12.dp).size(180.dp)
            )
        }
    }
}
