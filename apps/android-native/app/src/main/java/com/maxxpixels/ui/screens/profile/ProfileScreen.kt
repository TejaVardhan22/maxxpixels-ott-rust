package com.maxxpixels.ui.screens.profile

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.HelpOutline
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

/**
 * 1:1 Replication of React Native ProfileScreen (apps/mobile/src/screens/ProfileScreen/ProfileScreen.tsx):
 * - User Card (Avatar + Camera badge + Name + Gold/Gray Plan badge + Edit icon)
 * - SUBSCRIPTION & PURCHASES (Subscription, My Rentals, My Downloads)
 * - ACCOUNT & SETTINGS (Account, Storage & Data, App Settings)
 * - SUPPORT & LEGAL (Help & Support, Privacy & Legal, Share App)
 * - Sign Out button
 */
@Composable
fun ProfileScreen(
    repository: MaxxRepository,
    onOpenDetails: (Long) -> Unit,
    onOpenSubscription: () -> Unit,
    onOpenAccount: () -> Unit,
    onOpenRentals: () -> Unit,
    onOpenDownloads: () -> Unit,
    onOpenStorage: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenHelp: () -> Unit,
    onOpenLegal: () -> Unit,
    onSignedOut: () -> Unit
) {
    val context = LocalContext.current
    val session by repository.sessionManager.session.collectAsState()
    val brand by repository.sessionManager.brand.collectAsState()
    val scope = rememberCoroutineScope()

    val displayName = session?.fullName?.ifBlank { "MaxxPixels User" } ?: "MaxxPixels User"
    val isVip = session?.hasActiveSubscription == true
    val planName = session?.packageName?.ifBlank { if (isVip) "VIP Membership" else "Free Plan" }
        ?: if (isVip) "VIP Membership" else "Free Plan"

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // User Card
        item {
            Surface(
                color = MaxxColors.SurfaceDark,
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(contentAlignment = Alignment.BottomEnd) {
                        Box(
                            modifier = Modifier
                                .size(60.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.SurfaceElevated),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Rounded.Person, null, tint = Color.White, modifier = Modifier.size(30.dp))
                        }
                        Box(
                            modifier = Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.Primary)
                                .border(2.dp, MaxxColors.SurfaceDark, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Rounded.CameraAlt, null, tint = Color.White, modifier = Modifier.size(11.dp))
                        }
                    }

                    Spacer(Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = displayName,
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.ExtraBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(Modifier.height(6.dp))
                        Surface(
                            color = if (isVip) Color(0x26FBBF24) else MaxxColors.SurfaceElevated,
                            shape = RoundedCornerShape(99.dp),
                            border = BorderStroke(1.dp, if (isVip) Color(0xFFFBBF24) else MaxxColors.BorderSubtle)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Icon(
                                    Icons.Rounded.WorkspacePremium,
                                    null,
                                    tint = if (isVip) Color(0xFFFBBF24) else MaxxColors.TextSecondary,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    text = planName,
                                    color = if (isVip) Color(0xFFFBBF24) else MaxxColors.TextSecondary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    Icon(
                        imageVector = Icons.Rounded.Edit,
                        contentDescription = "Edit",
                        tint = MaxxColors.TextMuted,
                        modifier = Modifier
                            .size(20.dp)
                            .clickable(onClick = onOpenAccount)
                    )
                }
            }
        }

        // Section 1: SUBSCRIPTION & PURCHASES
        item {
            RnSectionLabel("SUBSCRIPTION & PURCHASES")
            Spacer(Modifier.height(8.dp))
            Surface(
                color = MaxxColors.SurfaceDark,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, MaxxColors.BorderSubtle)
            ) {
                Column {
                    RnMenuItem(
                        icon = Icons.Rounded.WorkspacePremium,
                        iconTint = if (isVip) Color(0xFFFBBF24) else MaxxColors.TextSecondary,
                        title = if (isVip) "Plan: $planName" else "Subscription",
                        subtitle = if (isVip) "Active Membership" else "Manage your active membership plan",
                        onClick = onOpenSubscription
                    )
                    HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                    RnMenuItem(
                        icon = Icons.Rounded.Movie,
                        iconTint = Color(0xFFA855F7),
                        title = "My Rentals",
                        subtitle = "View purchased pay-per-view movies",
                        onClick = onOpenRentals
                    )
                    HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                    RnMenuItem(
                        icon = Icons.Rounded.CloudDownload,
                        iconTint = Color(0xFF3B82F6),
                        title = "My Downloads",
                        subtitle = "Offline watched content",
                        onClick = onOpenDownloads
                    )
                }
            }
        }

        // Section 2: ACCOUNT & SETTINGS
        item {
            RnSectionLabel("ACCOUNT & SETTINGS")
            Spacer(Modifier.height(8.dp))
            Surface(
                color = MaxxColors.SurfaceDark,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, MaxxColors.BorderSubtle)
            ) {
                Column {
                    RnMenuItem(
                        icon = Icons.Rounded.Person,
                        iconTint = Color(0xFF60A5FA),
                        title = "Account",
                        subtitle = session?.phoneNumber?.ifBlank { session?.email } ?: "Update personal details",
                        onClick = onOpenAccount
                    )
                    HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                    RnMenuItem(
                        icon = Icons.Rounded.Storage,
                        iconTint = Color(0xFFF472B6),
                        title = "Storage & Data",
                        subtitle = "Manage cache and offline storage",
                        onClick = onOpenStorage
                    )
                    HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                    RnMenuItem(
                        icon = Icons.Rounded.Settings,
                        iconTint = MaxxColors.TextSecondary,
                        title = "App Settings",
                        subtitle = "Video quality, Wi-Fi only streaming",
                        onClick = onOpenSettings
                    )
                }
            }
        }

        // Section 3: SUPPORT & LEGAL
        item {
            RnSectionLabel("SUPPORT & LEGAL")
            Spacer(Modifier.height(8.dp))
            Surface(
                color = MaxxColors.SurfaceDark,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, MaxxColors.BorderSubtle)
            ) {
                Column {
                    RnMenuItem(
                        icon = Icons.AutoMirrored.Rounded.HelpOutline,
                        iconTint = Color(0xFF34D399),
                        title = "Help & Support",
                        subtitle = "FAQs and customer support",
                        onClick = onOpenHelp
                    )
                    HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                    RnMenuItem(
                        icon = Icons.Rounded.Description,
                        iconTint = MaxxColors.TextSecondary,
                        title = "Privacy & Legal",
                        subtitle = "Terms of use and privacy policy",
                        onClick = onOpenLegal
                    )
                    HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                    RnMenuItem(
                        icon = Icons.Rounded.Share,
                        iconTint = Color(0xFFF59E0B),
                        title = "Share App",
                        subtitle = "Invite friends to ${brand.shortName}",
                        onClick = {
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, "Stream movies, web series & play MAXX GAMES on ${brand.name}!")
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Share"))
                        }
                    )
                }
            }
        }

        // Sign Out Button
        item {
            Surface(
                color = Color(0x1FEF4444),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, Color(0x4DEF4444)),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        scope.launch {
                            repository.logout()
                            onSignedOut()
                        }
                    }
            ) {
                Row(
                    modifier = Modifier.padding(vertical = 14.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.AutoMirrored.Rounded.Logout, null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Sign Out", color = Color(0xFFEF4444), fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun RnSectionLabel(text: String) {
    Text(
        text = text,
        color = MaxxColors.TextMuted,
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 1.2.sp,
        modifier = Modifier.padding(start = 4.dp)
    )
}

@Composable
private fun RnMenuItem(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, color = MaxxColors.TextMuted, fontSize = 11.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, tint = MaxxColors.TextMuted, modifier = Modifier.size(18.dp))
    }
}
