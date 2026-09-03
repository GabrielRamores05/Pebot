package com.cafeos.tablet.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = PosAccent,
    onPrimary = Color.White,
    primaryContainer = PosAccentSoft,
    onPrimaryContainer = PosAccentHover,
    secondary = PosGold,
    onSecondary = PosCoffee,
    tertiary = PosCream,
    background = PosCoffee,
    onBackground = PosInk,
    surface = PosCoffeeLight,
    onSurface = PosInk,
    surfaceVariant = PosCoffeeLight,
    onSurfaceVariant = PosInkSoft,
    error = PosDanger,
    onError = Color.White,
    errorContainer = PosDangerSoft,
    onErrorContainer = PosDanger,
    outline = PosBorder,
    outlineVariant = PosMuted
)

private val LightColorScheme = lightColorScheme(
    primary = PosAccent,
    onPrimary = Color.White,
    primaryContainer = PosAccentSoft,
    onPrimaryContainer = PosAccentHover,
    secondary = PosGold,
    onSecondary = PosCoffee,
    tertiary = PosCream,
    background = PosCoffee,
    onBackground = PosInk,
    surface = PosSurface,
    onSurface = PosInk,
    surfaceVariant = PosMuted,
    onSurfaceVariant = PosInkSoft,
    error = PosDanger,
    onError = Color.White,
    errorContainer = PosDangerSoft,
    onErrorContainer = PosDanger,
    outline = PosBorder,
    outlineVariant = PosMuted
)

@Composable
fun PebotTheme(
    darkTheme: Boolean = false,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            window.navigationBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
