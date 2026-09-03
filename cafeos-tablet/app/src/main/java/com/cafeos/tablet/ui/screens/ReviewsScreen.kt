package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
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

@Composable
fun ReviewsScreen(viewModel: CafeViewModel) {
    val reviews by viewModel.allReviews.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    PremiumScreen {
        Text("Product Reviews", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
        Text("${reviews.size} total reviews", style = MaterialTheme.typography.bodyMedium, color = PosMuted, modifier = Modifier.padding(top = 4.dp))

        Spacer(modifier = Modifier.height(16.dp))

        if (reviews.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("No reviews yet", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(reviews, key = { it.id }) { review ->
                    ReviewCard(
                        review = review,
                        onDelete = {
                            scope.launch {
                                viewModel.deleteReview(review)
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ReviewCard(review: Review, onDelete: () -> Unit) {
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

            review.comment?.let { comment ->
                Text(
                    text = comment,
                    style = MaterialTheme.typography.bodyMedium,
                    color = PosPaper,
                    modifier = Modifier.padding(top = 8.dp)
                )
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
