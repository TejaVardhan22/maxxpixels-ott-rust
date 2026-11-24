package com.maxxpixels.ui.screens.home

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.maxxpixels.R
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.model.ContentTypeItem
import com.maxxpixels.data.model.HomeSection
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.ApiDisconnectView
import com.maxxpixels.ui.components.SectionHeader
import com.maxxpixels.ui.components.ShimmerBox
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.absoluteValue

/**
 * 1:1 Replication of React Native HomeScreen (apps/mobile/src/screens/HomeScreen/HomeScreen.tsx):
 * 1. OttTopBar (Logo + MaxxPixels + Subtitle "Kannada Cinema / All Indian Languages" + Cast, Search, Bell)
 * 2. FilterPillBar (All, Movies, Web Series, Short Films, Micro-Drama, Songs, Podcasts, AI Cinema)
 * 3. FeaturedHeadingRow (Title + VIP Upgrade pill)
 * 4. HeroCarousel (Centered peeking poster card with Play + Watchlist buttons)
 * 5. Continue Watching + MainTypeRails (Portrait poster rails with VIP/RENT badges)
 * 6. FeedUpgradeBanner at the bottom
 */
@Composable
fun HomeScreen(
    repository: MaxxRepository,
    initialLanguage: String = "kannada",
    initialTypeId: Int = 0,
    onOpenDetails: (Long) -> Unit,
    onPlayItem: (Long, String) -> Unit,
    onOpenSearch: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenCategory: (title: String, typeId: Int, language: String) -> Unit,
    onOpenSubscription: () -> Unit,
    onOpenGames: () -> Unit,
    onOpenPortalHub: () -> Unit
) {
    val session by repository.sessionManager.session.collectAsState()
    val scope = rememberCoroutineScope()

    var selectedTypeId by remember(initialTypeId) { mutableIntStateOf(initialTypeId) }
    var selectedLanguage by remember(initialLanguage) { mutableStateOf(initialLanguage) }
    var savedIds by remember { mutableStateOf(setOf<Long>()) }

    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var banners by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var sections by remember { mutableStateOf<List<HomeSection>>(emptyList()) }
    var types by remember { mutableStateOf<List<ContentTypeItem>>(emptyList()) }
    var continueWatching by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }

    fun load(typeId: Int = selectedTypeId, lang: String = selectedLanguage) {
        loading = banners.isEmpty() && sections.isEmpty()
        errorMsg = null
        scope.launch {
            val apiLang = if (lang == "all-indian") "non-kannada" else lang
            when (val res = repository.loadHomeCatalog(typeId = typeId, language = apiLang)) {
                is ApiResult.Success -> {
                    banners = res.data.banners
                    sections = res.data.sections
                    types = res.data.contentTypes
                    continueWatching = res.data.continueWatching
                }
                is ApiResult.Error -> {
                    if (sections.isEmpty()) errorMsg = res.message
                }
            }
            loading = false
        }
    }

    LaunchedEffect(selectedTypeId, selectedLanguage) {
        load(selectedTypeId, selectedLanguage)
    }

    if (errorMsg != null && sections.isEmpty()) {
        ApiDisconnectView(
            title = "Couldn't load catalog",
            message = errorMsg!!,
            onRetry = { load() }
        )
        return
    }

    val featuredTitle = if (selectedLanguage == "kannada") {
        if (selectedTypeId == 0) "Kannada Entertainment"
        else "Kannada ${types.firstOrNull { it.id == selectedTypeId }?.title ?: "Originals"}"
    } else {
        if (selectedTypeId == 0) "All Indian Cinema & Shows"
        else "Indian ${types.firstOrNull { it.id == selectedTypeId }?.title ?: "Originals"}"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
    ) {
        // 1. OttTopBar (Exact RN layout: Logo + Brand/Subtitle left, Tv/Search/Bell right)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaxxColors.CinemaBlack)
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onOpenPortalHub)
            ) {
                Image(
                    painter = painterResource(R.drawable.app_logo),
                    contentDescription = "MaxxPixels",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(8.dp))
                )
                Spacer(Modifier.width(9.dp))
                Column {
                    Text(
                        text = "MaxxPixels",
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1
                    )
                    Text(
                        text = if (selectedLanguage == "kannada") "Kannada Cinema" else "All Indian Languages",
                        color = MaxxColors.TextSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1
                    )
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Tv,
                    contentDescription = "Portal",
                    tint = Color.White,
                    modifier = Modifier
                        .size(21.dp)
                        .clickable(onClick = onOpenPortalHub)
                )
                Icon(
                    imageVector = Icons.Rounded.Search,
                    contentDescription = "Search",
                    tint = Color.White,
                    modifier = Modifier
                        .size(21.dp)
                        .clickable(onClick = onOpenSearch)
                )
                Icon(
                    imageVector = Icons.Rounded.Notifications,
                    contentDescription = "Notifications",
                    tint = Color.White,
                    modifier = Modifier
                        .size(21.dp)
                        .clickable(onClick = onOpenNotifications)
                )
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // 2. FilterPillBar
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        RnFilterPill(
                            label = "For You",
                            selected = selectedTypeId == 0,
                            onClick = { selectedTypeId = 0 }
                        )
                    }
                    items(types, key = { it.id }) { ct ->
                        RnFilterPill(
                            label = ct.title,
                            selected = selectedTypeId == ct.id,
                            onClick = { selectedTypeId = ct.id }
                        )
                    }
                    item {
                        RnFilterPill(
                            label = if (selectedLanguage == "kannada") "All Indian" else "Kannada",
                            selected = false,
                            onClick = {
                                selectedLanguage = if (selectedLanguage == "kannada") "all-indian" else "kannada"
                            }
                        )
                    }
                }
            }

            // 3. FeaturedHeadingRow (Title + Upgrade Pill)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = featuredTitle,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    if (session?.hasActiveSubscription != true) {
                        Spacer(Modifier.width(8.dp))
                        Surface(
                            color = MaxxColors.AhaGold.copy(alpha = 0.16f),
                            shape = RoundedCornerShape(99.dp),
                            border = BorderStroke(1.dp, MaxxColors.AhaGold),
                            modifier = Modifier.clickable(onClick = onOpenSubscription)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                            ) {
                                Icon(Icons.Rounded.WorkspacePremium, null, tint = MaxxColors.AhaGold, modifier = Modifier.size(13.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Upgrade", color = MaxxColors.AhaGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // 4. HeroCarousel (Exact RN centered peeking card with #E50914 Play & Watchlist)
            item {
                if (loading && banners.isEmpty()) {
                    ShimmerBox(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp)
                            .height(410.dp),
                        shape = RoundedCornerShape(16.dp)
                    )
                } else if (banners.isNotEmpty()) {
                    RnHeroCarousel(
                        banners = banners.take(8),
                        savedIds = savedIds,
                        onPlay = { item -> onPlayItem(item.id, item.title) },
                        onDetails = { item -> onOpenDetails(item.id) },
                        onToggleWatchlist = { item ->
                            val adding = item.id !in savedIds
                            savedIds = if (adding) savedIds + item.id else savedIds - item.id
                            scope.launch { repository.toggleWatchlist(item.id, item.title, adding) }
                        }
                    )
                }
            }

            // 5. Continue Watching Rail
            if (continueWatching.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        SectionHeader(title = "Continue Watching", actionLabel = null)
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(continueWatching, key = { "cw_${it.id}" }) { item ->
                                ContinueWatchingCard(
                                    item = item,
                                    onClick = { onPlayItem(item.id, item.title) }
                                )
                            }
                        }
                    }
                }
            }

            // 6. MainTypeRails (Portrait poster rails matching RN MainTypeRails)
            if (loading && sections.isEmpty()) {
                items(3) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        ShimmerBox(modifier = Modifier.padding(horizontal = 16.dp).width(160.dp).height(18.dp))
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(4) {
                                ShimmerBox(modifier = Modifier.width(118.dp).aspectRatio(2f / 3f), shape = RoundedCornerShape(10.dp))
                            }
                        }
                    }
                }
            } else {
                items(sections, key = { "sec_${it.id}_${it.title}" }) { section ->
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        SectionHeader(
                            title = section.title,
                            actionLabel = "See All",
                            onActionClick = { onOpenCategory(section.title, selectedTypeId, selectedLanguage) }
                        )
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(section.items, key = { "s_${section.id}_${it.id}" }) { item ->
                                PortraitPosterCard(
                                    item = item,
                                    onClick = { onOpenDetails(item.id) }
                                )
                            }
                        }
                    }
                }
            }

            // 7. FeedUpgradeBanner (Exact RN bottom promotional card)
            item {
                Surface(
                    color = MaxxColors.SurfaceDark,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .clickable(onClick = onOpenSubscription)
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(18.dp)
                    ) {
                        Text(
                            text = if (selectedLanguage == "kannada") "Your MaxxPixels Kannada Feed" else "Your MaxxPixels Indian Cinema Feed",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "Unlock unlimited ad-free 4K movies, originals & MAXX GAMES.",
                            color = MaxxColors.TextSecondary,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(12.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaxxColors.Primary)
                                .padding(horizontal = 22.dp, vertical = 9.dp)
                        ) {
                            Text("Explore Plans", color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RnFilterPill(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) MaxxColors.Primary else MaxxColors.SurfaceDark,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, if (selected) MaxxColors.Primary else MaxxColors.BorderSubtle),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Text(
            text = label,
            color = if (selected) Color.White else MaxxColors.TextSecondary,
            fontSize = 12.5.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
        )
    }
}

@Composable
private fun RnHeroCarousel(
    banners: List<CatalogItem>,
    savedIds: Set<Long>,
    onPlay: (CatalogItem) -> Unit,
    onDetails: (CatalogItem) -> Unit,
    onToggleWatchlist: (CatalogItem) -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { banners.size })

    LaunchedEffect(banners.size) {
        if (banners.size > 1) {
            while (true) {
                delay(5000)
                val next = (pagerState.currentPage + 1) % banners.size
                pagerState.animateScrollToPage(next)
            }
        }
    }

    HorizontalPager(
        state = pagerState,
        contentPadding = PaddingValues(horizontal = 18.dp),
        pageSpacing = 10.dp,
        modifier = Modifier.fillMaxWidth()
    ) { page ->
        val item = banners[page]
        val pageOffset = ((pagerState.currentPage - page) + pagerState.currentPageOffsetFraction).absoluteValue
        val scale = 1f - (pageOffset.coerceIn(0f, 1f) * 0.05f)
        val isSaved = item.id in savedIds || item.isBookmarked

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(420.dp)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                }
                .clip(RoundedCornerShape(16.dp))
                .background(MaxxColors.SurfaceDark)
                .clickable { onDetails(item) }
        ) {
            AsyncImage(
                model = item.landscapeUrl.ifBlank { item.posterUrl },
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(230.dp)
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color(0xCC08090C), MaxxColors.CinemaBlack)
                        )
                    )
            )

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Text(
                    text = item.title,
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                val meta = listOfNotNull(
                    item.releaseYear.takeIf { it.isNotBlank() },
                    item.genres.firstOrNull(),
                    item.language.takeIf { it.isNotBlank() },
                    item.maturityRating.takeIf { it.isNotBlank() },
                    item.durationLabel.takeIf { it.isNotBlank() }
                ).joinToString(" • ")
                if (meta.isNotBlank()) {
                    Spacer(Modifier.height(5.dp))
                    Text(meta, color = MaxxColors.TextSecondary, fontSize = 11.5.sp, maxLines = 1)
                }

                Spacer(Modifier.height(14.dp))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(MaxxColors.Primary)
                            .bounceClick { onPlay(item) },
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(5.dp))
                            Text("Watch Now", color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Surface(
                        color = MaxxColors.SurfaceElevated,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, MaxxColors.BorderStrong),
                        modifier = Modifier
                            .size(44.dp)
                            .bounceClick { onToggleWatchlist(item) }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = if (isSaved) Icons.Rounded.Check else Icons.Rounded.Add,
                                contentDescription = "Watchlist",
                                tint = if (isSaved) MaxxColors.Primary else Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PortraitPosterCard(
    item: CatalogItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    showTitleBelow: Boolean = false
) {
    Column(modifier = modifier.width(118.dp).bounceClick(onClick = onClick)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(RoundedCornerShape(10.dp))
                .background(MaxxColors.SurfaceDark)
        ) {
            AsyncImage(
                model = item.posterUrl.ifBlank { item.landscapeUrl },
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            if (item.isRent) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(5.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaxxColors.AhaGold)
                        .padding(horizontal = 5.dp, vertical = 2.dp)
                ) {
                    Text("RENT", color = Color(0xFF0F172A), fontSize = 8.sp, fontWeight = FontWeight.Black)
                }
            } else if (item.isPremium) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(5.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaxxColors.Primary)
                        .padding(horizontal = 5.dp, vertical = 2.dp)
                ) {
                    Text("VIP", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Black)
                }
            }
        }
        if (showTitleBelow) {
            Spacer(Modifier.height(6.dp))
            Text(
                text = item.title,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun ContinueWatchingCard(
    item: CatalogItem,
    onClick: () -> Unit
) {
    Surface(
        color = MaxxColors.SurfaceDark,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
        modifier = Modifier
            .width(196.dp)
            .bounceClick(onClick = onClick)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 9f)
            ) {
                AsyncImage(
                    model = item.landscapeUrl.ifBlank { item.posterUrl },
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.65f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
                LinearProgressIndicator(
                    progress = { item.progressPercent.coerceIn(0.05f, 1f) },
                    color = MaxxColors.Primary,
                    trackColor = Color.White.copy(alpha = 0.25f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .align(Alignment.BottomCenter)
                )
            }
            Text(
                text = item.title,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
            )
        }
    }
}
