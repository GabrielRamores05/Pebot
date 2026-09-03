package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun AuditLogScreen(viewModel: CafeViewModel) {
    val auditEvents by viewModel.recentAuditEvents.collectAsState(initial = emptyList())
    val dateFormatter = SimpleDateFormat("MMM dd, yyyy hh:mm:ss a", Locale.getDefault())

    PremiumScreen {
        Text("Audit Logs", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
        Text("Append-only event history", style = MaterialTheme.typography.bodyMedium, color = PosMuted, modifier = Modifier.padding(top = 4.dp))

        Spacer(modifier = Modifier.height(16.dp))

        if (auditEvents.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Info, contentDescription = null, tint = PosMuted, modifier = Modifier.size(48.dp))
                    Text("No audit events recorded", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
                }
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(auditEvents, key = { it.id }) { event ->
                    AuditEventCard(event = event, dateFormatter = dateFormatter)
                }
            }
        }
    }
}

@Composable
fun AuditEventCard(event: com.cafeos.tablet.data.AuditEvent, dateFormatter: SimpleDateFormat) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = event.eventType.uppercase(),
                    style = MaterialTheme.typography.titleSmall,
                    color = PosGold,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = dateFormatter.format(Date(event.createdAt)),
                    style = MaterialTheme.typography.bodySmall,
                    color = PosMuted
                )
            }
            Text(
                text = "${event.entityType} #${event.entityId}",
                style = MaterialTheme.typography.bodyMedium,
                color = PosPaper,
                fontWeight = FontWeight.Medium
            )
            event.details?.let { details ->
                Text(
                    text = details,
                    style = MaterialTheme.typography.bodySmall,
                    color = PosInkSoft,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            event.staffId?.let { staffId ->
                Text(
                    text = "Staff: #$staffId",
                    style = MaterialTheme.typography.bodySmall,
                    color = PosMuted,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}
