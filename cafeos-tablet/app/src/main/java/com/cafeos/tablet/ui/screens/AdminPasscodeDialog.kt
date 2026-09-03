package com.cafeos.tablet.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.PosAccent
import com.cafeos.tablet.ui.theme.PosDanger
import com.cafeos.tablet.ui.theme.PosInk
import kotlinx.coroutines.launch

@Composable
fun AdminPasscodeDialog(
    viewModel: CafeViewModel,
    onAuthorized: () -> Unit,
    onDismiss: () -> Unit
) {
    var passcode by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var checking by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Admin authorization", color = PosInk) },
        text = {
            Column {
                Text("Enter an admin passcode to cancel this order.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = passcode,
                    onValueChange = { if (it.length <= 6) passcode = it.filter(Char::isDigit) },
                    label = { Text("Admin passcode") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    isError = error != null
                )
                error?.let { Text(it, color = PosDanger, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Button(
                enabled = !checking,
                onClick = {
                    checking = true
                    scope.launch {
                        if (viewModel.authenticateAdminPasscode(passcode)) onAuthorized()
                        else { error = "Admin passcode required"; checking = false }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent),
                shape = RoundedCornerShape(10.dp)
            ) { Text("Authorize") }
        },
        dismissButton = { Button(onClick = onDismiss, colors = ButtonDefaults.outlinedButtonColors()) { Text("Cancel") } }
    )
}