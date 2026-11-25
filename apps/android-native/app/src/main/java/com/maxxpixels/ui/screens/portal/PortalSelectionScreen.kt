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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
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
import androidx.compose.ui.graphics.Brush
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
            containerColor = Color(0xFF1A151E),
            shape = RoundedCornerShape(24.dp),
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
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(MaxxColors.BrandGradient)
                        .clickable {
                            showGamesDisclaimer = false
                            onOpenGamesHub()
                        }
                        .padding(horizontal = 18.dp, vertical = 9.dp)
                ) {
                    Text("I Agree", color = MaxxColors.OnPrimaryDark, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showGamesDisclaimer = false }) {
                    Text("Cancel", color = MaxxColors.TextSecondary, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
            .windowInsetsPadding(
                WindowInsets.statusBars.union(WindowInsets.displayCutout).only(WindowInsetsSides.Top)
            )
            .navigationBarsPadding(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Frosted Cinema Header Branding
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = Color.White.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                        modifier = Modifier.size(44.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Image(
                                painter = painterResource(R.drawable.app_logo),
                                contentDescription = "MaxxPixels",
                                contentScale = ContentScale.Fit,
                                modifier = Modifier.size(30.dp)
                            )
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "MAXXPIXELS",
                            color = Color.White,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.5.sp
                        )
                        Text(
                            text = "Next-Gen Digital Ecosystem",
                            color = MaxxColors.TextSecondary,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Frosted Gold Coin Wallet Pill
                    Surface(
                        color = Color.White.copy(alpha = 0.09f),
                        shape = RoundedCornerShape(999.dp),
                        border = BorderStroke(1.dp, MaxxColors.Primary.copy(alpha = 0.45f)),
                        modifier = Modifier.clickable { showGamesDisclaimer = true }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp)
                        ) {
                            Icon(Icons.Rounded.MonetizationOn, null, tint = MaxxColors.Primary, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("${gamer.coins}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // Golden VIP / Subscribe Pill
                    val isVip = session?.hasActiveSubscription == true
                    if (isVip) {
                        Surface(
                            color = MaxxColors.PrimaryTint,
                            shape = RoundedCornerShape(999.dp),
                            border = BorderStroke(1.dp, MaxxColors.Primary),
                            modifier = Modifier.clickable(onClick = onOpenSubscription)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp)
                            ) {
                                Icon(Icons.Rounded.WorkspacePremium, null, tint = MaxxColors.Primary, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("VIP", color = MaxxColors.Primary, fontSize = 11.5.sp, fontWeight = FontWeight.Black)
                            }
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(MaxxColors.BrandGradient)
                                .clickable(onClick = onOpenSubscription)
                                .padding(horizontal = 12.dp, vertical = 7.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Rounded.WorkspacePremium, null, tint = MaxxColors.OnPrimaryDark, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Subscribe", color = MaxxColors.OnPrimaryDark, fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold)
                            }
                        }
                    }
                }
            }
        }

        item {
            Text(
                text = "EXPLORE PORTALS",
                color = MaxxColors.PrimaryLight.copy(alpha = 0.85f),
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.6.sp,
                modifier = Modifier.padding(top = 2.dp)
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
        color = MaxxColors.SurfaceGlass,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
        shadowElevation = 14.dp,
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(2.02f)
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
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color(0x331A1219), Color(0xCC0A090E))
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(horizontal = 18.dp)
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
                                color = Color.White.copy(alpha = 0.88f),
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center,
                                maxLines = 2
                            )
                        }
                        if (ctaLabel.isNotBlank()) {
                            Spacer(Modifier.height(10.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(MaxxColors.BrandGradient)
                                    .padding(horizontal = 14.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = ctaLabel.uppercase(),
                                    color = MaxxColors.OnPrimaryDark,
                                    fontSize = 11.sp,
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
}
