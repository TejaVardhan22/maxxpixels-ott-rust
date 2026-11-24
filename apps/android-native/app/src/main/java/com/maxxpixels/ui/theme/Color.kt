package com.maxxpixels.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * 1:1 Replication of React Native AppTheme (apps/mobile/src/core/theme.ts):
 * background: #08090C, surface/card: #11141E, surfaceElevated: #181B26,
 * primary: #E50914, primaryDark: #B80710, textSecondary: #94A3B8, textMuted: #64748B, gold: #F59E0B
 */
object MaxxColors {
    val CinemaBlack = Color(0xFF08090C)
    val SurfaceDark = Color(0xFF11141E)
    val SurfaceElevated = Color(0xFF181B26)
    val SurfaceGlass = Color(0xE611141E)
    val FloatingDockBg = Color(0xFF11141E)

    // Primary Netflix/RN Red (#E50914)
    val Primary = Color(0xFFE50914)
    val PrimaryDark = Color(0xFFB80710)
    val PrimaryLight = Color(0xFFFF3B44)
    val PrimaryTint = Color(0x26E50914)

    // Compatibility aliases mapped to RN AppTheme
    val OrangeStart = Primary
    val OrangeEnd = PrimaryDark
    val OrangeSoft = PrimaryLight
    val OrangeTint = PrimaryTint

    val AhaGold = Color(0xFFF59E0B)
    val AhaGoldDark = Color(0xFFD97706)
    val VipGold = AhaGold

    val AccentCoral = Primary
    val AccentMagenta = PrimaryDark
    val AccentSoft = PrimaryLight
    val AccentTint = PrimaryTint
    val GemEmerald = Color(0xFF10B981)
    val CoinGold = AhaGold
    val BadgePurple = Color(0xFFA855F7)

    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFF94A3B8)
    val TextMuted = Color(0xFF64748B)

    val BorderSubtle = Color(0x14FFFFFF)
    val BorderStrong = Color(0x24FFFFFF)

    val Success = Color(0xFF10B981)
    val Warning = Color(0xFFF59E0B)
    val Error = Color(0xFFEF4444)
    val ErrorSoft = Color(0xFFFCA5A5)

    val BrandGradient = Brush.horizontalGradient(
        colors = listOf(Primary, PrimaryDark)
    )

    val AhaGoldGradient = Brush.horizontalGradient(
        colors = listOf(Color(0xFFF59E0B), Color(0xFFD97706))
    )

    val BrandVerticalGradient = Brush.verticalGradient(
        colors = listOf(Primary, PrimaryDark)
    )

    val AmbientScreenBackground = Brush.verticalGradient(
        colors = listOf(CinemaBlack, CinemaBlack)
    )
}
