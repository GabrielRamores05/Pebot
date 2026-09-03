package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Review
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.components.PremiumScreen
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewsScreen(viewModel: CafeViewModel) {
    val reviews by viewModel.allReviews.collectAsState(initial = emptyList())
    val products by viewModel.allProducts.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    val productNames = products.associate { it.id to it.name }
    var suggestionsOnly by remember { mutableStateOf(false) }
    var productFilterId by remember { mutableStateOf<Int?>(null) }

    val visible = reviews.filter { review ->
        (productFilterId == null || review.productId == productFilterId) &&
            (!suggestionsOnly || !review.tasteSuggestion.isNullOrBlank())
    }

    PremiumScreen {
        Text("Product Reviews", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
        Text("${reviews.size} total reviews", style = MaterialTheme.typography.bodyMedium, color = PosMuted, modifier = Modifier.padding(top = 4.dp))

        Spacer(modifier = Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !suggestionsOnly, onClick = { suggestionsOnly = false }, label = { Text("Reviews") }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
            FilterChip(selected = suggestionsOnly, onClick = { suggestionsOnly = true }, label = { Text("Taste Suggestions") }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
        }
        val productOptions = reviews.map { it.productId }.distinct().sorted()
        if (productOptions.isNotEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                FilterChip(selected = productFilterId == null, onClick = { productFilterId = null }, label = { Text("All products") }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                productOptions.forEach { productId ->
                    FilterChip(selected = productFilterId == productId, onClick = { productFilterId = productId }, label = { Text(productNames[productId] ?: "Product #$productId") }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = PosAccentSoft, selectedLabelColor = PosAccent))
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (visible.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(if (suggestionsOnly) "No taste suggestions yet" else "No reviews match your filters", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(visible, key = { it.id }) { review ->
                    ReviewCard(
                        review = review,
                        showSuggestion = suggestionsOnly,
                        productName = productNames[review.productId],
                        onDelete = { scope.launch { viewModel.deleteReview(review) } }
                    )
                }
            }
        }
    }
}

@Composable
fun ReviewCard(review: Review, showSuggestion: Boolean = false, productName: String? = null, onDelete: () -> Unit) {
    val dateFormat = java.text.SimpleDateFormat("MMM dd, yyyy", java.util.Locale.getDefault())

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
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    repeat(5) { index ->
                        val iconTint = if (index < review.rating) Color(0xFFFFD700) else PosMuted
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = iconTint,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
                Text(
                    text = dateFormat.format(java.util.Date(review.createdAt)),
                    style = MaterialTheme.typography.bodySmall,
                    color = PosMuted
                )
            }

            productName?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = PosAccent,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }

            if (showSuggestion) {
                review.tasteSuggestion?.let { suggestion ->
                    Text(
                        text = suggestion,
                        style = MaterialTheme.typography.bodyMedium,
                        color = PosPaper,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            } else {
                review.comment?.let { comment ->
                    Text(
                        text = comment,
                        style = MaterialTheme.typography.bodyMedium,
                        color = PosPaper,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = null, tint = PosDanger, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Delete", color = PosDanger, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
