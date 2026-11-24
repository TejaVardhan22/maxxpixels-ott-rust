package com.maxxpixels.ui.screens.portal

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MonetizationOn
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.maxxpixels.R
import com.maxxpixels.data.model.GamerProfile
import com.maxxpixels.data.model.PortalBannerItem
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.theme.MaxxColors

/**
 * MaxxPixels Super-App Portal Selection Screen (Aha/Hotstar Dark Cinema Style):
 * Uses the copied local portal banner drawables (banner_movies_entertainment, banner_games,
 * banner_all_indian_languages, banner_ai_movies) with live CMS override support.
 */
@Composable
fun PortalSelectionScreen(
    repository: MaxxRepository,
    onOpenOttPortal: (language: String, typeId: Int) -> Unit,
    onOpenGamesHub: () -> Unit,
    onOpenSearch: () -> Unit,
    onOpenSubscription: () -> Unit
) {
    val session by repository.sessionManager.session.collectAsState()

    var banners by remember { mutableStateOf<List<PortalBannerItem>>(emptyList()) }
    var gamer by remember { mutableStateOf(GamerProfile()) }
    var showGamesDisclaimer by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        banners = repository.getPortalBanners()
        gamer = repository.getGamerProfile()
    }

    fun bannerFor(vararg keys: String): PortalBannerItem? =
        banners.firstOrNull { b ->
            val k = b.portalKey.lowercase()
            keys.any { k == it || k.contains(it) }
        }

    val kannadaBanner = bannerFor("kannada", "movies & entertainment", "movies")
    val gamesBanner = bannerFor("games", "ludo", "carrom")
    val allIndianBanner = bannerFor("all-indian", "all indian", "telugu", "tamil")
    val aiBanner = bannerFor("ai", "ai-movies")

    if (showGamesDisclaimer) {
        AlertDialog(
            onDismissRequest = { showGamesDisclaimer = false },
            containerColor = MaxxColors.SurfaceDark,
            titleContentColor = Color.White,
            textContentColor = MaxxColors.TextSecondary,
            title = { Text("Disclaimer", fontWeight = FontWeight.ExtraBold) },
            text = {
                Text(
                    "MaxxPixels provides games to subscribers for entertainment purposes only and does not encourage betting or monetary transactions.\n\nWhile playing, you may or may not see ads for products, services, or other content, which MaxxPixels is not directly or indirectly involved in.\n\nHappy Playing,\nMaxxPixels",
                    fontSize = 13.sp,
                    lineHeight = 19.sp
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showGamesDisclaimer = false
                    onOpenGamesHub()
                }) {
                    Text("I Agree", color = MaxxColors.OrangeStart, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showGamesDisclaimer = false }) {
                    Text("Cancel", color = MaxxColors.TextSecondary)
                }
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header Branding (Matching PortalSelectionScreen.tsx + Aha/Hotstar VIP/Coin pills)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(
                        painter = painterResource(R.drawable.app_logo),
                        contentDescription = "MaxxPixels",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(10.dp))
                    )
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "MAXXPIXELS",
                            color = Color.White,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.6.sp
                        )
                        Text(
                            text = "Next-Gen Digital Ecosystem",
                            color = MaxxColors.TextSecondary,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Gold Coin Wallet Pill
                    Surface(
                        color = MaxxColors.SurfaceElevated,
                        shape = RoundedCornerShape(99.dp),
                        border = BorderStroke(1.dp, MaxxColors.VipGold.copy(alpha = 0.45f)),
                        modifier = Modifier.clickable { showGamesDisclaimer = true }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Rounded.MonetizationOn, null, tint = MaxxColors.VipGold, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("${gamer.coins}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // VIP / Subscribe Pill (Hotstar Gold Style)
                    Surface(
                        color = if (session?.hasActiveSubscription == true) MaxxColors.OrangeTint else MaxxColors.VipGold.copy(alpha = 0.16f),
                        shape = RoundedCornerShape(99.dp),
                        border = BorderStroke(1.dp, if (session?.hasActiveSubscription == true) MaxxColors.OrangeStart else MaxxColors.VipGold),
                        modifier = Modifier.clickable(onClick = onOpenSubscription)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Icon(
                                Icons.Rounded.WorkspacePremium,
                                null,
                                tint = if (session?.hasActiveSubscription == true) MaxxColors.OrangeStart else MaxxColors.VipGold,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = if (session?.hasActiveSubscription == true) "VIP" else "Subscribe",
                                color = if (session?.hasActiveSubscription == true) MaxxColors.OrangeStart else MaxxColors.VipGold,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            }
        }

        item {
            Text(
                text = "NEXT-GEN ECOSYSTEM",
                color = MaxxColors.TextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.5.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        // 1. MAXX MOVIES & ENTERTAINMENT (KANNADA OTT)
        item {
            PortalBannerCard(
                remoteImageUrl = kannadaBanner?.imageUrl.orEmpty(),
                fallbackDrawable = R.drawable.banner_movies_entertainment,
                title = kannadaBanner?.title.orEmpty(),
                subtitle = kannadaBanner?.subtitle.orEmpty(),
                ctaLabel = kannadaBanner?.buttonLabel.orEmpty(),
                onClick = { onOpenOttPortal("kannada", 0) }
            )
        }

        // 2. MAXX GAMES
        item {
            PortalBannerCard(
                remoteImageUrl = gamesBanner?.imageUrl.orEmpty(),
                fallbackDrawable = R.drawable.banner_games,
                title = gamesBanner?.title.orEmpty(),
                subtitle = gamesBanner?.subtitle.orEmpty(),
                ctaLabel = gamesBanner?.buttonLabel.orEmpty(),
                onClick = { showGamesDisclaimer = true }
            )
        }

        // 3. MAXX ALL INDIAN LANGUAGES MOVIES
        item {
            PortalBannerCard(
                remoteImageUrl = allIndianBanner?.imageUrl.orEmpty(),
                fallbackDrawable = R.drawable.banner_all_indian_languages,
                title = allIndianBanner?.title.orEmpty(),
                subtitle = allIndianBanner?.subtitle.orEmpty(),
                ctaLabel = allIndianBanner?.buttonLabel.orEmpty(),
                onClick = { onOpenOttPortal("all-indian", 0) }
            )
        }

        // 4. MAXX AI CINEMA
        item {
            PortalBannerCard(
                remoteImageUrl = aiBanner?.imageUrl.orEmpty(),
                fallbackDrawable = R.drawable.banner_ai_movies,
                title = aiBanner?.title.orEmpty(),
                subtitle = aiBanner?.subtitle.orEmpty(),
                ctaLabel = aiBanner?.buttonLabel.orEmpty(),
                onClick = { onOpenOttPortal("kannada", 7) }
            )
        }
    }
}

@Composable
private fun PortalBannerCard(
    remoteImageUrl: String,
    @DrawableRes fallbackDrawable: Int,
    title: String,
    subtitle: String,
    ctaLabel: String,
    onClick: () -> Unit
) {
    Surface(
        color = MaxxColors.SurfaceDark,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaxxColors.BorderStrong),
        shadowElevation = 6.dp,
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(2.05f)
            .bounceClick(scaleDown = 0.98f, onClick = onClick)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            if (remoteImageUrl.isNotBlank()) {
                AsyncImage(
                    model = remoteImageUrl,
                    contentDescription = title,
                    placeholder = painterResource(fallbackDrawable),
                    error = painterResource(fallbackDrawable),
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Image(
                    painter = painterResource(fallbackDrawable),
                    contentDescription = title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            }

            if (title.isNotBlank() || subtitle.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0x8C050A15)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    ) {
                        if (title.isNotBlank()) {
                            Text(
                                text = title,
                                color = Color.White,
                                fontSize = 19.sp,
                                fontWeight = FontWeight.Black,
                                textAlign = TextAlign.Center
                            )
                        }
                        if (subtitle.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = subtitle,
                                color = Color.White.copy(alpha = 0.9f),
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center,
                                maxLines = 2
                            )
                        }
                        if (ctaLabel.isNotBlank()) {
                            Spacer(Modifier.height(10.dp))
                            Text(
                                text = ctaLabel.uppercase(),
                                color = MaxxColors.VipGold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 0.8.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
