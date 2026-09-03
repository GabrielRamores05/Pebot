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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.cafeos.tablet.data.Staff
import com.cafeos.tablet.ui.CafeViewModel
import com.cafeos.tablet.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(viewModel: CafeViewModel, onLoginSuccess: (Staff) -> Unit) {
    var checking by remember { mutableStateOf(true) }
    var needsSetup by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        needsSetup = !viewModel.hasAnyStaff()
        checking = false
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PosCoffee)
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        when {
            checking -> CircularProgressIndicator(color = PosAccent)
            needsSetup -> SetupAdminCard(
                onCreated = { staff -> onLoginSuccess(staff) },
                viewModel = viewModel
            )
            else -> LoginCard(
                onLoginSuccess = onLoginSuccess,
                viewModel = viewModel
            )
        }
    }
}

@Composable
private fun LoginCard(
    onLoginSuccess: (Staff) -> Unit,
    viewModel: CafeViewModel
) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loggingIn by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val scope = rememberCoroutineScope()

    Card(
        modifier = Modifier.width(420.dp),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = PosSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
    ) {
        AuthHeader()
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
                onValueChange = { newPin -> if (newPin.length <= 6) pin = newPin },
                label = { Text("Enter 6-digit PIN") },
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = authFieldColors(),
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

/**
 * First-run setup: no staff account exists, so the first person on the tablet
 * creates the administrator with a fresh PIN. This replaces the old hard-coded
 * "123456" master-PIN backdoor.
 */
@Composable
private fun SetupAdminCard(
    onCreated: (Staff) -> Unit,
    viewModel: CafeViewModel
) {
    var name by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var confirmPin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var creating by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Card(
        modifier = Modifier.width(420.dp),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = PosSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
    ) {
        AuthHeader()
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Welcome — first run",
                style = MaterialTheme.typography.headlineMedium,
                color = PosInk,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "No staff account exists yet. Create the café's administrator:",
                style = MaterialTheme.typography.bodyMedium,
                color = PosInkSoft
            )

            Spacer(modifier = Modifier.height(20.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { if (it.length <= 40) name = it },
                label = { Text("Administrator name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = authFieldColors(),
                isError = error != null
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = pin,
                onValueChange = { newPin -> if (newPin.length <= 6) pin = newPin },
                label = { Text("Choose a 6-digit PIN") },
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = authFieldColors(),
                isError = error != null
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = confirmPin,
                onValueChange = { newPin -> if (newPin.length <= 6) confirmPin = newPin },
                label = { Text("Confirm 6-digit PIN") },
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = authFieldColors(),
                isError = error != null
            )

            if (error != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(error!!, style = MaterialTheme.typography.bodySmall, color = PosDanger)
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    val trimmedName = name.trim()
                    val problem = when {
                        trimmedName.isEmpty() -> "Please enter the administrator name"
                        pin.length != 6 || pin.any { !it.isDigit() } -> "PIN must be exactly 6 digits"
                        pin != confirmPin -> "PINs do not match"
                        else -> null
                    }
                    if (problem != null) {
                        error = problem
                        return@Button
                    }
                    error = null
                    creating = true
                    scope.launch {
                        viewModel.saveStaff(
                            Staff(name = trimmedName, role = "ADMIN", active = true, pin = pin)
                        )
                        val created = viewModel.authenticateStaff(pin)
                        if (created != null) {
                            delay(300)
                            onCreated(created)
                        } else {
                            error = "Could not create the administrator account. Please try again."
                            creating = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !creating,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosAccent)
            ) {
                if (creating) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = PosPaper)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Creating...", color = PosPaper, fontWeight = FontWeight.SemiBold)
                } else {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = PosPaper, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Create & sign in", color = PosPaper, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun AuthHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(PosCoffee)
            .padding(horizontal = 24.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(color = PosGold, shape = RoundedCornerShape(12.dp)) {
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
}

@Composable
private fun authFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = PosAccent,
    unfocusedBorderColor = PosBorder,
    focusedTextColor = PosInk,
    unfocusedTextColor = PosInk,
    cursorColor = PosAccent,
    errorBorderColor = PosDanger
)
