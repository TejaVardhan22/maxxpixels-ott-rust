package com.maxxpixels.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val MaxxDarkColorScheme = darkColorScheme(
    primary = MaxxColors.OrangeStart,
    onPrimary = MaxxColors.TextPrimary,
    primaryContainer = MaxxColors.OrangeTint,
    onPrimaryContainer = MaxxColors.OrangeSoft,
    secondary = MaxxColors.OrangeEnd,
    onSecondary = MaxxColors.TextPrimary,
    background = MaxxColors.CinemaBlack,
    onBackground = MaxxColors.TextPrimary,
    surface = MaxxColors.SurfaceDark,
    onSurface = MaxxColors.TextPrimary,
    surfaceVariant = MaxxColors.SurfaceElevated,
    onSurfaceVariant = MaxxColors.TextSecondary,
    outline = MaxxColors.BorderSubtle,
    error = MaxxColors.Error,
    onError = MaxxColors.TextPrimary,
)

private val MaxxTypography = Typography(
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Black,
        fontSize = 30.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.5).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 24.sp,
        lineHeight = 28.sp,
        letterSpacing = (-0.3).sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 19.sp,
        lineHeight = 24.sp,
        letterSpacing = (-0.2).sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 15.sp,
        lineHeight = 20.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.5.sp,
        lineHeight = 20.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 13.sp,
        lineHeight = 18.sp
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 10.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.6.sp
    )
)

@Composable
fun MaxxPixelsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MaxxDarkColorScheme,
        typography = MaxxTypography,
        content = content
    )
}
