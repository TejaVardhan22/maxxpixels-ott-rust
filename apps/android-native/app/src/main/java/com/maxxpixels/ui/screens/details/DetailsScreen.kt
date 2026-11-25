package com.maxxpixels.ui.screens.details

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.maxxpixels.data.model.CreatedOrder
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
 * Overlapping Frosted-Glass Cinema Details Screen:
 * - Full-bleed top hero with TopCenter alignment (never cuts off actor heads), frosted collapse chevron,
 *   center Play circle, and sleek mini scrubber bar (without stop-dot artifact)
 * - Overlapping 28.dp rounded warm frosted sheet with drag handle, formatted metadata (U/A 13+),
 *   single-row Golden Pill Watch Now / Rent CTA + 3 circular frosted actions (My List, Download, Share),
 *   smart synopsis, Golden/Glass pill tabs, category-matched Watch Similar rail, and full TVOD Razorpay flow.
 */
@Composable
fun DetailsScreen(
    contentId: Long,
    repository: MaxxRepository,
    onBack: () -> Unit,
    onOpenDetails: (Long) -> Unit,
    onPlay: (contentId: Long, episodeId: Long?, title: String) -> Unit,
    onRequireSubscription: () -> Unit,
    onLaunchTvodRazorpay: (CreatedOrder, CatalogItem, onUnlocked: () -> Unit) -> Unit = { _, _, _ -> }
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

    // TVOD Rental / Purchase Sheet State
    var showTvodDialog by remember { mutableStateOf(false) }
    var tvodMode by remember { mutableStateOf("RENT") } // "RENT" | "PURCHASE"
    var tvodLoading by remember { mutableStateOf(false) }
    var tvodError by remember { mutableStateOf("") }
    var rentUnlocked by remember { mutableStateOf(false) }

    // Plan-gated Offline Download state (hidden unless user's active plan includes offline downloads)
    var canOfflineDownload by remember { mutableStateOf(false) }
    var isDownloading by remember { mutableStateOf(false) }
    var isDownloaded by remember { mutableStateOf(false) }

    LaunchedEffect(session?.id, session?.hasActiveSubscription, session?.packageName) {
        if (session?.hasActiveSubscription == true) {
            canOfflineDownload = when (val plansRes = repository.getPlans()) {
                is ApiResult.Success -> {
                    val activePlan = plansRes.data.firstOrNull { it.isActivePlan }
                        ?: plansRes.data.firstOrNull {
                            !session?.packageName.isNullOrBlank() &&
                                it.name.equals(session?.packageName, ignoreCase = true)
                        }
                    activePlan?.allowOfflineDownload == true
                }
                is ApiResult.Error -> false
            }
        } else {
            canOfflineDownload = false
        }
    }

    fun load() {
        loading = true
        errorMsg = null
        scope.launch {
            when (val res = repository.getContentDetail(contentId)) {
                is ApiResult.Success -> {
                    val detail = res.data
                    item = detail
                    inWatchlist = detail.isBookmarked
                    rentUnlocked = detail.isPurchased
                    detail.seasons.firstOrNull()?.let { s ->
                        episodes = repository.getSeasonEpisodes(s.id)
                    }
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
            ShimmerBox(modifier = Modifier.fillMaxWidth().height(340.dp), shape = RoundedCornerShape(24.dp))
            ShimmerBox(modifier = Modifier.width(210.dp).height(26.dp))
            ShimmerBox(modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(999.dp))
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
        if (content.isRent && !rentUnlocked) {
            tvodError = ""
            showTvodDialog = true
            return
        }
        if (session?.hasActiveSubscription == true || rentUnlocked || !content.isPremium) {
            onPlay(content.id, episodeId, titleOverride)
        } else {
            onRequireSubscription()
        }
    }

    // TVOD Rent / Purchase Modal (real backend prices only — no dummy fallbacks)
    if (showTvodDialog) {
        val rentAmt = content.rentPrice.toInt()
        val buyAmt = content.purchasePrice.toInt()
        val effectiveMode = when {
            tvodMode == "PURCHASE" && buyAmt > 0 -> "PURCHASE"
            tvodMode == "RENT" && rentAmt > 0 -> "RENT"
            rentAmt > 0 -> "RENT"
            buyAmt > 0 -> "PURCHASE"
            else -> "RENT"
        }
        val activeAmt = if (effectiveMode == "PURCHASE") buyAmt else rentAmt
        val activeLabel = if (effectiveMode == "PURCHASE") "Buy" else "Rent"

        AlertDialog(
            onDismissRequest = { if (!tvodLoading) showTvodDialog = false },
            containerColor = Color(0xFF1A151E),
            shape = RoundedCornerShape(24.dp),
            title = {
                Column {
                    Surface(
                        color = MaxxColors.PrimaryTint,
                        shape = RoundedCornerShape(999.dp),
                        border = BorderStroke(1.dp, MaxxColors.Primary.copy(alpha = 0.5f))
                    ) {
                        Text(
                            text = "RENT OR PURCHASE (TVOD)",
                            color = MaxxColors.PrimaryLight,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.8.sp,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = content.title,
                        color = Color.White,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (rentAmt > 0) {
                        val rentSelected = effectiveMode == "RENT"
                        Surface(
                            color = if (rentSelected) Color(0xFF281D1B) else Color.White.copy(alpha = 0.05f),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(
                                if (rentSelected) 1.6.dp else 1.dp,
                                if (rentSelected) MaxxColors.Primary else Color.White.copy(alpha = 0.12f)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { tvodMode = "RENT"; tvodError = "" }
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Rent (48 Hours)", color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
                                    Text("Watch in Full HD within 48h of start", color = MaxxColors.TextSecondary, fontSize = 11.5.sp)
                                }
                                Text("₹$rentAmt", color = MaxxColors.Primary, fontSize = 20.sp, fontWeight = FontWeight.Black)
                            }
                        }
                    }

                    if (buyAmt > 0) {
                        val buySelected = effectiveMode == "PURCHASE"
                        Surface(
                            color = if (buySelected) Color(0xFF281D1B) else Color.White.copy(alpha = 0.05f),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(
                                if (buySelected) 1.6.dp else 1.dp,
                                if (buySelected) MaxxColors.Primary else Color.White.copy(alpha = 0.12f)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { tvodMode = "PURCHASE"; tvodError = "" }
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Purchase (Own Forever)", color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
                                    Text("Unlimited lifetime Full HD streaming", color = MaxxColors.TextSecondary, fontSize = 11.5.sp)
                                }
                                Text("₹$buyAmt", color = MaxxColors.Primary, fontSize = 20.sp, fontWeight = FontWeight.Black)
                            }
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.VerifiedUser, null, tint = MaxxColors.Success, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Secured by Razorpay • Instant unlock", color = MaxxColors.TextMuted, fontSize = 11.sp)
                    }

                    if (tvodError.isNotBlank()) {
                        Text(tvodError, color = MaxxColors.ErrorSoft, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(MaxxColors.BrandGradient)
                        .clickable(enabled = !tvodLoading && activeAmt > 0) {
                            tvodLoading = true
                            tvodError = ""
                            scope.launch {
                                when (val orderRes = repository.createTvodOrder(content.id, activeAmt.toDouble(), effectiveMode)) {
                                    is ApiResult.Success -> {
                                        tvodLoading = false
                                        val order = orderRes.data
                                        if (order.isFree) {
                                            rentUnlocked = true
                                            showTvodDialog = false
                                            onPlay(content.id, null, content.title)
                                        } else {
                                            showTvodDialog = false
                                            onLaunchTvodRazorpay(order, content) {
                                                rentUnlocked = true
                                                onPlay(content.id, null, content.title)
                                            }
                                        }
                                    }
                                    is ApiResult.Error -> {
                                        tvodLoading = false
                                        tvodError = orderRes.message
                                    }
                                }
                            }
                        }
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    if (tvodLoading) {
                        CircularProgressIndicator(
                            color = MaxxColors.OnPrimaryDark,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(16.dp)
                        )
                    } else {
                        Text(
                            text = "$activeLabel ₹$activeAmt & Watch",
                            color = MaxxColors.OnPrimaryDark,
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { if (!tvodLoading) showTvodDialog = false }) {
                    Text("Cancel", color = MaxxColors.TextSecondary, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
            .navigationBarsPadding(),
        contentPadding = PaddingValues(bottom = 36.dp)
    ) {
        // 1. Edge-to-Edge Tall Hero Banner (4:3 cinema proportion, occupies full top without burgundy gap)
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clickable { triggerPlay() }
            ) {
                AsyncImage(
                    model = content.landscapeUrl.ifBlank { content.posterUrl },
                    contentDescription = content.title,
                    contentScale = ContentScale.Crop,
                    alignment = Alignment.TopCenter,
                    modifier = Modifier.fillMaxSize()
                )

                // Short smooth bottom fade into the details section (no card border)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(72.dp)
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    Color.Transparent,
                                    Color(0xAA1A1219),
                                    Color(0xFF1A1219)
                                )
                            )
                        )
                )

                // Top-left circular frosted back chevron (clears status bar & camera notch)
                Surface(
                    color = Color.Black.copy(alpha = 0.44f),
                    shape = CircleShape,
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.22f)),
                    modifier = Modifier
                        .windowInsetsPadding(
                            WindowInsets.statusBars.union(WindowInsets.displayCutout).only(WindowInsetsSides.Top)
                        )
                        .padding(14.dp)
                        .size(40.dp)
                        .clickable(onClick = onBack)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Rounded.KeyboardArrowDown,
                            contentDescription = "Back",
                            tint = Color.White,
                            modifier = Modifier.size(23.dp)
                        )
                    }
                }

                // Center Play Circle
                Surface(
                    color = Color.Black.copy(alpha = 0.45f),
                    shape = CircleShape,
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.28f)),
                    modifier = Modifier
                        .align(Alignment.Center)
                        .size(58.dp)
                        .bounceClick { triggerPlay() }
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Rounded.PlayArrow,
                            contentDescription = "Play",
                            tint = MaxxColors.Primary,
                            modifier = Modifier.size(30.dp)
                        )
                    }
                }
            }
        }

        // 2. Smooth Inline Details Section (transparent over continuous burgundy-to-black gradient)
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0.0f to Color(0xFF1A1219),
                                0.35f to Color(0xFF0E0C12),
                                1.0f to MaxxColors.CinemaBlack
                            )
                        )
                    )
                    .padding(top = 4.dp, bottom = 8.dp)
            ) {
                // Title, Creator Name (if available), Formatted Metadata, Watch Now + 3 Frosted Action Circles, Smart Synopsis
                Column(modifier = Modifier.padding(horizontal = 18.dp)) {
                    Text(
                        text = content.title,
                        color = Color.White,
                        fontSize = 25.sp,
                        fontWeight = FontWeight.Black,
                        lineHeight = 30.sp
                    )
                    if (content.creatorName.isNotBlank()) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "By ${content.creatorName}",
                            color = MaxxColors.PrimaryLight,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    val meta = listOfNotNull(
                        content.releaseYear.takeIf { it.isNotBlank() },
                        content.durationLabel.takeIf { it.isNotBlank() },
                        content.language.takeIf { it.isNotBlank() },
                        formattedRating.takeIf { it.isNotBlank() }
                    ).joinToString(" • ")
                    if (meta.isNotBlank()) {
                        Text(
                            text = meta,
                            color = MaxxColors.TextSecondary,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Spacer(Modifier.height(16.dp))

                        // Golden Amber Pill CTA + Circular Frosted Action Buttons
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(50.dp)
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
                                        modifier = Modifier.size(22.dp)
                                    )
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        text = when {
                                            content.isRent && !rentUnlocked -> when {
                                                content.rentPrice > 0 && content.purchasePrice > 0 -> "Rent ₹${content.rentPrice.toInt()} / Buy"
                                                content.rentPrice > 0 -> "Rent ₹${content.rentPrice.toInt()}"
                                                content.purchasePrice > 0 -> "Buy ₹${content.purchasePrice.toInt()}"
                                                else -> "Rent / Buy"
                                            }
                                            hasResume -> "Resume"
                                            else -> "Watch Now"
                                        },
                                        color = MaxxColors.OnPrimaryDark,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }

                            FrostedActionCircle(
                                icon = if (inWatchlist) Icons.Rounded.Check else Icons.Rounded.Add,
                                tint = if (inWatchlist) MaxxColors.Primary else Color.White,
                                onClick = {
                                    val next = !inWatchlist
                                    inWatchlist = next
                                    Toast.makeText(
                                        context,
                                        if (next) "Added to Watchlist" else "Removed from Watchlist",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                    scope.launch { repository.toggleWatchlist(content.id, content.title, next) }
                                }
                            )
                            // Offline Download button — shown ONLY if user's active plan includes offline downloads
                            if (canOfflineDownload) {
                                FrostedActionCircle(
                                    icon = if (isDownloaded) Icons.Rounded.Check else Icons.Rounded.Download,
                                    tint = if (isDownloaded) MaxxColors.Primary else Color.White,
                                    onClick = {
                                        if (isDownloading) return@FrostedActionCircle
                                        isDownloading = true
                                        scope.launch {
                                            when (val auth = repository.authorizePlayback(content.id, null)) {
                                                is ApiResult.Success -> {
                                                    val url = auth.data.streamUrl
                                                    if (url.startsWith("http", ignoreCase = true)) {
                                                        runCatching {
                                                            val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                                                            val safeName = content.title.replace(Regex("[^A-Za-z0-9._-]"), "_").take(40)
                                                            val ext = if (url.contains(".m3u8", true)) "m3u8" else "mp4"
                                                            val req = DownloadManager.Request(Uri.parse(url))
                                                                .setTitle(content.title)
                                                                .setDescription("Downloading for offline viewing on MaxxPixels")
                                                                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                                                .setDestinationInExternalFilesDir(
                                                                    context,
                                                                    Environment.DIRECTORY_DOWNLOADS,
                                                                    "${safeName}_${content.id}.$ext"
                                                                )
                                                            dm.enqueue(req)
                                                            isDownloaded = true
                                                            Toast.makeText(context, "Downloading ${content.title}...", Toast.LENGTH_SHORT).show()
                                                        }.onFailure { err ->
                                                            Toast.makeText(context, err.message ?: "Download failed", Toast.LENGTH_SHORT).show()
                                                        }
                                                    } else {
                                                        Toast.makeText(context, "Offline stream not available for this title", Toast.LENGTH_SHORT).show()
                                                    }
                                                }
                                                is ApiResult.Error -> {
                                                    Toast.makeText(context, auth.message, Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                            isDownloading = false
                                        }
                                    }
                                )
                            }
                            FrostedActionCircle(
                                icon = Icons.Rounded.Share,
                                onClick = {
                                    val slugOrId = content.slug.ifBlank { content.id.toString() }
                                    val shareUrl = "https://maxxpixels.com/watch/$slugOrId"
                                    val snippet = content.description.trim().take(120)
                                    val shareBody = buildString {
                                        append("Watch \"${content.title}\" on MaxxPixels!")
                                        if (snippet.isNotBlank()) {
                                            append("\n\n")
                                            append(snippet)
                                            if (content.description.trim().length > 120) append("...")
                                        }
                                        append("\n\n")
                                        append(shareUrl)
                                    }
                                    val intent = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_SUBJECT, content.title)
                                        putExtra(Intent.EXTRA_TEXT, shareBody)
                                    }
                                    context.startActivity(Intent.createChooser(intent, "Share ${content.title}"))
                                }
                            )
                        }

                        // Description / Storyline
                        val cleanDesc = content.description.trim()
                        if (cleanDesc.isNotBlank()) {
                            Spacer(Modifier.height(16.dp))
                            Text(
                                text = "Storyline",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(5.dp))
                            val isLong = cleanDesc.length > 120
                            Column(
                                modifier = if (isLong) Modifier.clickable { expandedSynopsis = !expandedSynopsis } else Modifier
                            ) {
                                Text(
                                    text = cleanDesc,
                                    color = MaxxColors.TextSecondary,
                                    fontSize = 13.sp,
                                    lineHeight = 19.sp,
                                    maxLines = if (expandedSynopsis || !isLong) 12 else 3,
                                    overflow = TextOverflow.Ellipsis
                                )
                                if (isLong) {
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        text = if (expandedSynopsis) "Show less" else "Read more",
                                        color = MaxxColors.Primary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    // Inline Cast & Crew strip related to this content (always visible when cast exists)
                    if (content.cast.isNotEmpty()) {
                        Spacer(Modifier.height(18.dp))
                        Text(
                            text = "Cast & Crew",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 18.dp)
                        )
                        Spacer(Modifier.height(10.dp))
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 18.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(content.cast) { member ->
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier.width(74.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(58.dp)
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
                                                fontSize = 18.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                    Spacer(Modifier.height(5.dp))
                                    Text(
                                        text = member.name,
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (member.role.isNotBlank()) {
                                        Text(
                                            text = member.role,
                                            color = MaxxColors.TextMuted,
                                            fontSize = 9.5.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    // Golden / Frosted Pill Tabs
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
                                        .padding(horizontal = 18.dp, vertical = 9.dp)
                                ) {
                                    Text(
                                        text = label,
                                        color = MaxxColors.OnPrimaryDark,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
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
                                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 9.dp)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(18.dp))

                    // Tab Body
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
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 18.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Watch Similar",
                                        color = Color.White,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "See All",
                                        color = MaxxColors.TextSecondary,
                                        fontSize = 12.5.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                                Spacer(Modifier.height(12.dp))
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
                                            modifier = Modifier.width(78.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(64.dp)
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
                                                        fontSize = 20.sp,
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
                                        color = MaxxColors.SurfaceElevated,
                                        shape = RoundedCornerShape(16.dp),
                                        border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
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
                                                    .width(120.dp)
                                                    .aspectRatio(16f / 9f)
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(MaxxColors.SurfaceDark)
                                            ) {
                                                AsyncImage(
                                                    model = ep.thumbnailUrl.ifBlank { content.landscapeUrl },
                                                    contentDescription = ep.name,
                                                    contentScale = ContentScale.Crop,
                                                    alignment = Alignment.TopCenter,
                                                    modifier = Modifier.fillMaxSize()
                                                )
                                                Icon(
                                                    Icons.Rounded.PlayArrow,
                                                    contentDescription = null,
                                                    tint = MaxxColors.Primary,
                                                    modifier = Modifier
                                                        .align(Alignment.Center)
                                                        .size(28.dp)
                                                )
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
private fun FrostedActionCircle(
    icon: ImageVector,
    tint: Color = Color.White,
    onClick: () -> Unit
) {
    Surface(
        color = Color.White.copy(alpha = 0.09f),
        shape = CircleShape,
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
        modifier = Modifier
            .size(48.dp)
            .clickable(onClick = onClick)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(21.dp))
        }
    }
}
