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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.width(420.dp),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = PosSurface),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(PosCoffee)
                    .padding(horizontal = 24.dp, vertical = 18.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = PosGold,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        modifier = Modifier.padding(12.dp),
                        tint = PosCoffee
                    )
                }
                Spacer(modifier = Modifier.width(14.dp))
                Column {
                    Text(
                        text = "PEBOT",
                        style = MaterialTheme.typography.titleLarge,
                        color = PosPaper,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Staff Access",
                        style = MaterialTheme.typography.bodyMedium,
                        color = PosMuted
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Welcome back",
                    style = MaterialTheme.typography.headlineMedium,
                    color = PosInk,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Sign in with your 6-digit staff PIN",
                    style = MaterialTheme.typography.bodyMedium,
                    color = PosInkSoft
                )

                Spacer(modifier = Modifier.height(24.dp))

                OutlinedTextField(
                    value = pin,
                    onValueChange = { newPin ->
                        if (newPin.length <= 6) pin = newPin
                    },
                    label = { Text("Enter 6-digit PIN") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PosAccent,
                        unfocusedBorderColor = PosBorder,
                        focusedTextColor = PosInk,
                        unfocusedTextColor = PosInk,
                        cursorColor = PosAccent,
                        errorBorderColor = PosDanger
                    ),
                    isError = error != null
                )

                if (error != null) {
                    Spacer(modifier = Modifier.height(10.dp))
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
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !loggingIn,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
                ) {
                    if (loggingIn) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = PosPaper)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Signing in...", color = PosPaper, fontWeight = FontWeight.SemiBold)
                    } else {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = PosPaper, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Login", color = PosPaper, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
