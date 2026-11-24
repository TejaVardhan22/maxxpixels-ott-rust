package com.maxxpixels.ui.screens.details

import android.content.Intent
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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

/**
 * 1:1 Replication of React Native DetailsScreen (apps/mobile/src/screens/DetailsScreen/DetailsScreen.tsx):
 * 16:9 backdrop with back arrow + vignette, title & metadata, #E50914 Play button,
 * My List / Download / Share action row, expandable synopsis, and More Like This / Cast / Episodes tabs.
 */
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            ShimmerBox(modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f), shape = RoundedCornerShape(10.dp))
            ShimmerBox(modifier = Modifier.width(200.dp).height(24.dp))
            ShimmerBox(modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(10.dp))
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

    fun triggerPlay() {
        if (session?.hasActiveSubscription == true) {
            onPlay(content.id, null, content.title)
        } else {
            onRequireSubscription()
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .navigationBarsPadding(),
        contentPadding = PaddingValues(bottom = 36.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 16:9 Backdrop + Back Button
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(275.dp)
            ) {
                AsyncImage(
                    model = content.landscapeUrl.ifBlank { content.posterUrl },
                    contentDescription = content.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp)
                        .align(Alignment.BottomCenter)
                        .background(Brush.verticalGradient(listOf(Color.Transparent, MaxxColors.CinemaBlack)))
                )
                Box(
                    modifier = Modifier
                        .statusBarsPadding()
                        .padding(14.dp)
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.55f))
                        .clickable(onClick = onBack),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White, modifier = Modifier.size(20.dp))
                }
            }
        }

        // Title, Metadata, #E50914 Play Button, Action Icons, Synopsis
        item {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                Text(
                    text = content.title,
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    lineHeight = 28.sp
                )
                Spacer(Modifier.height(6.dp))
                val meta = listOfNotNull(
                    content.releaseYear.takeIf { it.isNotBlank() },
                    content.durationLabel.takeIf { it.isNotBlank() },
                    content.language.takeIf { it.isNotBlank() },
                    content.maturityRating.takeIf { it.isNotBlank() }
                ).joinToString(" • ")
                if (meta.isNotBlank()) {
                    Text(meta, color = MaxxColors.TextSecondary, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(Modifier.height(16.dp))

                // Primary RN Red (#E50914) Play Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaxxColors.Primary)
                        .bounceClick { triggerPlay() },
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(22.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Play Now", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(Modifier.height(16.dp))

                // RN Action Row: My List | Download | Share
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    RnDetailAction(
                        icon = if (inWatchlist) Icons.Rounded.Check else Icons.Rounded.Add,
                        label = if (inWatchlist) "In List" else "My List",
                        tint = if (inWatchlist) MaxxColors.Primary else Color.White,
                        onClick = {
                            val next = !inWatchlist
                            inWatchlist = next
                            scope.launch { repository.toggleWatchlist(content.id, content.title, next) }
                        }
                    )
                    RnDetailAction(
                        icon = Icons.Rounded.Download,
                        label = "Download",
                        onClick = { triggerPlay() }
                    )
                    RnDetailAction(
                        icon = Icons.Rounded.Share,
                        label = "Share",
                        onClick = {
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, "Watch ${content.title} on MaxxPixels!")
                            }
                            context.startActivity(Intent.createChooser(intent, "Share"))
                        }
                    )
                }

                if (content.description.isNotBlank()) {
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.clickable { expandedSynopsis = !expandedSynopsis }) {
                        Text(
                            text = content.description,
                            color = MaxxColors.TextSecondary,
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                            maxLines = if (expandedSynopsis) 12 else 3,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = if (expandedSynopsis) "Show less" else "More",
                            color = MaxxColors.Primary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Tabs: More Like This | Cast & Crew | Episodes
        item {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    val tabs = buildList {
                        add(0 to "More Like This")
                        add(1 to "Cast & Crew")
                        if (content.seasons.isNotEmpty()) add(2 to "Episodes")
                    }
                    tabs.forEach { (idx, label) ->
                        val active = activeTab == idx
                        Column(
                            modifier = Modifier.clickable { activeTab = idx },
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = label,
                                color = if (active) Color.White else MaxxColors.TextSecondary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(8.dp))
                            Box(
                                modifier = Modifier
                                    .width(if (active) 90.dp else 0.dp)
                                    .height(2.5.dp)
                                    .background(MaxxColors.Primary)
                            )
                        }
                    }
                }
                HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
            }
        }

        when (activeTab) {
            0 -> {
                val rows = related.chunked(3)
                items(rows.indices.toList(), key = { "rel_row_$it" }) { rowIdx ->
                    val trio = rows[rowIdx]
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        trio.forEach { rel ->
                            PortraitPosterCard(
                                item = rel,
                                onClick = { onOpenDetails(rel.id) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        repeat(3 - trio.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            1 -> {
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(content.cast) { c ->
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.width(74.dp)
                            ) {
                                if (c.photoUrl.isNotBlank()) {
                                    AsyncImage(
                                        model = c.photoUrl,
                                        contentDescription = c.name,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier
                                            .size(62.dp)
                                            .clip(CircleShape)
                                            .background(MaxxColors.SurfaceDark)
                                    )
                                } else {
                                    Box(
                                        modifier = Modifier
                                            .size(62.dp)
                                            .clip(CircleShape)
                                            .background(MaxxColors.SurfaceElevated),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(c.name.firstOrNull()?.uppercase() ?: "C", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                    }
                                }
                                Spacer(Modifier.height(6.dp))
                                Text(c.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(c.role, color = MaxxColors.TextMuted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
            else -> {
                if (content.seasons.size > 1) {
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(content.seasons.indices.toList()) { idx ->
                                val s = content.seasons[idx]
                                val active = idx == activeSeasonIdx
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (active) MaxxColors.Primary else MaxxColors.SurfaceDark)
                                        .clickable {
                                            activeSeasonIdx = idx
                                            scope.launch { episodes = repository.getSeasonEpisodes(s.id) }
                                        }
                                        .padding(horizontal = 14.dp, vertical = 7.dp)
                                ) {
                                    Text(s.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
                items(episodes, key = { it.id }) { ep ->
                    Surface(
                        color = MaxxColors.SurfaceDark,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .bounceClick {
                                if (session?.hasActiveSubscription == true) {
                                    onPlay(content.id, ep.id, ep.name)
                                } else {
                                    onRequireSubscription()
                                }
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            AsyncImage(
                                model = ep.thumbnailUrl.ifBlank { content.landscapeUrl },
                                contentDescription = ep.name,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .width(118.dp)
                                    .aspectRatio(16f / 9f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MaxxColors.CinemaBlack)
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(ep.name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                if (ep.durationLabel.isNotBlank()) {
                                    Text(ep.durationLabel, color = MaxxColors.TextMuted, fontSize = 11.sp)
                                }
                                if (ep.description.isNotBlank()) {
                                    Spacer(Modifier.height(3.dp))
                                    Text(ep.description, color = MaxxColors.TextSecondary, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
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
private fun RnDetailAction(
    icon: ImageVector,
    label: String,
    tint: Color = Color.White,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(5.dp))
        Text(label, color = MaxxColors.TextSecondary, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
    }
}
