package com.maxxpixels.ui.screens.home

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.collectIsDraggedAsState
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
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.PlayArrow
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
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import coil.compose.AsyncImage
import com.maxxpixels.R
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.model.ContentTypeItem
import com.maxxpixels.data.model.HomeSection
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.ApiDisconnectView
import com.maxxpixels.ui.components.ShimmerBox
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Modern Frosted-Glass Cinema HomeScreen:
 * - Warm plum/burgundy ambient top gradient fading into cinema charcoal
 * - Greeting header: User Avatar + Portal pill + "Hello, <Name>" left; frosted double-pill (Bell + Menu) right
 * - Scrollable category pills (active golden amber pill with dark text, inactive frosted glass pills)
 * - Tall rounded Hero Poster Card (28.dp) with centered golden "Watch Now" pill CTA
 * - MaxxPixels Picks, Continue Watching & Dynamic Category Rails with 20.dp rounded cards
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
    onOpenPortalHub: () -> Unit,
    onOpenAccount: () -> Unit = {}
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

    val firstName = remember(session?.fullName) {
        session?.fullName?.trim()?.split(" ")?.firstOrNull()?.takeIf { it.isNotBlank() } ?: "Guest"
    }
    val portalLabel = if (selectedLanguage == "kannada") "Kannada Cinema" else "All Indian"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding(),
            contentPadding = PaddingValues(top = 12.dp, bottom = 112.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // 1. Greeting Header (Avatar + Portal + "Hello, <Name>" | Frosted Bell + Menu Capsule)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .weight(1f)
                            .clickable(onClick = onOpenAccount)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.SurfaceElevated),
                            contentAlignment = Alignment.Center
                        ) {
                            if (!session?.avatarUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = session?.avatarUrl,
                                    contentDescription = firstName,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
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
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Rounded.LocationOn,
                                    contentDescription = null,
                                    tint = MaxxColors.TextSecondary,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(Modifier.width(3.dp))
                                Text(
                                    text = portalLabel,
                                    color = MaxxColors.TextSecondary,
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            Text(
                                text = "Hello, $firstName",
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    // Frosted Double-Pill Action Capsule (Notification Bell + Portal Menu)
                    Surface(
                        color = Color.White.copy(alpha = 0.09f),
                        shape = RoundedCornerShape(999.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .clickable(onClick = onOpenNotifications),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Notifications,
                                    contentDescription = "Notifications",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.08f))
                                    .clickable(onClick = onOpenPortalHub),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Menu,
                                    contentDescription = "Portals",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 2. Category Pill Bar (Golden Active Pill + Frosted Glass Inactive Pills)
            item {
                val filterItems = buildList {
                    add(0 to "All")
                    types.forEach { add(it.id to it.title) }
                }
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filterItems) { (tid, label) ->
                        val active = selectedTypeId == tid
                        if (active) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(MaxxColors.BrandGradient)
                                    .clickable { selectedTypeId = tid }
                                    .padding(horizontal = 20.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = label,
                                    color = MaxxColors.OnPrimaryDark,
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        } else {
                            Surface(
                                color = Color.White.copy(alpha = 0.08f),
                                shape = RoundedCornerShape(999.dp),
                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                                modifier = Modifier.clickable { selectedTypeId = tid }
                            ) {
                                Text(
                                    text = label,
                                    color = Color.White.copy(alpha = 0.88f),
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 3. Hotstar-Style Centered Hero Carousel with Space on Both Sides
            item {
                if (loading && banners.isEmpty()) {
                    ShimmerBox(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 26.dp)
                            .aspectRatio(0.75f),
                        shape = RoundedCornerShape(22.dp)
                    )
                } else if (banners.isNotEmpty()) {
                    val pagerState = rememberPagerState(pageCount = { banners.size })
                    val isDragged by pagerState.interactionSource.collectIsDraggedAsState()
                    LaunchedEffect(banners.size, isDragged) {
                        if (banners.size > 1 && !isDragged) {
                            while (true) {
                                delay(5000)
                                val next = (pagerState.currentPage + 1) % banners.size
                                pagerState.animateScrollToPage(next)
                            }
                        }
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        HorizontalPager(
                            state = pagerState,
                            contentPadding = PaddingValues(horizontal = 26.dp),
                            pageSpacing = 12.dp,
                            beyondViewportPageCount = 2,
                            modifier = Modifier.fillMaxWidth()
                        ) { page ->
                            val item = banners[page]
                            val isSaved = savedIds.contains(item.id) || item.isBookmarked
                            val pageOffset = kotlin.math.abs(
                                (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction
                            ).coerceIn(0f, 1f)
                            val scale = 1f - (pageOffset * 0.06f)
                            val cardAlpha = 1f - (pageOffset * 0.28f)

                            HeroCinemaPosterCard(
                                item = item,
                                rankIndex = page + 1,
                                isSaved = isSaved,
                                onWatchNow = { onOpenDetails(item.id) },
                                onToggleWatchlist = {
                                    val next = !isSaved
                                    savedIds = if (next) savedIds + item.id else savedIds - item.id
                                    scope.launch { repository.toggleWatchlist(item.id, item.title, next) }
                                },
                                modifier = Modifier
                                    .zIndex(1f - pageOffset)
                                    .graphicsLayer {
                                        scaleX = scale
                                        scaleY = scale
                                        alpha = cardAlpha
                                    }
                            )
                        }

                        if (banners.size > 1) {
                            Spacer(Modifier.height(12.dp))
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val count = banners.size.coerceAtMost(8)
                                repeat(count) { idx ->
                                    val active = pagerState.currentPage % banners.size == idx
                                    val dotWidth by animateDpAsState(
                                        targetValue = if (active) 22.dp else 6.dp,
                                        label = "heroDot"
                                    )
                                    Box(
                                        modifier = Modifier
                                            .height(5.dp)
                                            .width(dotWidth)
                                            .clip(CircleShape)
                                            .background(
                                                if (active) MaxxColors.Primary else Color.White.copy(alpha = 0.28f)
                                            )
                                            .clickable {
                                                scope.launch { pagerState.animateScrollToPage(idx) }
                                            }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 4. Continue Watching Rail
            if (continueWatching.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        HomeSectionRowHeader(title = "Continue Watching", actionLabel = null, onAction = {})
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 18.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(continueWatching, key = { "cw_${it.id}" }) { cwItem ->
                                ContinueWatchingCard(
                                    item = cwItem,
                                    onPlay = { onPlayItem(cwItem.id, cwItem.title) }
                                )
                            }
                        }
                    }
                }
            }

            // 5. Dynamic Catalog Rails ("MaxxPixels Picks", Movies, Web Series, etc.)
            if (loading && sections.isEmpty()) {
                items(2) {
                    Column(
                        modifier = Modifier.padding(horizontal = 18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        ShimmerBox(modifier = Modifier.width(150.dp).height(20.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            repeat(3) {
                                ShimmerBox(
                                    modifier = Modifier.width(124.dp).aspectRatio(2f / 3f),
                                    shape = RoundedCornerShape(20.dp)
                                )
                            }
                        }
                    }
                }
            } else {
                items(sections, key = { "sec_${it.id}_${it.title}" }) { section ->
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        HomeSectionRowHeader(
                            title = section.title,
                            actionLabel = "See All",
                            onAction = { onOpenCategory(section.title, selectedTypeId, selectedLanguage) }
                        )
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 18.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(section.items, key = { "${section.id}_${it.id}" }) { item ->
                                PortraitPosterCard(
                                    item = item,
                                    onClick = { onOpenDetails(item.id) }
                                )
                            }
                        }
                    }
                }
            }

            // 6. VIP Upgrade Banner (when user doesn't have an active subscription)
            if (session?.hasActiveSubscription != true) {
                item {
                    Surface(
                        color = MaxxColors.SurfaceGlass,
                        shape = RoundedCornerShape(24.dp),
                        border = BorderStroke(1.dp, MaxxColors.Primary.copy(alpha = 0.45f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp)
                            .bounceClick(onClick = onOpenSubscription)
                    ) {
                        Row(
                            modifier = Modifier.padding(18.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Rounded.WorkspacePremium,
                                        contentDescription = null,
                                        tint = MaxxColors.Primary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        text = "MAXXPIXELS VIP",
                                        color = MaxxColors.Primary,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = 1.sp
                                    )
                                }
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = "Unlock All Originals & Movies",
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(MaxxColors.BrandGradient)
                                    .padding(horizontal = 16.dp, vertical = 9.dp)
                            ) {
                                Text(
                                    text = "Upgrade",
                                    color = MaxxColors.OnPrimaryDark,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeSectionRowHeader(
    title: String,
    actionLabel: String?,
    onAction: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title,
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        if (!actionLabel.isNullOrBlank()) {
            Text(
                text = actionLabel,
                color = MaxxColors.TextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable(onClick = onAction)
            )
        }
    }
}

@Composable
private fun HeroCinemaPosterCard(
    item: CatalogItem,
    rankIndex: Int,
    isSaved: Boolean,
    onWatchNow: () -> Unit,
    onToggleWatchlist: () -> Unit,
    modifier: Modifier = Modifier
) {
    val topBadgeText = when {
        item.isNewlyAdded -> "NEWLY ADDED"
        item.isRent -> if (item.rentPrice > 0) "RENT ₹${item.rentPrice.toInt()}" else "RENT"
        item.isPremium -> "#$rankIndex in ${item.language.ifBlank { "Trending" }} Today"
        else -> "#$rankIndex Trending Today"
    }
    val meta = listOfNotNull(
        item.releaseYear.takeIf { it.isNotBlank() },
        item.language.takeIf { it.isNotBlank() },
        item.durationLabel.takeIf { it.isNotBlank() },
        item.genres.firstOrNull()?.takeIf { it.isNotBlank() }
    ).joinToString(" • ")

    Surface(
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
        shadowElevation = 18.dp,
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(0.75f)
            .bounceClick(scaleDown = 0.985f, onClick = onWatchNow)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaxxColors.SurfaceDark)
        ) {
            AsyncImage(
                model = item.posterUrl.ifBlank { item.landscapeUrl },
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                alignment = Alignment.TopCenter,
                modifier = Modifier.fillMaxSize()
            )

            // Deep cinema bottom vignette for crisp left-aligned title & CTA
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(230.dp)
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0.0f to Color.Transparent,
                                0.45f to Color(0xCC0B0A10),
                                0.85f to Color(0xF50A090E),
                                1.0f to Color(0xFF0A090E)
                            )
                        )
                    )
            )

            // Top-left frosted ranking / status pill (JioHotstar style)
            Surface(
                color = Color.Black.copy(alpha = 0.62f),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(12.dp)
            ) {
                Text(
                    text = topBadgeText,
                    color = MaxxColors.PrimaryLight,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }

            // Bottom Left-Aligned JioHotstar Info + Full-Width Watch Now + Square '+' Button
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 14.dp)
            ) {
                Text(
                    text = item.title.uppercase(),
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.8.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                if (meta.isNotBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = meta,
                        color = Color.White.copy(alpha = 0.78f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(9.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaxxColors.BrandGradient)
                            .clickable(onClick = onWatchNow),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = null,
                                tint = MaxxColors.OnPrimaryDark,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = "Watch Now",
                                color = MaxxColors.OnPrimaryDark,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }

                    Surface(
                        color = Color.White.copy(alpha = 0.14f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.22f)),
                        modifier = Modifier
                            .size(44.dp)
                            .clickable(onClick = onToggleWatchlist)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = if (isSaved) Icons.Rounded.Check else Icons.Rounded.Add,
                                contentDescription = "My List",
                                tint = if (isSaved) MaxxColors.Primary else Color.White,
                                modifier = Modifier.size(21.dp)
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
    Column(modifier = modifier.width(126.dp).bounceClick(onClick = onClick)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(RoundedCornerShape(20.dp))
                .background(MaxxColors.SurfaceDark)
        ) {
            AsyncImage(
                model = item.posterUrl.ifBlank { item.landscapeUrl },
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            if (item.isNewlyAdded) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(7.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(MaxxColors.BrandGradient)
                        .padding(horizontal = 7.dp, vertical = 2.dp)
                ) {
                    Text("NEW", color = MaxxColors.OnPrimaryDark, fontSize = 8.5.sp, fontWeight = FontWeight.Black)
                }
            }
            if (item.isRent) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(7.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(MaxxColors.Primary)
                        .padding(horizontal = 7.dp, vertical = 2.dp)
                ) {
                    Text("RENT", color = MaxxColors.OnPrimaryDark, fontSize = 8.5.sp, fontWeight = FontWeight.Black)
                }
            } else if (item.isPremium) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(7.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color.Black.copy(alpha = 0.65f))
                        .padding(horizontal = 7.dp, vertical = 2.dp)
                ) {
                    Text("VIP", color = MaxxColors.Primary, fontSize = 8.5.sp, fontWeight = FontWeight.Black)
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
    onPlay: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(196.dp)
            .bounceClick(onClick = onPlay)
    ) {
        // Pure 16:9 landscape image with progress line at bottom edge (no card below image)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(12.dp))
                .background(MaxxColors.SurfaceDark)
        ) {
            AsyncImage(
                model = item.landscapeUrl.ifBlank { item.posterUrl },
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                alignment = Alignment.TopCenter,
                modifier = Modifier.fillMaxSize()
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(listOf(Color.Transparent, Color(0xCC0A090E)))
                    )
            )
            Icon(
                imageVector = Icons.Rounded.PlayArrow,
                contentDescription = "Resume",
                tint = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 8.dp, bottom = 8.dp)
                    .size(20.dp)
            )
            LinearProgressIndicator(
                progress = { item.progressPercent.coerceIn(0.05f, 1f) },
                color = MaxxColors.Primary,
                trackColor = Color.White.copy(alpha = 0.28f),
                strokeCap = StrokeCap.Butt,
                drawStopIndicator = {},
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .align(Alignment.BottomCenter)
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = item.title,
            color = Color.White,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}
