package com.cafeos.tablet.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.ui.theme.PosCoffee
import com.cafeos.tablet.ui.theme.PosInk
import com.cafeos.tablet.ui.theme.PosInkSoft
import com.cafeos.tablet.ui.theme.PosInfo
import com.cafeos.tablet.ui.theme.PosMuted
import com.cafeos.tablet.ui.theme.PosSurface

@Composable
fun PremiumScreen(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(horizontal = 18.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        content = content
    )
}

@Composable
fun PremiumHeader(
    title: String,
    subtitle: String? = null,
    action: (@Composable () -> Unit)? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(title, style = MaterialTheme.typography.headlineSmall, color = PosInk, fontWeight = FontWeight.Bold)
            subtitle?.let { Text(it, color = PosMuted, style = MaterialTheme.typography.labelMedium) }
        }
        action?.invoke()
    }
}

@Composable
fun PremiumPanel(
    modifier: Modifier = Modifier,
    title: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            title?.let {
                Text(it, color = PosInk, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))
            }
            content()
        }
    }
}

@Composable
fun StatusDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(Icons.Default.Circle, contentDescription = null, tint = color, modifier = Modifier.size(8.dp))
        Text(label, color = PosMuted, style = MaterialTheme.typography.labelMedium)
    }
}

fun statusColor(status: String): Color = when (status.uppercase()) {
    "COMPLETED", "AVAILABLE", "ACTIVE", "APPROVED" -> Color(0xFF3E7D4A)
    "PENDING" -> Color(0xFFB58A4A)
    "PREPARING", "RESERVED" -> PosInfo
    "CANCELLED", "CLOSED", "REJECTED", "LOW" -> Color(0xFFB3261E)
    else -> PosInkSoft
}
