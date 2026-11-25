package com.maxxpixels.ui.screens.newhot

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.LocalFireDepartment
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun parseIsoDateMs(raw: String): Long? {
    val clean = raw.trim().take(10)
    if (clean.length < 10) return null
    return runCatching {
        SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(clean)?.time
    }.getOrNull()
}

private fun formatShortDate(raw: String): String {
    val ms = parseIsoDateMs(raw) ?: return raw.take(10)
    return runCatching {
        SimpleDateFormat("dd MMM yyyy", Locale.US).format(Date(ms))
    }.getOrDefault(raw.take(10))
}

/**
 * Theme-Synced Frosted-Glass New & Hot Screen:
 * - Warm burgundy-to-black AmbientScreenBackground with cutout-safe top insets
 * - Strictly segregated by active language portal (Kannada vs All-Indian)
 * - Shows "Last 15 Days" recent releases and "Upcoming" scheduled releases
 */
@Composable
fun NewHotScreen(
    repository: MaxxRepository,
    language: String = "kannada",
    onOpenDetails: (Long) -> Unit,
    onPlayItem: (Long, String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var activeTab by remember { mutableIntStateOf(0) } // 0 = Last 15 Days, 1 = Upcoming
    var allItems by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var remindedIds by remember { mutableStateOf(setOf<Long>()) }
    var savedIds by remember { mutableStateOf(setOf<Long>()) }

    LaunchedEffect(language) {
        loading = true
        allItems = repository.getNewAndUpcoming(language)
        loading = false
    }

    val nowMs = remember { System.currentTimeMillis() }
    val fifteenDaysMs = 15L * 24L * 60L * 60L * 1000L

    val upcomingItems = remember(allItems, nowMs) {
        allItems.filter { item ->
            val relMs = parseIsoDateMs(item.releaseDate)
            item.isUpcoming || (relMs != null && relMs > nowMs)
        }.sortedBy { parseIsoDateMs(it.releaseDate) ?: Long.MAX_VALUE }
    }

    val past15DaysItems = remember(allItems, nowMs) {
        val strictRecent = allItems.filter { item ->
            if (item.isUpcoming) return@filter false
            val dateMs = parseIsoDateMs(item.releaseDate) ?: parseIsoDateMs(item.createdAt)
            dateMs != null && dateMs <= nowMs && (nowMs - dateMs) <= fifteenDaysMs
        }.sortedByDescending { parseIsoDateMs(it.releaseDate) ?: parseIsoDateMs(it.createdAt) ?: 0L }

        // If backend items omit exact timestamps, sort newest non-upcoming releases as fallback
        if (strictRecent.isNotEmpty()) strictRecent
        else allItems.filter { !it.isUpcoming }
            .sortedByDescending { parseIsoDateMs(it.releaseDate) ?: parseIsoDateMs(it.createdAt) ?: it.id }
            .take(15)
    }

    val visibleList = if (activeTab == 0) past15DaysItems else upcomingItems
    val portalLabel = if (language.equals("kannada", true)) "Kannada" else "All Indian"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
            .windowInsetsPadding(
                WindowInsets.statusBars.union(WindowInsets.displayCutout).only(WindowInsetsSides.Top)
            )
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(MaxxColors.PrimaryTint),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.LocalFireDepartment,
                        contentDescription = null,
                        tint = MaxxColors.Primary,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(
                        text = "New & Hot",
                        color = Color.White,
                        fontSize = 21.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "$portalLabel Releases",
                        color = MaxxColors.TextSecondary,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        // Golden / Frosted Filter Pills (Last 15 Days | Upcoming)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            val pills = listOf(
                0 to "Latest (${past15DaysItems.size})",
                1 to "Upcoming (${upcomingItems.size})"
            )
            pills.forEach { (idx, label) ->
                val selected = activeTab == idx
                if (selected) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(999.dp))
                            .background(MaxxColors.BrandGradient)
                            .clickable { activeTab = idx }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
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
                        modifier = Modifier
                            .weight(1f)
                            .clickable { activeTab = idx }
                    ) {
                        Text(
                            text = label,
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(vertical = 10.dp)
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(10.dp))

        if (loading) {
            Column(
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                repeat(2) {
                    ShimmerBox(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 10f),
                        shape = RoundedCornerShape(22.dp)
                    )
                }
            }
        } else if (visibleList.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 96.dp),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    color = Color.White.copy(alpha = 0.06f),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                    modifier = Modifier.padding(24.dp)
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(28.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.PrimaryTint),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (activeTab == 1) Icons.Rounded.CalendarMonth else Icons.Rounded.LocalFireDepartment,
                                contentDescription = null,
                                tint = MaxxColors.Primary,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                        Spacer(Modifier.height(14.dp))
                        Text(
                            text = if (activeTab == 1) "No upcoming releases yet" else "No latest releases yet",
                            color = Color.White,
                            fontSize = 16.5.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "New $portalLabel movies, series, and originals will appear here automatically.",
                            color = MaxxColors.TextSecondary,
                            fontSize = 12.5.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 6.dp, bottom = 112.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(visibleList, key = { "nh_${activeTab}_${it.id}" }) { item ->
                    val isUpcomingCard = activeTab == 1 || item.isUpcoming
                    val isReminded = item.id in remindedIds
                    val isSaved = item.id in savedIds || item.isBookmarked
                    val dateStr = item.releaseDate.ifBlank { item.createdAt }
                    val formattedDate = if (dateStr.isNotBlank()) formatShortDate(dateStr) else item.releaseYear

                    Surface(
                        color = Color.White.copy(alpha = 0.07f),
                        shape = RoundedCornerShape(22.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
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
                                    alignment = Alignment.TopCenter,
                                    modifier = Modifier.fillMaxSize()
                                )
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(74.dp)
                                        .align(Alignment.BottomCenter)
                                        .background(
                                            Brush.verticalGradient(
                                                listOf(Color.Transparent, Color(0xE614111B))
                                            )
                                        )
                                )

                                // Top-left Status Badge (UPCOMING / NEW)
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopStart)
                                        .padding(12.dp)
                                        .clip(RoundedCornerShape(999.dp))
                                        .background(
                                            if (isUpcomingCard) Color.Black.copy(alpha = 0.65f)
                                            else MaxxColors.Primary
                                        )
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = if (isUpcomingCard) "UPCOMING" else "NEW",
                                        color = if (isUpcomingCard) MaxxColors.Primary else MaxxColors.OnPrimaryDark,
                                        fontSize = 9.5.sp,
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = 0.8.sp
                                    )
                                }

                                // Top-right Date or Access Badge
                                if (formattedDate.isNotBlank()) {
                                    Surface(
                                        color = Color.Black.copy(alpha = 0.6f),
                                        shape = RoundedCornerShape(999.dp),
                                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(12.dp)
                                    ) {
                                        Text(
                                            text = formattedDate,
                                            color = Color.White,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            }

                            Column(modifier = Modifier.padding(horizontal = 15.dp, vertical = 13.dp)) {
                                Text(
                                    text = item.title,
                                    color = Color.White,
                                    fontSize = 17.5.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )

                                val meta = listOfNotNull(
                                    item.language.takeIf { it.isNotBlank() },
                                    item.durationLabel.takeIf { it.isNotBlank() },
                                    item.releaseYear.takeIf { it.isNotBlank() }
                                ).joinToString(" • ")
                                if (meta.isNotBlank()) {
                                    Spacer(Modifier.height(3.dp))
                                    Text(
                                        text = meta,
                                        color = MaxxColors.PrimaryLight.copy(alpha = 0.9f),
                                        fontSize = 11.5.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
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

                                Spacer(Modifier.height(13.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(9.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // Primary Golden Pill CTA
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(42.dp)
                                            .clip(RoundedCornerShape(999.dp))
                                            .background(MaxxColors.BrandGradient)
                                            .clickable {
                                                if (isUpcomingCard) {
                                                    remindedIds = if (isReminded) remindedIds - item.id else remindedIds + item.id
                                                    Toast.makeText(
                                                        context,
                                                        if (!isReminded) "Reminder set for ${item.title}" else "Reminder removed",
                                                        Toast.LENGTH_SHORT
                                                    ).show()
                                                } else {
                                                    onPlayItem(item.id, item.title)
                                                }
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (isUpcomingCard) {
                                                    if (isReminded) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsNone
                                                } else Icons.Rounded.PlayArrow,
                                                contentDescription = null,
                                                tint = MaxxColors.OnPrimaryDark,
                                                modifier = Modifier.size(18.dp)
                                            )
                                            Text(
                                                text = if (isUpcomingCard) {
                                                    if (isReminded) "Reminded" else "Remind Me"
                                                } else "Watch Now",
                                                color = MaxxColors.OnPrimaryDark,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.ExtraBold
                                            )
                                        }
                                    }

                                    // Frosted Watchlist Circle
                                    Surface(
                                        color = Color.White.copy(alpha = 0.09f),
                                        shape = CircleShape,
                                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                                        modifier = Modifier
                                            .size(42.dp)
                                            .clickable {
                                                val next = !isSaved
                                                savedIds = if (next) savedIds + item.id else savedIds - item.id
                                                Toast.makeText(
                                                    context,
                                                    if (next) "Added to Watchlist" else "Removed from Watchlist",
                                                    Toast.LENGTH_SHORT
                                                ).show()
                                                scope.launch { repository.toggleWatchlist(item.id, item.title, next) }
                                            }
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

                                    // Frosted Share Circle
                                    Surface(
                                        color = Color.White.copy(alpha = 0.09f),
                                        shape = CircleShape,
                                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                                        modifier = Modifier
                                            .size(42.dp)
                                            .clickable {
                                                val slugOrId = item.slug.ifBlank { item.id.toString() }
                                                val shareUrl = "https://maxxpixels.com/watch/$slugOrId"
                                                val intent = Intent(Intent.ACTION_SEND).apply {
                                                    type = "text/plain"
                                                    putExtra(Intent.EXTRA_SUBJECT, item.title)
                                                    putExtra(Intent.EXTRA_TEXT, "Watch \"${item.title}\" on MaxxPixels!\n\n$shareUrl")
                                                }
                                                context.startActivity(Intent.createChooser(intent, "Share ${item.title}"))
                                            }
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = Icons.Rounded.Share,
                                                contentDescription = "Share",
                                                tint = Color.White,
                                                modifier = Modifier.size(18.dp)
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
