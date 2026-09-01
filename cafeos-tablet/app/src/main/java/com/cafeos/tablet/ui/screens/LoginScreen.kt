package com.cafeos.tablet.ui.screens

import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Staff
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(viewModel: CafeViewModel, onLoginSuccess: (Staff) -> Unit) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loggingIn by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Pebot Staff Login", style = MaterialTheme.typography.headlineMedium, color = PosPaper, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(48.dp))

        OutlinedTextField(
            value = pin,
            onValueChange = { newPin ->
                if (newPin.length <= 6) pin = newPin
            },
            label = { Text("Enter 6-digit PIN") },
            modifier = Modifier.width(280.dp),
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = PosGold,
                unfocusedBorderColor = PosBorder,
                focusedTextColor = PosPaper,
                cursorColor = PosGold
            ),
            isError = error != null
        )

        if (error != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(error!!, style = MaterialTheme.typography.bodySmall, color = PosDanger)
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                focusManager.clearFocus()
                if (pin.isBlank()) {
                    error = "Please enter your PIN"
                    return@Button
                }
                loggingIn = true
                scope.launch {
                    val staff = viewModel.authenticateStaff(pin)
                    if (staff != null && staff.active) {
                        delay(300)
                        onLoginSuccess(staff)
                    } else {
                        error = "Invalid PIN or inactive staff"
                        loggingIn = false
                    }
                }
            },
            modifier = Modifier.width(280.dp),
            enabled = !loggingIn,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = PosGold)
        ) {
            if (loggingIn) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = PosCoffee)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Signing in...", color = PosCoffee, fontWeight = FontWeight.SemiBold)
            } else {
                Icon(Icons.Default.Lock, contentDescription = null, tint = PosCoffee, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Login", color = PosCoffee, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
