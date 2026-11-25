package com.maxxpixels.ui.screens.details

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
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
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Share
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.model.EpisodeItem
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.ApiDisconnectView
import com.maxxpixels.ui.components.ShimmerBox
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.screens.home.PortraitPosterCard
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

private fun formatMaturityRating(raw: String): String {
    val clean = raw.trim().uppercase()
    return when {
        clean.isBlank() -> ""
        clean == "UA_13+" || clean == "U/A_13+" -> "U/A 13+"
        clean == "UA_16+" || clean == "U/A_16+" -> "U/A 16+"
        clean == "UA_7+" || clean == "U/A_7+" -> "U/A 7+"
        clean == "A" || clean == "18+" -> "A 18+"
        else -> clean.replace("_", " ")
    }
}

/**
 * Polished Cinema Details Screen:
 * - Clean edge-to-edge hero artwork with soft vignette (no fake scrubber on static poster)
 * - Top frosted Back + Share buttons; real resume progress bar only when user has watch history
 * - Smooth overlapping warm dark sheet with clean formatted badges (U/A 13+, HD, VIP), genre chips,
 *   full-width golden pill Watch Now CTA, labeled frosted action bar (My List, Like, Download, Share),
 *   smart synopsis expand (only for long descriptions), and golden/glass tabs.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DetailsScreen(
    contentId: Long,
    repository: MaxxRepository,
    onBack: () -> Unit,
    onOpenDetails: (Long) -> Unit,
    onPlay: (contentId: Long, episodeId: Long?, title: String) -> Unit,
    onRequireSubscription: () -> Unit
) {
    val context = LocalContext.current
    val session by repository.sessionManager.session.collectAsState()
    val scope = rememberCoroutineScope()

    var item by remember { mutableStateOf<CatalogItem?>(null) }
    var related by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var inWatchlist by remember { mutableStateOf(false) }
    var isLiked by remember { mutableStateOf(false) }
    var expandedSynopsis by remember { mutableStateOf(false) }
    var activeTab by remember { mutableIntStateOf(0) }
    var activeSeasonIdx by remember { mutableIntStateOf(0) }
    var episodes by remember { mutableStateOf<List<EpisodeItem>>(emptyList()) }

    fun load() {
        loading = true
        errorMsg = null
        scope.launch {
            when (val res = repository.getContentDetail(contentId)) {
                is ApiResult.Success -> {
                    item = res.data
                    inWatchlist = res.data.isBookmarked
                    isLiked = res.data.isLiked
                    res.data.seasons.firstOrNull()?.let { s ->
                        episodes = repository.getSeasonEpisodes(s.id)
                    }
                    related = repository.getTrending().filter { it.id != contentId }
                }
                is ApiResult.Error -> errorMsg = res.message
            }
            loading = false
        }
    }

    LaunchedEffect(contentId) { load() }

    if (loading) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaxxColors.CinemaBlack)
                .statusBarsPadding()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            ShimmerBox(modifier = Modifier.fillMaxWidth().height(340.dp), shape = RoundedCornerShape(24.dp))
            ShimmerBox(modifier = Modifier.width(210.dp).height(28.dp))
            ShimmerBox(modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(999.dp))
        }
        return
    }

    if (errorMsg != null || item == null) {
        ApiDisconnectView(
            title = "Title unavailable",
            message = errorMsg ?: "Could not load title details.",
            onRetry = { load() }
        )
        return
    }

    val content = item!!
    val formattedRating = formatMaturityRating(content.maturityRating)
    val hasResume = content.progressPercent > 0.02f

    fun triggerPlay(episodeId: Long? = null, titleOverride: String = content.title) {
        if (session?.hasActiveSubscription == true) {
            onPlay(content.id, episodeId, titleOverride)
        } else {
            onRequireSubscription()
        }
    }

    fun shareTitle() {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "Watch ${content.title} on MaxxPixels!")
        }
        context.startActivity(Intent.createChooser(intent, "Share"))
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .navigationBarsPadding(),
        contentPadding = PaddingValues(bottom = 36.dp)
    ) {
        // 1. Clean Edge-to-Edge Cinema Hero Artwork
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(390.dp)
                    .clickable { triggerPlay() }
            ) {
                AsyncImage(
                    model = content.posterUrl.ifBlank { content.landscapeUrl },
                    contentDescription = content.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Top subtle scrim for status bar & back button legibility
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(110.dp)
                        .align(Alignment.TopCenter)
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0x990A090E), Color.Transparent)
                            )
                        )
                )

                // Deep smooth bottom cinema fade into the sheet
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                colorStops = arrayOf(
                                    0.0f to Color.Transparent,
                                    0.55f to Color(0xCC120D14),
                                    1.0f to Color(0xFF1D131A)
                                )
                            )
                        )
                )

                // Top Bar: Back (left) & Share (right)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        color = Color.Black.copy(alpha = 0.45f),
                        shape = CircleShape,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.22f)),
                        modifier = Modifier
                            .size(42.dp)
                            .clickable(onClick = onBack)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                                contentDescription = "Back",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    if (content.isPremium || content.isRent) {
                        Surface(
                            color = Color.Black.copy(alpha = 0.52f),
                            shape = RoundedCornerShape(999.dp),
                            border = BorderStroke(1.dp, MaxxColors.Primary.copy(alpha = 0.6f))
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 11.dp, vertical = 5.dp)
                            ) {
                                Icon(
                                    Icons.Rounded.WorkspacePremium,
                                    contentDescription = null,
                                    tint = MaxxColors.Primary,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    text = if (content.isRent) "RENT" else "VIP",
                                    color = MaxxColors.Primary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 0.6.sp
                                )
                            }
                        }
                    }
                }

                // Bottom-aligned Title & Crisp Metadata Pills directly over hero fade
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .padding(start = 20.dp, end = 20.dp, bottom = 32.dp)
                ) {
                    Text(
                        text = content.title,
                        color = Color.White,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                        lineHeight = 32.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(Modifier.height(10.dp))

                    // Crisp Metadata Pills Row (Year • Duration • Language • U/A 13+ • HD)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        if (content.releaseYear.isNotBlank()) {
                            MetaChip(content.releaseYear)
                        }
                        if (content.durationLabel.isNotBlank()) {
                            MetaChip(content.durationLabel)
                        }
                        if (content.language.isNotBlank()) {
                            MetaChip(content.language)
                        }
                        if (formattedRating.isNotBlank()) {
                            MetaChip(formattedRating, highlighted = true)
                        }
                        MetaChip("HD")
                    }

                    // Show real resume progress bar ONLY when user has started watching
                    if (hasResume) {
                        Spacer(Modifier.height(14.dp))
                        LinearProgressIndicator(
                            progress = { content.progressPercent.coerceIn(0.03f, 1f) },
                            color = MaxxColors.Primary,
                            trackColor = Color.White.copy(alpha = 0.22f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(4.dp)
                                .clip(RoundedCornerShape(999.dp))
                        )
                    }
                }
            }
        }

        // 2. Seamless Warm Frosted Sheet Body
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset(y = (-16).dp)
                    .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0.0f to Color(0xFF1D131A),
                                0.35f to MaxxColors.SurfaceDark,
                                1.0f to MaxxColors.CinemaBlack
                            )
                        )
                    )
                    .padding(top = 18.dp, bottom = 8.dp)
            ) {
                Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                    // Full-Width Golden Pill Primary CTA
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(MaxxColors.BrandGradient)
                            .bounceClick { triggerPlay() },
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Rounded.PlayArrow,
                                contentDescription = null,
                                tint = MaxxColors.OnPrimaryDark,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = when {
                                    hasResume -> "Resume Watching"
                                    content.isRent && content.rentPrice > 0 -> "Rent for ₹${content.rentPrice.toInt()}"
                                    else -> "Watch Now"
                                },
                                color = MaxxColors.OnPrimaryDark,
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    // Balanced 4-Column Frosted Action Bar (My List | Like | Download | Share)
                    Surface(
                        color = Color.White.copy(alpha = 0.06f),
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp, horizontal = 8.dp),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            LabeledDetailAction(
                                icon = if (inWatchlist) Icons.Rounded.Check else Icons.Rounded.Add,
                                label = if (inWatchlist) "Saved" else "My List",
                                tint = if (inWatchlist) MaxxColors.Primary else Color.White,
                                onClick = {
                                    val next = !inWatchlist
                                    inWatchlist = next
                                    scope.launch { repository.toggleWatchlist(content.id, content.title, next) }
                                }
                            )
                            LabeledDetailAction(
                                icon = if (isLiked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                                label = if (isLiked) "Liked" else "Like",
                                tint = if (isLiked) MaxxColors.Primary else Color.White,
                                onClick = { isLiked = !isLiked }
                            )
                            LabeledDetailAction(
                                icon = Icons.Rounded.Download,
                                label = "Download",
                                onClick = { triggerPlay() }
                            )
                            LabeledDetailAction(
                                icon = Icons.Rounded.Share,
                                label = "Share",
                                onClick = { shareTitle() }
                            )
                        }
                    }

                    // Genre Tags (if available)
                    if (content.genres.isNotEmpty()) {
                        Spacer(Modifier.height(14.dp))
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            content.genres.take(4).forEach { genre ->
                                Surface(
                                    color = MaxxColors.PrimaryTint,
                                    shape = RoundedCornerShape(999.dp)
                                ) {
                                    Text(
                                        text = genre,
                                        color = MaxxColors.PrimaryLight,
                                        fontSize = 11.5.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Synopsis (smart Read More only when text is actually long)
                    val cleanDesc = content.description.trim()
                    if (cleanDesc.isNotBlank()) {
                        Spacer(Modifier.height(16.dp))
                        val isLong = cleanDesc.length > 110
                        Column(
                            modifier = if (isLong) Modifier.clickable { expandedSynopsis = !expandedSynopsis } else Modifier
                        ) {
                            Text(
                                text = cleanDesc,
                                color = MaxxColors.TextSecondary,
                                fontSize = 13.5.sp,
                                lineHeight = 20.sp,
                                maxLines = if (expandedSynopsis || !isLong) 12 else 3,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (isLong) {
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = if (expandedSynopsis) "Show less" else "Read more",
                                    color = MaxxColors.Primary,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(22.dp))

                // Golden / Frosted Glass Pill Tabs
                val tabs = buildList {
                    add(0 to "More Like This")
                    add(1 to "Cast & Crew")
                    if (content.seasons.isNotEmpty()) add(2 to "Episodes")
                }
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(tabs) { (idx, label) ->
                        val active = activeTab == idx
                        if (active) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(MaxxColors.BrandGradient)
                                    .clickable { activeTab = idx }
                                    .padding(horizontal = 20.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = label,
                                    color = MaxxColors.OnPrimaryDark,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }
                        } else {
                            Surface(
                                color = Color.White.copy(alpha = 0.08f),
                                shape = RoundedCornerShape(999.dp),
                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                                modifier = Modifier.clickable { activeTab = idx }
                            ) {
                                Text(
                                    text = label,
                                    color = Color.White.copy(alpha = 0.85f),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(18.dp))

                // Tab Content
                when (activeTab) {
                    0 -> {
                        if (related.isEmpty()) {
                            Text(
                                text = "No similar titles available yet.",
                                color = MaxxColors.TextMuted,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 20.dp)
                            )
                        } else {
                            Text(
                                text = "Watch Similar",
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 20.dp)
                            )
                            Spacer(Modifier.height(12.dp))
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(related, key = { it.id }) { rel ->
                                    PortraitPosterCard(
                                        item = rel,
                                        onClick = { onOpenDetails(rel.id) },
                                        showTitleBelow = true
                                    )
                                }
                            }
                        }
                    }

                    1 -> {
                        val cast = content.cast
                        if (cast.isEmpty()) {
                            Text(
                                text = "Cast & crew details coming soon.",
                                color = MaxxColors.TextMuted,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 20.dp)
                            )
                        } else {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                items(cast) { member ->
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.width(80.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(66.dp)
                                                .clip(CircleShape)
                                                .background(MaxxColors.SurfaceElevated),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            if (member.photoUrl.isNotBlank()) {
                                                AsyncImage(
                                                    model = member.photoUrl,
                                                    contentDescription = member.name,
                                                    contentScale = ContentScale.Crop,
                                                    modifier = Modifier.fillMaxSize()
                                                )
                                            } else {
                                                Text(
                                                    text = member.name.take(1).uppercase(),
                                                    color = MaxxColors.Primary,
                                                    fontSize = 22.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                        Spacer(Modifier.height(6.dp))
                                        Text(
                                            text = member.name,
                                            color = Color.White,
                                            fontSize = 11.5.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        if (member.role.isNotBlank()) {
                                            Text(
                                                text = member.role,
                                                color = MaxxColors.TextMuted,
                                                fontSize = 10.sp,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    2 -> {
                        if (content.seasons.size > 1) {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(content.seasons.indices.toList()) { idx ->
                                    val s = content.seasons[idx]
                                    val selected = activeSeasonIdx == idx
                                    Surface(
                                        color = if (selected) MaxxColors.Primary else Color.White.copy(alpha = 0.08f),
                                        shape = RoundedCornerShape(999.dp),
                                        modifier = Modifier.clickable {
                                            activeSeasonIdx = idx
                                            scope.launch { episodes = repository.getSeasonEpisodes(s.id) }
                                        }
                                    ) {
                                        Text(
                                            text = s.name.ifBlank { "Season ${s.seasonNumber}" },
                                            color = if (selected) MaxxColors.OnPrimaryDark else Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                                        )
                                    }
                                }
                            }
                            Spacer(Modifier.height(14.dp))
                        }

                        Column(
                            modifier = Modifier.padding(horizontal = 20.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            episodes.forEach { ep ->
                                Surface(
                                    color = Color.White.copy(alpha = 0.06f),
                                    shape = RoundedCornerShape(18.dp),
                                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .bounceClick { triggerPlay(ep.id, "${content.title} - E${ep.episodeNumber}") }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .width(124.dp)
                                                .aspectRatio(16f / 9f)
                                                .clip(RoundedCornerShape(12.dp))
                                                .background(MaxxColors.SurfaceDark)
                                        ) {
                                            AsyncImage(
                                                model = ep.thumbnailUrl.ifBlank { content.landscapeUrl },
                                                contentDescription = ep.name,
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxSize()
                                            )
                                            Box(
                                                modifier = Modifier
                                                    .align(Alignment.Center)
                                                    .size(34.dp)
                                                    .clip(CircleShape)
                                                    .background(Color.Black.copy(alpha = 0.55f)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    Icons.Rounded.PlayArrow,
                                                    contentDescription = null,
                                                    tint = MaxxColors.Primary,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }
                                        }
                                        Spacer(Modifier.width(12.dp))
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = "E${ep.episodeNumber}. ${ep.name}",
                                                color = Color.White,
                                                fontSize = 13.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                maxLines = 2,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            if (ep.durationLabel.isNotBlank()) {
                                                Spacer(Modifier.height(4.dp))
                                                Text(
                                                    text = ep.durationLabel,
                                                    color = MaxxColors.TextSecondary,
                                                    fontSize = 11.5.sp
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MetaChip(
    text: String,
    highlighted: Boolean = false
) {
    Surface(
        color = if (highlighted) MaxxColors.PrimaryTint else Color.White.copy(alpha = 0.12f),
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(
            1.dp,
            if (highlighted) MaxxColors.Primary.copy(alpha = 0.55f) else Color.White.copy(alpha = 0.16f)
        )
    ) {
        Text(
            text = text,
            color = if (highlighted) MaxxColors.PrimaryLight else Color.White.copy(alpha = 0.92f),
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun LabeledDetailAction(
    icon: ImageVector,
    label: String,
    tint: Color = Color.White,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(5.dp))
        Text(
            text = label,
            color = if (tint == MaxxColors.Primary) MaxxColors.Primary else MaxxColors.TextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}
