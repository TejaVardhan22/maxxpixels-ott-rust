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
import androidx.compose.material.icons.rounded.PlayCircleOutline
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

private fun formatContentTypeLabel(raw: String): String {
    val clean = raw.trim().uppercase()
    return when {
        clean.contains("SHORT") -> "Short Film"
        clean.contains("SERIES") || clean.contains("SHOW") -> "Web Series"
        clean.contains("MICRO") -> "Micro-Drama"
        clean.contains("SONG") || clean.contains("ALBUM") || clean.contains("MUSIC") -> "Music"
        clean.contains("PODCAST") -> "Podcast"
        clean.isBlank() -> "Movie"
        else -> clean.lowercase().replace("_", " ").replaceFirstChar { it.uppercase() }
    }
}

/**
 * Polished Cinema Details Screen:
 * - Uncropped 16:9 top landscape banner (`landscapeUrl` preferred, `Alignment.TopCenter` inside status bar safe zone so top is never stripped/cut off)
 * - Side-by-side 2:3 Portrait Poster + Title, Content Type, Year, Duration, Language, Maturity Rating & HD pills
 * - Full-width Golden Pill Watch Now / Resume / Rent CTA + optional Trailer pill
 * - 4-column frosted action bar (My List, Like, Download, Share)
 * - Content Info Specs card (Type, Audio, Release, Rating) + Genre chips + smart synopsis
 * - Real content-related "More Like This" (same content type & language first, then trending fallback)
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
                    val detail = res.data
                    item = detail
                    inWatchlist = detail.isBookmarked
                    isLiked = detail.isLiked
                    detail.seasons.firstOrNull()?.let { s ->
                        episodes = repository.getSeasonEpisodes(s.id)
                    }
                    // Load content-related titles (same type & language first, then trending fallback)
                    val langParam = detail.language.trim().lowercase().ifBlank { "kannada" }
                    val sameCategory = runCatching {
                        repository.getCategoryItems(detail.typeId, langParam)
                    }.getOrDefault(emptyList()).filter { it.id != contentId }
                    val trendingFallback = runCatching {
                        repository.getTrending()
                    }.getOrDefault(emptyList()).filter { it.id != contentId }
                    related = (sameCategory + trendingFallback).distinctBy { it.id }.take(15)
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
                .background(MaxxColors.AmbientScreenBackground)
                .statusBarsPadding()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            ShimmerBox(modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f), shape = RoundedCornerShape(22.dp))
            ShimmerBox(modifier = Modifier.width(210.dp).height(26.dp))
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
    val contentTypeLabel = formatContentTypeLabel(content.contentType)
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
            .background(MaxxColors.AmbientScreenBackground)
            .statusBarsPadding()
            .navigationBarsPadding(),
        contentPadding = PaddingValues(bottom = 36.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        // 1. Clean Top Bar (Back + Content Type Pill + VIP/RENT Badge)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 18.dp, end = 18.dp, top = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = Color.White.copy(alpha = 0.09f),
                    shape = CircleShape,
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                    modifier = Modifier
                        .size(40.dp)
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

                Surface(
                    color = Color.White.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(999.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f))
                ) {
                    Text(
                        text = contentTypeLabel.uppercase(),
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }

                if (content.isPremium || content.isRent) {
                    Surface(
                        color = MaxxColors.PrimaryTint,
                        shape = RoundedCornerShape(999.dp),
                        border = BorderStroke(1.dp, MaxxColors.Primary.copy(alpha = 0.55f))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Icon(
                                Icons.Rounded.WorkspacePremium,
                                contentDescription = null,
                                tint = MaxxColors.Primary,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = if (content.isRent) "RENT" else "VIP",
                                color = MaxxColors.Primary,
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                } else {
                    Spacer(Modifier.size(40.dp))
                }
            }
        }

        // 2. Uncropped 16:9 Rounded Cinema Banner (landscapeUrl preferred, Alignment.TopCenter so top is NEVER stripped!)
        item {
            Surface(
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
                shadowElevation = 18.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp)
                    .aspectRatio(16f / 9f)
                    .bounceClick { triggerPlay() }
            ) {
                Box(modifier = Modifier.fillMaxSize().background(MaxxColors.SurfaceDark)) {
                    AsyncImage(
                        model = content.landscapeUrl.ifBlank { content.posterUrl },
                        contentDescription = content.title,
                        contentScale = ContentScale.Crop,
                        alignment = Alignment.TopCenter,
                        modifier = Modifier.fillMaxSize()
                    )

                    // Soft bottom gradient for play button & progress legibility
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(90.dp)
                            .align(Alignment.BottomCenter)
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color.Transparent, Color(0xCC0A090E))
                                )
                            )
                    )

                    // Center Golden Glass Play Circle
                    Surface(
                        color = Color.Black.copy(alpha = 0.52f),
                        shape = CircleShape,
                        border = BorderStroke(1.5.dp, MaxxColors.Primary.copy(alpha = 0.85f)),
                        modifier = Modifier
                            .align(Alignment.Center)
                            .size(58.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = "Play",
                                tint = MaxxColors.Primary,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }

                    // Real resume progress bar ONLY when user has watch history
                    if (hasResume) {
                        LinearProgressIndicator(
                            progress = { content.progressPercent.coerceIn(0.03f, 1f) },
                            color = MaxxColors.Primary,
                            trackColor = Color.White.copy(alpha = 0.24f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(4.dp)
                                .align(Alignment.BottomCenter)
                        )
                    }
                }
            }
        }

        // 3. Side-by-Side Portrait Poster + Title & Content Metadata Pills
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp),
                verticalAlignment = Alignment.Top
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
                    modifier = Modifier
                        .width(86.dp)
                        .aspectRatio(2f / 3f)
                ) {
                    AsyncImage(
                        model = content.posterUrl.ifBlank { content.landscapeUrl },
                        contentDescription = content.title,
                        contentScale = ContentScale.Crop,
                        alignment = Alignment.TopCenter,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                Spacer(Modifier.width(14.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = content.title,
                        color = Color.White,
                        fontSize = 23.sp,
                        fontWeight = FontWeight.Black,
                        lineHeight = 27.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(Modifier.height(10.dp))

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        if (content.releaseYear.isNotBlank()) MetaChip(content.releaseYear)
                        if (content.durationLabel.isNotBlank()) MetaChip(content.durationLabel)
                        if (content.language.isNotBlank()) MetaChip(content.language)
                        if (formattedRating.isNotBlank()) MetaChip(formattedRating, highlighted = true)
                        MetaChip("HD")
                    }

                    if (content.genres.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = content.genres.take(3).joinToString(" • "),
                            color = MaxxColors.TextSecondary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }

        // 4. Primary Watch Now CTA + Optional Trailer Button + 4-Column Frosted Action Bar
        item {
            Column(
                modifier = Modifier.padding(horizontal = 18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
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
                                modifier = Modifier.size(23.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = when {
                                    hasResume -> "Resume Watching"
                                    content.isRent && content.rentPrice > 0 -> "Rent for ₹${content.rentPrice.toInt()}"
                                    else -> "Watch Now"
                                },
                                color = MaxxColors.OnPrimaryDark,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }

                    if (content.trailerUrl.isNotBlank()) {
                        Surface(
                            color = Color.White.copy(alpha = 0.09f),
                            shape = RoundedCornerShape(999.dp),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.18f)),
                            modifier = Modifier
                                .height(52.dp)
                                .bounceClick { triggerPlay(null, "${content.title} (Trailer)") }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 18.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Rounded.PlayCircleOutline,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(19.dp)
                                )
                                Spacer(Modifier.width(6.dp))
                                Text("Trailer", color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                // Balanced 4-Column Frosted Action Bar
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
            }
        }

        // 5. Synopsis & Content Info Specs Card
        item {
            val cleanDesc = content.description.trim()
            Column(
                modifier = Modifier.padding(horizontal = 18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                if (cleanDesc.isNotBlank()) {
                    val isLong = cleanDesc.length > 110
                    Column(
                        modifier = if (isLong) Modifier.clickable { expandedSynopsis = !expandedSynopsis } else Modifier
                    ) {
                        Text(
                            text = "Storyline",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(6.dp))
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

                // Content Info Frosted Card (Type, Audio, Release, Rating)
                Surface(
                    color = Color.White.copy(alpha = 0.05f),
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        ContentSpecItem("Format", contentTypeLabel)
                        ContentSpecItem("Audio", content.language.ifBlank { "Original" })
                        ContentSpecItem("Released", content.releaseYear.ifBlank { "2026" })
                        ContentSpecItem("Rating", formattedRating.ifBlank { "U/A 13+" })
                    }
                }
            }
        }

        // 6. Golden / Frosted Glass Pill Tabs + Related Content / Cast / Episodes
        item {
            Column {
                val tabs = buildList {
                    add(0 to "More Like This")
                    add(1 to "Cast & Crew")
                    if (content.seasons.isNotEmpty()) add(2 to "Episodes")
                }
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 18.dp),
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

                Spacer(Modifier.height(16.dp))

                when (activeTab) {
                    0 -> {
                        if (related.isEmpty()) {
                            Text(
                                text = "No similar titles available yet.",
                                color = MaxxColors.TextMuted,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 18.dp)
                            )
                        } else {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 18.dp),
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
                                modifier = Modifier.padding(horizontal = 18.dp)
                            )
                        } else {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 18.dp),
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
                                contentPadding = PaddingValues(horizontal = 18.dp),
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
                            modifier = Modifier.padding(horizontal = 18.dp),
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
                                                alignment = Alignment.TopCenter,
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
private fun ContentSpecItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label.uppercase(),
            color = MaxxColors.TextMuted,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp
        )
        Spacer(Modifier.height(3.dp))
        Text(
            text = value,
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun MetaChip(
    text: String,
    highlighted: Boolean = false
) {
    Surface(
        color = if (highlighted) MaxxColors.PrimaryTint else Color.White.copy(alpha = 0.10f),
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(
            1.dp,
            if (highlighted) MaxxColors.Primary.copy(alpha = 0.55f) else Color.White.copy(alpha = 0.16f)
        )
    ) {
        Text(
            text = text,
            color = if (highlighted) MaxxColors.PrimaryLight else Color.White.copy(alpha = 0.92f),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp)
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
