package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.*

@Composable
fun AIConsultantScreen(viewModel: CafeViewModel) {
    val conversations by viewModel.allAIConversations.collectAsState(initial = emptyList())
    val currentConversationId by remember { mutableStateOf<Int?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(20.dp)
    ) {
        Text("AI Consultant", style = MaterialTheme.typography.headlineMedium, color = PosPaper)
        Text("Ask questions about orders, inventory, sales", style = MaterialTheme.typography.bodyMedium, color = PosMuted, modifier = Modifier.padding(top = 4.dp))

        Spacer(modifier = Modifier.height(16.dp))

        if (conversations.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Chat, contentDescription = null, tint = PosMuted, modifier = Modifier.size(48.dp))
                    Text("No conversations yet. Ask a question below!", style = MaterialTheme.typography.bodyLarge, color = PosMuted)
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                state = rememberLazyListState()
            ) {
                items(conversations, key = { it.id }) { conversation ->
                    ConversationCard(conversation = conversation, onClick = { })
                }
            }
        }
    }
}

@Composable
fun ConversationCard(conversation: com.cafeos.tablet.data.AIConversation, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = PosCoffeeLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(conversation.title, style = MaterialTheme.typography.titleMedium, color = PosPaper, fontWeight = FontWeight.SemiBold)
            Text(
                text = java.text.SimpleDateFormat("MMM dd, yyyy", java.util.Locale.getDefault())
                    .format(java.util.Date(conversation.updatedAt)),
                style = MaterialTheme.typography.bodySmall,
                color = PosMuted
            )
        }
    }
}

@Composable
fun ChatView(viewModel: CafeViewModel, conversationId: Int, messages: List<com.cafeos.tablet.data.AIMessage>) {
    var messageText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages, key = { it.id }) { message ->
                MessageBubble(message = message)
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = messageText,
                onValueChange = { messageText = it },
                placeholder = { Text("Ask about orders, inventory, sales...", color = PosMuted) },
                modifier = Modifier.weight(1f),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PosAccent,
                    unfocusedBorderColor = PosBorder,
                    focusedTextColor = PosPaper,
                    unfocusedTextColor = PosPaper
                ),
                maxLines = 4,
                shape = RoundedCornerShape(12.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Button(
                onClick = {
                    if (messageText.isNotBlank()) {
                        viewModel.addAIMessage(conversationId, "user", messageText)
                        // TODO: Call local server API for assistant response
                        viewModel.addAIMessage(conversationId, "assistant", "AI consultant feature is coming soon. Please configure the local server endpoint in Settings.")
                        messageText = ""
                    }
                },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                Icon(Icons.Default.Send, contentDescription = null, tint = PosPaper, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
fun MessageBubble(message: com.cafeos.tablet.data.AIMessage) {
    val isUser = message.role == "user"
    val bgColor = if (isUser) PosAccentSoft else PosCoffeeLight
    val textColor = if (isUser) PosAccent else PosPaper

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isUser) {
                Icon(Icons.Default.Chat, contentDescription = null, tint = PosGold, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(4.dp))
        }
        Card(
            shape = RoundedCornerShape(
                topStart = if (isUser) 16.dp else 4.dp,
                topEnd = if (isUser) 4.dp else 16.dp,
                bottomStart = 16.dp,
                bottomEnd = 16.dp
            ),
            colors = CardDefaults.cardColors(containerColor = bgColor)
        ) {
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium,
                color = textColor,
                modifier = Modifier.padding(12.dp, 8.dp)
            )
        }
        if (isUser) {
            Icon(Icons.Default.Person, contentDescription = null, tint = PosAccent, modifier = Modifier.size(18.dp))
        }
    }
}
