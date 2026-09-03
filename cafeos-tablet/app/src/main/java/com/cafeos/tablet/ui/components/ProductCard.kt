package com.cafeos.tablet.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Product
import com.cafeos.tablet.ui.theme.PosAccent
import com.cafeos.tablet.ui.theme.PosBorder
import com.cafeos.tablet.ui.theme.PosInk
import com.cafeos.tablet.ui.theme.PosInkSoft
import java.text.NumberFormat

@Composable
fun ProductCard(product: Product, formatter: NumberFormat, onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.97f else 1f, label = "productPress")
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick),
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, PosBorder)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(product.name, style = MaterialTheme.typography.titleLarge, color = PosInk)
            Spacer(modifier = Modifier.height(4.dp))
            Text(formatter.format(product.price), style = MaterialTheme.typography.bodyLarge, color = PosAccent, fontWeight = FontWeight.Bold)
            
            if (!product.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(product.description, style = MaterialTheme.typography.bodySmall, color = PosInkSoft, maxLines = 2)
            }
        }
    }
}
