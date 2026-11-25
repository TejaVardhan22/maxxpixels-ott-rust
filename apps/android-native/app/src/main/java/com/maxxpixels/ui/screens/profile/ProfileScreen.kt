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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.HelpOutline
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.Bookmark
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.screens.home.PortraitPosterCard
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

/**
 * Modern Frosted-Glass Cinema ProfileScreen:
 * - Warm ambient plum/charcoal gradient backdrop
 * - Hero Profile frosted card with golden avatar ring, VIP badge / Upgrade pill & Edit shortcut
 * - Live My Watchlist horizontal rail (when user has bookmarked titles)
 * - Grouped frosted glass menu cards (Subscription & Purchases, Account & Settings, Support & Legal)
 * - Pill Sign Out CTA with bottom clearance for Floating Pill Bottom Nav
 */
@Composable
fun ProfileScreen(
    repository: MaxxRepository,
    onOpenDetails: (Long) -> Unit,
    onOpenSubscription: () -> Unit,
    onOpenAccount: () -> Unit,
    onOpenWatchlist: () -> Unit = {},
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

    var watchlist by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }

    LaunchedEffect(session?.id) {
        if (session?.isLoggedIn == true) {
            watchlist = repository.getWatchlist()
        }
    }

    val displayName = session?.fullName?.ifBlank { "MaxxPixels User" } ?: "MaxxPixels User"
    val contactLabel = session?.phoneNumber?.ifBlank { session?.email }.orEmpty()
    val isVip = session?.hasActiveSubscription == true
    val planName = session?.packageName?.ifBlank { if (isVip) "VIP Membership" else "Free Plan" }
        ?: if (isVip) "VIP Membership" else "Free Plan"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding(),
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 114.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Top Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "My Space",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Black
                    )
                    Surface(
                        color = Color.White.copy(alpha = 0.09f),
                        shape = CircleShape,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                        modifier = Modifier
                            .size(40.dp)
                            .clickable(onClick = onOpenAccount)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Rounded.Edit,
                                contentDescription = "Edit Profile",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }

            // Hero User Frosted Card
            item {
                Surface(
                    color = Color.White.copy(alpha = 0.07f),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(66.dp)
                                    .clip(CircleShape)
                                    .border(2.dp, MaxxColors.Primary, CircleShape)
                                    .background(MaxxColors.SurfaceElevated)
                                    .clickable(onClick = onOpenAccount),
                                contentAlignment = Alignment.Center
                            ) {
                                if (!session?.avatarUrl.isNullOrBlank()) {
                                    AsyncImage(
                                        model = session?.avatarUrl,
                                        contentDescription = displayName,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                } else {
                                    Icon(
                                        Icons.Rounded.Person,
                                        contentDescription = null,
                                        tint = MaxxColors.Primary,
                                        modifier = Modifier.size(32.dp)
                                    )
                                }
                            }

                            Spacer(Modifier.width(14.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = displayName,
                                    color = Color.White,
                                    fontSize = 19.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                if (contactLabel.isNotBlank()) {
                                    Spacer(Modifier.height(2.dp))
                                    Text(
                                        text = contactLabel,
                                        color = MaxxColors.TextSecondary,
                                        fontSize = 12.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                Spacer(Modifier.height(8.dp))
                                Surface(
                                    color = if (isVip) MaxxColors.PrimaryTint else Color.White.copy(alpha = 0.08f),
                                    shape = RoundedCornerShape(999.dp),
                                    border = BorderStroke(
                                        1.dp,
                                        if (isVip) MaxxColors.Primary else Color.White.copy(alpha = 0.16f)
                                    )
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    ) {
                                        Icon(
                                            Icons.Rounded.WorkspacePremium,
                                            contentDescription = null,
                                            tint = if (isVip) MaxxColors.Primary else MaxxColors.TextSecondary,
                                            modifier = Modifier.size(13.dp)
                                        )
                                        Spacer(Modifier.width(5.dp))
                                        Text(
                                            text = planName,
                                            color = if (isVip) MaxxColors.Primary else MaxxColors.TextSecondary,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }

                        if (!isVip) {
                            Spacer(Modifier.height(16.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(MaxxColors.BrandGradient)
                                    .bounceClick(onClick = onOpenSubscription),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Upgrade to VIP",
                                    color = MaxxColors.OnPrimaryDark,
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }
                        }
                    }
                }
            }

            // Live My Watchlist Rail (shown when user has saved items)
            if (watchlist.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "My Watchlist",
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "See All",
                                color = MaxxColors.Primary,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.clickable(onClick = onOpenWatchlist)
                            )
                        }
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            items(watchlist, key = { "wl_${it.id}" }) { item ->
                                PortraitPosterCard(
                                    item = item,
                                    onClick = { onOpenDetails(item.id) }
                                )
                            }
                        }
                    }
                }
            }

            // Section 1: SUBSCRIPTION & PURCHASES
            item {
                ProfileSectionLabel("SUBSCRIPTION & PURCHASES")
                Spacer(Modifier.height(8.dp))
                FrostedMenuCard {
                    ProfileMenuItem(
                        icon = Icons.Rounded.WorkspacePremium,
                        iconTint = MaxxColors.Primary,
                        title = if (isVip) "Plan: $planName" else "Subscription",
                        subtitle = if (isVip) "Active Membership" else "Manage your active membership plan",
                        onClick = onOpenSubscription
                    )
                    MenuDivider()
                    ProfileMenuItem(
                        icon = Icons.Rounded.Bookmark,
                        iconTint = Color(0xFFFB7185),
                        title = "My Watchlist & Favorites",
                        subtitle = if (watchlist.isNotEmpty()) "${watchlist.size} saved title${if (watchlist.size > 1) "s" else ""}" else "View your saved movies & shows",
                        onClick = onOpenWatchlist
                    )
                    MenuDivider()
                    ProfileMenuItem(
                        icon = Icons.Rounded.Movie,
                        iconTint = Color(0xFFC084FC),
                        title = "My Rentals",
                        subtitle = "View purchased pay-per-view movies",
                        onClick = onOpenRentals
                    )
                    MenuDivider()
                    ProfileMenuItem(
                        icon = Icons.Rounded.CloudDownload,
                        iconTint = Color(0xFF60A5FA),
                        title = "My Downloads",
                        subtitle = "Offline watched content",
                        onClick = onOpenDownloads
                    )
                }
            }

            // Section 2: ACCOUNT & SETTINGS
            item {
                ProfileSectionLabel("ACCOUNT & SETTINGS")
                Spacer(Modifier.height(8.dp))
                FrostedMenuCard {
                    ProfileMenuItem(
                        icon = Icons.Rounded.Person,
                        iconTint = Color(0xFF38BDF8),
                        title = "Account Details",
                        subtitle = contactLabel.ifBlank { "Update personal details" },
                        onClick = onOpenAccount
                    )
                    MenuDivider()
                    ProfileMenuItem(
                        icon = Icons.Rounded.Storage,
                        iconTint = Color(0xFFF472B6),
                        title = "Storage & Data",
                        subtitle = "Manage cache and offline storage",
                        onClick = onOpenStorage
                    )
                    MenuDivider()
                    ProfileMenuItem(
                        icon = Icons.Rounded.Settings,
                        iconTint = Color(0xFFCBD5E1),
                        title = "App Settings",
                        subtitle = "Video quality, Wi-Fi only streaming",
                        onClick = onOpenSettings
                    )
                }
            }

            // Section 3: SUPPORT & LEGAL
            item {
                ProfileSectionLabel("SUPPORT & LEGAL")
                Spacer(Modifier.height(8.dp))
                FrostedMenuCard {
                    ProfileMenuItem(
                        icon = Icons.AutoMirrored.Rounded.HelpOutline,
                        iconTint = Color(0xFF34D399),
                        title = "Help & Support",
                        subtitle = "FAQs and customer support",
                        onClick = onOpenHelp
                    )
                    MenuDivider()
                    ProfileMenuItem(
                        icon = Icons.Rounded.Description,
                        iconTint = Color(0xFFCBD5E1),
                        title = "Privacy & Legal",
                        subtitle = "Terms of use and privacy policy",
                        onClick = onOpenLegal
                    )
                    MenuDivider()
                    ProfileMenuItem(
                        icon = Icons.Rounded.Share,
                        iconTint = MaxxColors.Primary,
                        title = "Share App",
                        subtitle = "Invite friends to ${brand.shortName}",
                        onClick = {
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    "Stream movies, web series & play MAXX GAMES on ${brand.name}!"
                                )
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Share"))
                        }
                    )
                }
            }

            // Pill Sign Out Button
            item {
                Surface(
                    color = Color(0x22EF4444),
                    shape = RoundedCornerShape(999.dp),
                    border = BorderStroke(1.dp, Color(0x55EF4444)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .clickable {
                            scope.launch {
                                repository.logout()
                                onSignedOut()
                            }
                        }
                ) {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.AutoMirrored.Rounded.Logout,
                            contentDescription = null,
                            tint = Color(0xFFF87171),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Sign Out",
                            color = Color(0xFFF87171),
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileSectionLabel(text: String) {
    Text(
        text = text,
        color = MaxxColors.TextMuted,
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 1.2.sp,
        modifier = Modifier.padding(start = 6.dp)
    )
}

@Composable
private fun FrostedMenuCard(content: @Composable () -> Unit) {
    Surface(
        color = Color.White.copy(alpha = 0.06f),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column { content() }
    }
}

@Composable
private fun MenuDivider() {
    HorizontalDivider(
        thickness = 0.5.dp,
        color = Color.White.copy(alpha = 0.08f),
        modifier = Modifier.padding(horizontal = 16.dp)
    )
}

@Composable
private fun ProfileMenuItem(
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
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(iconTint.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 14.5.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = subtitle,
                color = MaxxColors.TextSecondary,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
            contentDescription = null,
            tint = MaxxColors.TextMuted,
            modifier = Modifier.size(20.dp)
        )
    }
}
