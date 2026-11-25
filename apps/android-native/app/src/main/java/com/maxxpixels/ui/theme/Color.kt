package com.maxxpixels.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * MaxxPixels Cinema Native Design System:
 * Deep cinema charcoal (#0A090E), warm burgundy/plum ambient glow (#3A1A26),
 * frosted glass pill surfaces, and golden amber primary CTAs (#FFC436 -> #FF9617).
 */
object MaxxColors {
    val CinemaBlack = Color(0xFF0A090E)
    val SurfaceDark = Color(0xFF15131B)
    val SurfaceElevated = Color(0xFF1F1C26)
    val SurfaceGlass = Color(0xCC221E28)
    val FrostedPill = Color(0x22FFFFFF)
    val FloatingDockBg = Color(0xE826232C)

    // Warm Golden Amber Primary (#FFB82E -> #FF9617)
    val Primary = Color(0xFFFFB52E)
    val PrimaryDark = Color(0xFFFF9617)
    val PrimaryLight = Color(0xFFFFCE5C)
    val PrimaryTint = Color(0x28FFB52E)
    val OnPrimaryDark = Color(0xFF14110D)

    // Warm Ambient Burgundy/Plum accents
    val AmbientPlum = Color(0xFF3E1C2A)
    val AmbientWarm = Color(0xFF331B1C)

    // Compatibility aliases
    val OrangeStart = Primary
    val OrangeEnd = PrimaryDark
    val OrangeSoft = PrimaryLight
    val OrangeTint = PrimaryTint

    val AhaGold = Color(0xFFFFC436)
    val AhaGoldDark = Color(0xFFFF9617)
    val VipGold = AhaGold

    val AccentCoral = Primary
    val AccentMagenta = PrimaryDark
    val AccentSoft = PrimaryLight
    val AccentTint = PrimaryTint
    val GemEmerald = Color(0xFF10B981)
    val CoinGold = Color(0xFFFBBF24)
    val BadgePurple = Color(0xFFA855F7)

    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFFB4B0BE)
    val TextMuted = Color(0xFF7C7787)

    val BorderSubtle = Color(0x1CFFFFFF)
    val BorderStrong = Color(0x30FFFFFF)

    val Success = Color(0xFF10B981)
    val Warning = Color(0xFFF59E0B)
    val Error = Color(0xFFEF4444)
    val ErrorSoft = Color(0xFFFCA5A5)

    val BrandGradient = Brush.horizontalGradient(
        colors = listOf(Color(0xFFFFC83D), Color(0xFFFF9617))
    )

    val AhaGoldGradient = Brush.horizontalGradient(
        colors = listOf(Color(0xFFFFC83D), Color(0xFFFF9617))
    )

    val BrandVerticalGradient = Brush.verticalGradient(
        colors = listOf(Color(0xFFFFC83D), Color(0xFFFF9617))
    )

    val AmbientScreenBackground = Brush.verticalGradient(
        colorStops = arrayOf(
            0.0f to Color(0xFF351924),
            0.28f to Color(0xFF1A1219),
            0.55f to Color(0xFF0E0C12),
            1.0f to CinemaBlack
        )
    )
}
