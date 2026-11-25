package com.maxxpixels.ui.screens.newhot

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.ShimmerBox
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

/**
 * 1:1 Replication of React Native NewHotScreen (apps/mobile/src/screens/NewHotScreen/NewHotScreen.tsx):
 * Filter tabs (🔥 All New, 🗓️ Coming Soon, 🍿 Everyone's Watching, 🏆 Top 10) +
 * 16:9 showcase cards with Remind Me, My List, Share, and Play actions.
 */
@Composable
fun NewHotScreen(
    repository: MaxxRepository,
    onOpenDetails: (Long) -> Unit,
    onPlayItem: (Long, String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val tabs = listOf(
        "all" to "🔥 All New",
        "coming_soon" to "🗓️ Coming Soon",
        "trending" to "🍿 Everyone's Watching",
        "top10" to "🏆 Top 10"
    )
    var activeTab by remember { mutableStateOf("all") }
    var items by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var remindedIds by remember { mutableStateOf(setOf<Long>()) }
    var savedIds by remember { mutableStateOf(setOf<Long>()) }

    LaunchedEffect(Unit) {
        loading = true
        items = repository.getTrending()
        loading = false
    }

    val filtered = when (activeTab) {
        "top10" -> items.take(10)
        "coming_soon" -> items.reversed().take(10)
        else -> items
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
    ) {
        // Header
        Text(
            text = "New & Hot",
            color = Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )

        // Horizontal Pill Tabs
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            items(tabs) { (key, label) ->
                val selected = activeTab == key
                Surface(
                    color = if (selected) Color.White else MaxxColors.SurfaceDark,
                    shape = RoundedCornerShape(99.dp),
                    border = BorderStroke(1.dp, if (selected) Color.White else MaxxColors.BorderSubtle),
                    modifier = Modifier.clickable { activeTab = key }
                ) {
                    Text(
                        text = label,
                        color = if (selected) MaxxColors.CinemaBlack else MaxxColors.TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                    )
                }
            }
        }

        if (loading) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                repeat(2) {
                    ShimmerBox(modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f), shape = RoundedCornerShape(14.dp))
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(filtered, key = { "nh_${it.id}" }) { item ->
                    val isReminded = item.id in remindedIds
                    val isSaved = item.id in savedIds || item.isBookmarked

                    Surface(
                        color = MaxxColors.SurfaceDark,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                        modifier = Modifier
                            .fillMaxWidth()
                            .bounceClick(scaleDown = 0.985f) { onOpenDetails(item.id) }
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
                                        .fillMaxWidth()
                                        .height(64.dp)
                                        .align(Alignment.BottomCenter)
                                        .background(
                                            Brush.verticalGradient(listOf(Color.Transparent, MaxxColors.SurfaceDark))
                                        )
                                )
                                if (item.isPremium) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(10.dp)
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(MaxxColors.Primary)
                                            .padding(horizontal = 8.dp, vertical = 3.dp)
                                    ) {
                                        Text("VIP", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
                                    }
                                }
                            }

                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = item.title,
                                        color = Color.White,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                        Icon(
                                            imageVector = if (isReminded) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsNone,
                                            contentDescription = "Remind Me",
                                            tint = if (isReminded) MaxxColors.Primary else MaxxColors.TextSecondary,
                                            modifier = Modifier
                                                .size(20.dp)
                                                .clickable {
                                                    remindedIds = if (isReminded) remindedIds - item.id else remindedIds + item.id
                                                }
                                        )
                                        Icon(
                                            imageVector = if (isSaved) Icons.Rounded.Check else Icons.Rounded.Add,
                                            contentDescription = "Watchlist",
                                            tint = if (isSaved) MaxxColors.Primary else MaxxColors.TextSecondary,
                                            modifier = Modifier
                                                .size(20.dp)
                                                .clickable {
                                                    val next = !isSaved
                                                    savedIds = if (next) savedIds + item.id else savedIds - item.id
                                                    scope.launch { repository.toggleWatchlist(item.id, item.title, next) }
                                                }
                                        )
                                        Icon(
                                            imageVector = Icons.Rounded.Share,
                                            contentDescription = "Share",
                                            tint = MaxxColors.TextSecondary,
                                            modifier = Modifier
                                                .size(19.dp)
                                                .clickable {
                                                    val intent = Intent(Intent.ACTION_SEND).apply {
                                                        type = "text/plain"
                                                        putExtra(Intent.EXTRA_TEXT, "Watch ${item.title} on MaxxPixels!")
                                                    }
                                                    context.startActivity(Intent.createChooser(intent, "Share"))
                                                }
                                        )
                                    }
                                }

                                if (item.description.isNotBlank()) {
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        text = item.description,
                                        color = MaxxColors.TextSecondary,
                                        fontSize = 12.5.sp,
                                        lineHeight = 18.sp,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                Spacer(Modifier.height(12.dp))

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(40.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(MaxxColors.Primary)
                                        .clickable { onPlayItem(item.id, item.title) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(5.dp))
                                        Text("Watch Now", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
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
