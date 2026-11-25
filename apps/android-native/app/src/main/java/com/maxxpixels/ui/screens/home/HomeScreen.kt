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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.HorizontalDivider
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
import kotlin.math.absoluteValue

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

    val firstName = remember(session?.fullName) {
        session?.fullName?.trim()?.split(" ")?.firstOrNull()?.takeIf { it.isNotBlank() } ?: "Guest"
    }
    val portalLabel = if (selectedLanguage == "kannada") "Kannada Cinema" else "All Indian"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
    ) {
        // 1. Pinned Notch-Safe Top Navbar (clears status bar & camera cutout cleanly on all devices)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xDC0B0A10))
                .windowInsetsPadding(
                    WindowInsets.statusBars.union(WindowInsets.displayCutout).only(WindowInsetsSides.Top)
                )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .weight(1f)
                        .clickable(onClick = onOpenPortalHub)
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
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
                                modifier = Modifier.size(28.dp)
                            )
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.LocationOn,
                                contentDescription = null,
                                tint = MaxxColors.Primary,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(Modifier.width(3.dp))
                            Text(
                                text = portalLabel,
                                color = MaxxColors.TextSecondary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        Text(
                            text = "Hello, $firstName",
                            color = Color.White,
                            fontSize = 17.5.sp,
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
                                .size(36.dp)
                                .clip(CircleShape)
                                .clickable(onClick = onOpenNotifications),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Notifications,
                                contentDescription = "Notifications",
                                tint = Color.White,
                                modifier = Modifier.size(19.dp)
                            )
                        }
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.08f))
                                .clickable(onClick = onOpenPortalHub),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Menu,
                                contentDescription = "Portals",
                                tint = Color.White,
                                modifier = Modifier.size(19.dp)
                            )
                        }
                    }
                }
            }
            HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
        }

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(top = 14.dp, bottom = 112.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp)
        ) {

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

            // 3. Peeking Hero Section Carousel with Frosted Details Card
            item {
                if (loading && banners.isEmpty()) {
                    ShimmerBox(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .aspectRatio(0.75f),
                        shape = RoundedCornerShape(28.dp)
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
                            contentPadding = PaddingValues(horizontal = 24.dp),
                            pageSpacing = 12.dp,
                            beyondViewportPageCount = 1,
                            modifier = Modifier.fillMaxWidth()
                        ) { page ->
                            val item = banners[page]
                            val isSaved = savedIds.contains(item.id) || item.isBookmarked
                            val pageOffset = ((pagerState.currentPage - page) + pagerState.currentPageOffsetFraction)
                                .absoluteValue.coerceIn(0f, 1f)
                            val scale = 1f - (pageOffset * 0.06f)
                            val cardAlpha = 1f - (pageOffset * 0.22f)

                            HeroCinemaPosterCard(
                                item = item,
                                isSaved = isSaved,
                                onOpenDetails = { onOpenDetails(item.id) },
                                onToggleWatchlist = {
                                    val next = !isSaved
                                    savedIds = if (next) savedIds + item.id else savedIds - item.id
                                    scope.launch { repository.toggleWatchlist(item.id, item.title, next) }
                                },
                                modifier = Modifier.graphicsLayer {
                                    scaleX = scale
                                    scaleY = scale
                                    alpha = cardAlpha
                                }
                            )
                        }

                        if (banners.size > 1) {
                            Spacer(Modifier.height(14.dp))
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(7.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val count = banners.size.coerceAtMost(8)
                                repeat(count) { idx ->
                                    val active = pagerState.currentPage % banners.size == idx
                                    val pillWidth by animateDpAsState(
                                        targetValue = if (active) 24.dp else 7.dp,
                                        label = "heroDot"
                                    )
                                    Box(
                                        modifier = Modifier
                                            .height(6.dp)
                                            .width(pillWidth)
                                            .clip(CircleShape)
                                            .background(
                                                if (active) MaxxColors.Primary else Color.White.copy(alpha = 0.26f)
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
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        HomeSectionRowHeader(title = "Continue Watching", actionLabel = null, onAction = {})
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 18.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            items(continueWatching, key = { "cw_${it.id}" }) { cwItem ->
                                ContinueWatchingCard(
                                    item = cwItem,
                                    onPlay = { onPlayItem(cwItem.id, cwItem.title) },
                                    onOpenDetails = { onOpenDetails(cwItem.id) }
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
    isSaved: Boolean,
    onOpenDetails: () -> Unit,
    onToggleWatchlist: () -> Unit,
    modifier: Modifier = Modifier
) {
    val badgeLabel = when {
        item.isRent -> if (item.rentPrice > 0) "RENT ₹${item.rentPrice.toInt()}" else "RENT"
        item.isPremium -> "VIP EXCLUSIVE"
        else -> "FEATURED"
    }
    val metaParts = listOfNotNull(
        item.releaseYear.takeIf { it.isNotBlank() },
        item.language.takeIf { it.isNotBlank() },
        item.durationLabel.takeIf { it.isNotBlank() },
        item.maturityRating.takeIf { it.isNotBlank() }
    )

    Surface(
        shape = RoundedCornerShape(28.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
        shadowElevation = 22.dp,
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(0.75f)
            .bounceClick(onClick = onOpenDetails)
    ) {
        Box(modifier = Modifier.fillMaxSize().background(MaxxColors.SurfaceDark)) {
            AsyncImage(
                model = item.posterUrl.ifBlank { item.landscapeUrl },
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Subtle top & bottom cinematic vignette
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .align(Alignment.TopCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color(0x990A090E), Color.Transparent)
                        )
                    )
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(230.dp)
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color(0x990A090E), Color(0xEE0A090E))
                        )
                    )
            )

            // Top Row: Featured / VIP / Rent Badge + Watchlist Circle
            Row(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .padding(14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = if (item.isRent) MaxxColors.Primary else Color.Black.copy(alpha = 0.55f),
                    shape = RoundedCornerShape(999.dp),
                    border = BorderStroke(
                        1.dp,
                        if (item.isRent) MaxxColors.Primary else MaxxColors.Primary.copy(alpha = 0.5f)
                    )
                ) {
                    Text(
                        text = badgeLabel,
                        color = if (item.isRent) MaxxColors.OnPrimaryDark else MaxxColors.Primary,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 0.8.sp,
                        modifier = Modifier.padding(horizontal = 11.dp, vertical = 5.dp)
                    )
                }

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.52f))
                        .clickable(onClick = onToggleWatchlist),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isSaved) Icons.Rounded.Check else Icons.Rounded.Add,
                        contentDescription = "My List",
                        tint = if (isSaved) MaxxColors.Primary else Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Bottom Floating Frosted Details Card (Name + Details + Watch Now -> Routes to DetailsScreen)
            Surface(
                color = Color(0xD814111D),
                shape = RoundedCornerShape(22.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(12.dp)
                    .clickable(onClick = onOpenDetails)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 15.dp, vertical = 13.dp)
                ) {
                    Text(
                        text = item.title,
                        color = Color.White,
                        fontSize = 18.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (metaParts.isNotEmpty()) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = metaParts.joinToString(" • "),
                            color = Color.White.copy(alpha = 0.74f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Spacer(Modifier.height(11.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(9.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(MaxxColors.BrandGradient)
                                .clickable(onClick = onOpenDetails),
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
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }
                        }

                        Surface(
                            color = Color.White.copy(alpha = 0.1f),
                            shape = CircleShape,
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.18f)),
                            modifier = Modifier
                                .size(42.dp)
                                .clickable(onClick = onOpenDetails)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                                    contentDescription = "Open Details",
                                    tint = Color.White,
                                    modifier = Modifier.size(22.dp)
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
    onPlay: () -> Unit,
    onOpenDetails: () -> Unit
) {
    val pct = (item.progressPercent.coerceIn(0.05f, 1f) * 100).toInt()
    val subtitle = listOfNotNull(
        item.durationLabel.takeIf { it.isNotBlank() },
        item.language.takeIf { it.isNotBlank() }
    ).joinToString(" • ").ifBlank { "$pct% watched" }

    Surface(
        color = MaxxColors.SurfaceGlass,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.13f)),
        shadowElevation = 10.dp,
        modifier = Modifier
            .width(248.dp)
            .bounceClick(onClick = onPlay)
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

                // Subtle bottom scrim for controls & progress legibility
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(64.dp)
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color.Transparent, Color(0xDD0B0A10))
                            )
                        )
                )

                // Top-left frosted progress badge
                Surface(
                    color = Color.Black.copy(alpha = 0.62f),
                    shape = RoundedCornerShape(999.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.Primary)
                        )
                        Text(
                            text = "$pct% watched",
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Top-right frosted Info icon -> routes to DetailsScreen
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp)
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.56f))
                        .clickable(onClick = onOpenDetails),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Info,
                        contentDescription = "Details",
                        tint = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.size(16.dp)
                    )
                }

                // Bottom-right glowing amber Play button
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 10.dp, bottom = 12.dp)
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(MaxxColors.BrandGradient)
                        .clickable(onClick = onPlay),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PlayArrow,
                        contentDescription = "Resume",
                        tint = MaxxColors.OnPrimaryDark,
                        modifier = Modifier.size(22.dp)
                    )
                }

                // Clean rounded progress bar without trailing stop dot
                LinearProgressIndicator(
                    progress = { item.progressPercent.coerceIn(0.05f, 1f) },
                    color = MaxxColors.Primary,
                    trackColor = Color.White.copy(alpha = 0.22f),
                    strokeCap = StrokeCap.Round,
                    drawStopIndicator = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                        .height(4.dp)
                        .align(Alignment.BottomCenter)
                )
            }

            // Bottom Frosted Info Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 13.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.title,
                        color = Color.White,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        color = MaxxColors.TextSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Resume",
                    color = MaxxColors.Primary,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }
        }
    }
}
