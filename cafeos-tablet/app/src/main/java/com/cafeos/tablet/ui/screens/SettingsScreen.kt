package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.ui.CafeViewModel

@Composable
fun SettingsScreen(viewModel: CafeViewModel) {
    val context = LocalContext.current
    
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("System Settings", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(24.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Data Management", style = MaterialTheme.typography.titleLarge)
                Spacer(modifier = Modifier.height(16.dp))
                
                Button(
                    onClick = { viewModel.seedData() },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Seed Initial Data (Demo)")
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                OutlinedButton(
                    onClick = { /* Export logic: CafeDatabase.getDatabase(context).export(context) */ },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Export Database (Migration)")
                }
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text("About CafeOS Tablet", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
        Text("Version 1.0.0 (Premium Native)", style = MaterialTheme.typography.bodySmall)
    }
}
