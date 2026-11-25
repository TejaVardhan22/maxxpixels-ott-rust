package com.maxxpixels.ui.screens.player

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.view.WindowManager
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.AspectRatio
import androidx.compose.material.icons.rounded.Forward10
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.maxxpixels.data.model.PlaybackAuth
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.ApiDisconnectView
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.Locale
import java.util.concurrent.TimeUnit

private data class VastAdMedia(
    val mediaUrl: String,
    val clickThroughUrl: String? = null,
    val impressionUrls: List<String> = emptyList(),
    val skipAfterSeconds: Int = 5
)

private val VAST_HTTP = OkHttpClient.Builder()
    .connectTimeout(6, TimeUnit.SECONDS)
    .readTimeout(6, TimeUnit.SECONDS)
    .build()

private suspend fun fetchVastPreRoll(vastTagUrl: String): VastAdMedia? = withContext(Dispatchers.IO) {
    runCatching {
        val req = Request.Builder().url(vastTagUrl).build()
        val xml = VAST_HTTP.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return@runCatching null
            resp.body?.string().orEmpty()
        }
        if (xml.isBlank()) return@runCatching null

        // Extract MP4 or HLS MediaFile from VAST XML (2.0 / 3.0 / 4.0)
        val mediaRegex = Regex("<MediaFile[^>]*>(?:<!\\[CDATA\\[)?\\s*(https?://[^\\s<\\]]+)", RegexOption.IGNORE_CASE)
        val allMedia = mediaRegex.findAll(xml).map { it.groupValues[1].trim() }.toList()
        val chosen = allMedia.firstOrNull { it.contains(".mp4", true) }
            ?: allMedia.firstOrNull { it.contains(".m3u8", true) }
            ?: allMedia.firstOrNull()
            ?: return@runCatching null

        val clickRegex = Regex("<ClickThrough[^>]*>(?:<!\\[CDATA\\[)?\\s*(https?://[^\\s<\\]]+)", RegexOption.IGNORE_CASE)
        val clickUrl = clickRegex.find(xml)?.groupValues?.getOrNull(1)?.trim()

        val impRegex = Regex("<Impression[^>]*>(?:<!\\[CDATA\\[)?\\s*(https?://[^\\s<\\]]+)", RegexOption.IGNORE_CASE)
        val impressions = impRegex.findAll(xml).map { it.groupValues[1].trim() }.toList()

        VastAdMedia(
            mediaUrl = chosen,
            clickThroughUrl = clickUrl,
            impressionUrls = impressions,
            skipAfterSeconds = 5
        )
    }.getOrNull()
}

private suspend fun fireImpressions(urls: List<String>) = withContext(Dispatchers.IO) {
    urls.forEach { url ->
        runCatching {
            VAST_HTTP.newCall(Request.Builder().url(url).build()).execute().close()
        }
    }
}

private fun formatPlayerTime(ms: Long): String {
    val totalSec = (ms.coerceAtLeast(0L) / 1000L).toInt()
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) String.format(Locale.US, "%d:%02d:%02d", h, m, s)
    else String.format(Locale.US, "%02d:%02d", m, s)
}

/**
 * Aha-Style Custom Cinema Video Player with Native VAST Pre-Roll Ad Engine:
 * - Full-screen immersive landscape playback with FLAG_SECURE DRM protection
 * - Native VAST XML pre-roll ad playback (when backend returns showAds + vastTagUrl) with Ad badge,
 *   countdown, impression beacons, ClickThrough CTA, and 5-second Skip Ad pill
 * - Smooth animated Aha-style custom controls: -10s / Play-Pause / +10s, golden amber scrubber,
 *   playback speed (0.75x–2x), aspect ratio toggle, mute toggle, and screen lock mode
 */
@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    contentId: Long,
    episodeId: Long?,
    title: String,
    repository: MaxxRepository,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()

    var auth by remember { mutableStateOf<PlaybackAuth?>(null) }
    var vastAd by remember { mutableStateOf<VastAdMedia?>(null) }
    var playingAd by remember { mutableStateOf(false) }
    var adElapsedSec by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    // Enforce landscape + immersive fullscreen + FLAG_SECURE (DRM screenshot/screen-recording protection)
    DisposableEffect(Unit) {
        val originalOrientation = activity?.requestedOrientation ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val insetsController = activity?.window?.let { WindowCompat.getInsetsController(it, it.decorView) }
        insetsController?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        insetsController?.hide(WindowInsetsCompat.Type.systemBars())

        onDispose {
            insetsController?.show(WindowInsetsCompat.Type.systemBars())
            activity?.requestedOrientation = originalOrientation
            activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    fun authorize() {
        loading = true
        errorMsg = null
        scope.launch {
            when (val res = repository.authorizePlayback(contentId, episodeId)) {
                is ApiResult.Success -> {
                    val data = res.data
                    auth = data
                    if (data.showAds && !data.vastTagUrl.isNullOrBlank()) {
                        val fetched = fetchVastPreRoll(data.vastTagUrl)
                        if (fetched != null) {
                            vastAd = fetched
                            playingAd = true
                            adElapsedSec = 0
                            launch { fireImpressions(fetched.impressionUrls) }
                        }
                    }
                }
                is ApiResult.Error -> errorMsg = res.message
            }
            loading = false
        }
    }

    LaunchedEffect(contentId, episodeId) { authorize() }

    if (loading) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaxxColors.CinemaBlack),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = MaxxColors.Primary)
                Spacer(Modifier.height(12.dp))
                Text("Preparing stream…", color = MaxxColors.TextSecondary, fontSize = 13.sp)
            }
        }
        return
    }

    if (errorMsg != null || auth == null) {
        ApiDisconnectView(
            title = "Stream unavailable",
            message = errorMsg ?: "Unable to start playback.",
            onRetry = { authorize() }
        )
        return
    }

    val playback = auth!!
    val exoPlayer = remember(playback.streamUrl) {
        ExoPlayer.Builder(context).build()
    }

    // Player UI state
    var isPlaying by remember { mutableStateOf(true) }
    var isBuffering by remember { mutableStateOf(true) }
    var currentPosMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var controlsVisible by remember { mutableStateOf(true) }
    var isLocked by remember { mutableStateOf(false) }
    var isMuted by remember { mutableStateOf(false) }
    val speeds = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
    var speedIdx by remember { mutableIntStateOf(1) }
    var resizeModeIdx by remember { mutableIntStateOf(0) } // 0 = Fit, 1 = Zoom, 2 = Fill
    val resizeModes = listOf(
        AspectRatioFrameLayout.RESIZE_MODE_FIT to "Fit",
        AspectRatioFrameLayout.RESIZE_MODE_ZOOM to "Zoom",
        AspectRatioFrameLayout.RESIZE_MODE_FILL to "Fill"
    )
    var playerViewRef by remember { mutableStateOf<PlayerView?>(null) }

    fun startMainContent() {
        playingAd = false
        exoPlayer.stop()
        exoPlayer.setMediaItem(MediaItem.fromUri(playback.streamUrl))
        exoPlayer.prepare()
        if (playback.resumePositionSeconds > 0) {
            exoPlayer.seekTo(playback.resumePositionSeconds * 1000L)
        }
        exoPlayer.playWhenReady = true
    }

    // Load either VAST Pre-Roll Ad or Main Content
    LaunchedEffect(playback.streamUrl, vastAd) {
        val ad = vastAd
        if (playingAd && ad != null) {
            exoPlayer.setMediaItem(MediaItem.fromUri(ad.mediaUrl))
            exoPlayer.prepare()
            exoPlayer.playWhenReady = true
        } else {
            startMainContent()
        }
    }

    // Listen to ExoPlayer playback state & ad completion
    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onPlaybackStateChanged(state: Int) {
                isBuffering = state == Player.STATE_BUFFERING
                if (state == Player.STATE_ENDED && playingAd) {
                    startMainContent()
                }
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
            if (!playingAd) {
                val pos = (exoPlayer.currentPosition / 1000L).toInt()
                val dur = (exoPlayer.duration.coerceAtLeast(0L) / 1000L).toInt()
                scope.launch {
                    repository.stopPlayback(playback.sessionToken, contentId, pos, dur)
                }
            }
            exoPlayer.release()
        }
    }

    // Poll position every 500ms for smooth scrubber + ad countdown
    LaunchedEffect(exoPlayer, playingAd) {
        while (true) {
            currentPosMs = exoPlayer.currentPosition.coerceAtLeast(0L)
            durationMs = exoPlayer.duration.coerceAtLeast(0L)
            if (playingAd && isPlaying) {
                adElapsedSec = (currentPosMs / 1000L).toInt()
            }
            delay(500)
        }
    }

    // Auto-hide Aha controls after 4 seconds when playing
    LaunchedEffect(controlsVisible, isPlaying, isLocked, playingAd) {
        if (controlsVisible && isPlaying && !isLocked && !playingAd) {
            delay(4000)
            controlsVisible = false
        }
    }

    // 10-second playback heartbeat to Rust API (only during main content, not ads)
    LaunchedEffect(exoPlayer, playback.sessionToken, playingAd) {
        if (!playingAd) {
            while (true) {
                delay(10_000)
                val pos = (exoPlayer.currentPosition / 1000L).toInt()
                val dur = (exoPlayer.duration.coerceAtLeast(0L) / 1000L).toInt()
                if (pos > 0) {
                    repository.sendHeartbeat(playback.sessionToken, contentId, pos, dur)
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {
                if (!playingAd) controlsVisible = !controlsVisible
            }
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                    resizeMode = resizeModes[resizeModeIdx].first
                    playerViewRef = this
                }
            },
            update = { view ->
                view.resizeMode = resizeModes[resizeModeIdx].first
            },
            modifier = Modifier.fillMaxSize()
        )

        // Buffering Indicator
        if (isBuffering) {
            CircularProgressIndicator(
                color = MaxxColors.Primary,
                strokeWidth = 3.dp,
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(46.dp)
            )
        }

        // ── VAST Pre-Roll Ad Overlay ────────────────────────────────────────
        if (playingAd) {
            val ad = vastAd
            val remainingSec = ((durationMs - currentPosMs).coerceAtLeast(0L) / 1000L).toInt()
            val canSkip = ad != null && adElapsedSec >= ad.skipAfterSeconds
            val skipCountdown = ((ad?.skipAfterSeconds ?: 5) - adElapsedSec).coerceAtLeast(0)

            // Top-left AD Pill + Back
            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Surface(
                    color = Color.Black.copy(alpha = 0.6f),
                    shape = CircleShape,
                    modifier = Modifier
                        .size(36.dp)
                        .clickable(onClick = onBack)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White, modifier = Modifier.size(18.dp))
                    }
                }
                Surface(
                    color = MaxxColors.Primary,
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = if (remainingSec > 0) "AD • ${formatPlayerTime(remainingSec * 1000L)}" else "AD",
                        color = MaxxColors.OnPrimaryDark,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Bottom-left Learn More (if VAST ClickThrough exists)
            if (!ad?.clickThroughUrl.isNullOrBlank()) {
                Surface(
                    color = Color.Black.copy(alpha = 0.65f),
                    shape = RoundedCornerShape(999.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.25f)),
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .navigationBarsPadding()
                        .padding(18.dp)
                        .clickable {
                            runCatching {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ad!!.clickThroughUrl)))
                            }
                        }
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text("Learn More", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(5.dp))
                        Icon(Icons.Rounded.OpenInNew, null, tint = MaxxColors.Primary, modifier = Modifier.size(14.dp))
                    }
                }
            }

            // Bottom-right Skip Ad Pill
            Surface(
                color = if (canSkip) MaxxColors.Primary else Color.Black.copy(alpha = 0.72f),
                shape = RoundedCornerShape(999.dp),
                border = BorderStroke(1.dp, if (canSkip) MaxxColors.Primary else Color.White.copy(alpha = 0.24f)),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .navigationBarsPadding()
                    .padding(18.dp)
                    .clickable(enabled = canSkip) { startMainContent() }
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp)
                ) {
                    Text(
                        text = if (canSkip) "Skip Ad" else "Skip in ${skipCountdown}s",
                        color = if (canSkip) MaxxColors.OnPrimaryDark else Color.White,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    if (canSkip) {
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Rounded.SkipNext, null, tint = MaxxColors.OnPrimaryDark, modifier = Modifier.size(17.dp))
                    }
                }
            }
        }

        // ── Aha-Style Custom Cinema Controls Overlay ────────────────────────
        AnimatedVisibility(
            visible = !playingAd && controlsVisible,
            enter = fadeIn(tween(180)),
            exit = fadeOut(tween(200)),
            modifier = Modifier.fillMaxSize()
        ) {
            if (isLocked) {
                Box(modifier = Modifier.fillMaxSize()) {
                    Surface(
                        color = Color.Black.copy(alpha = 0.65f),
                        shape = RoundedCornerShape(999.dp),
                        border = BorderStroke(1.dp, MaxxColors.Primary.copy(alpha = 0.5f)),
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .navigationBarsPadding()
                            .padding(bottom = 24.dp)
                            .clickable { isLocked = false }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp)
                        ) {
                            Icon(Icons.Rounded.LockOpen, null, tint = MaxxColors.Primary, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Tap to Unlock", color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.42f))
                ) {
                    // Top Bar: Back + Title + Speed + Aspect + Lock
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.78f), Color.Transparent)))
                            .statusBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            Surface(
                                color = Color.White.copy(alpha = 0.12f),
                                shape = CircleShape,
                                modifier = Modifier
                                    .size(38.dp)
                                    .clickable(onClick = onBack)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White, modifier = Modifier.size(20.dp))
                                }
                            }
                            Spacer(Modifier.width(12.dp))
                            Text(
                                text = title,
                                color = Color.White,
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            // Speed Pill
                            Surface(
                                color = Color.White.copy(alpha = 0.12f),
                                shape = RoundedCornerShape(999.dp),
                                modifier = Modifier.clickable {
                                    speedIdx = (speedIdx + 1) % speeds.size
                                    exoPlayer.playbackParameters = PlaybackParameters(speeds[speedIdx])
                                }
                            ) {
                                Text(
                                    text = "${speeds[speedIdx]}x",
                                    color = MaxxColors.PrimaryLight,
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    modifier = Modifier.padding(horizontal = 11.dp, vertical = 6.dp)
                                )
                            }

                            // Resize Mode Pill
                            Surface(
                                color = Color.White.copy(alpha = 0.12f),
                                shape = RoundedCornerShape(999.dp),
                                modifier = Modifier.clickable {
                                    resizeModeIdx = (resizeModeIdx + 1) % resizeModes.size
                                }
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Icon(Icons.Rounded.AspectRatio, null, tint = Color.White, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(resizeModes[resizeModeIdx].second, color = Color.White, fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            // Lock Button
                            Surface(
                                color = Color.White.copy(alpha = 0.12f),
                                shape = CircleShape,
                                modifier = Modifier
                                    .size(34.dp)
                                    .clickable { isLocked = true }
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Rounded.Lock, "Lock", tint = Color.White, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }

                    // Center Controls: -10s | Golden Play/Pause | +10s
                    Row(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalArrangement = Arrangement.spacedBy(36.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            color = Color.Black.copy(alpha = 0.50f),
                            shape = CircleShape,
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.22f)),
                            modifier = Modifier
                                .size(50.dp)
                                .clickable { exoPlayer.seekTo((exoPlayer.currentPosition - 10_000L).coerceAtLeast(0L)) }
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Rounded.Replay10, "Back 10s", tint = Color.White, modifier = Modifier.size(26.dp))
                            }
                        }

                        Box(
                            modifier = Modifier
                                .size(66.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.BrandGradient)
                                .clickable {
                                    if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                                contentDescription = if (isPlaying) "Pause" else "Play",
                                tint = MaxxColors.OnPrimaryDark,
                                modifier = Modifier.size(36.dp)
                            )
                        }

                        Surface(
                            color = Color.Black.copy(alpha = 0.50f),
                            shape = CircleShape,
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.22f)),
                            modifier = Modifier
                                .size(50.dp)
                                .clickable {
                                    val target = (exoPlayer.currentPosition + 10_000L)
                                        .coerceAtMost(exoPlayer.duration.coerceAtLeast(0L))
                                    exoPlayer.seekTo(target)
                                }
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Rounded.Forward10, "Forward 10s", tint = Color.White, modifier = Modifier.size(26.dp))
                            }
                        }
                    }

                    // Bottom Scrubber & Audio/HD Bar (Aha Amber-Gold Style)
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))))
                            .navigationBarsPadding()
                            .padding(horizontal = 20.dp, vertical = 10.dp)
                    ) {
                        var dragging by remember { mutableStateOf(false) }
                        var dragProgress by remember { mutableFloatStateOf(0f) }
                        val fraction = if (durationMs > 0L) (currentPosMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f) else 0f

                        Slider(
                            value = if (dragging) dragProgress else fraction,
                            onValueChange = { v ->
                                dragging = true
                                dragProgress = v
                            },
                            onValueChangeFinished = {
                                if (durationMs > 0L) {
                                    exoPlayer.seekTo((dragProgress * durationMs).toLong())
                                }
                                dragging = false
                            },
                            colors = SliderDefaults.colors(
                                thumbColor = MaxxColors.Primary,
                                activeTrackColor = MaxxColors.Primary,
                                inactiveTrackColor = Color.White.copy(alpha = 0.26f)
                            ),
                            modifier = Modifier.fillMaxWidth().height(26.dp)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "${formatPlayerTime(currentPosMs)}  /  ${formatPlayerTime(durationMs)}",
                                color = Color.White.copy(alpha = 0.88f),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    color = MaxxColors.PrimaryTint,
                                    shape = RoundedCornerShape(6.dp),
                                    border = BorderStroke(1.dp, MaxxColors.Primary.copy(alpha = 0.5f))
                                ) {
                                    Text(
                                        text = "HD",
                                        color = MaxxColors.PrimaryLight,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                                    )
                                }
                                Icon(
                                    imageVector = if (isMuted) Icons.AutoMirrored.Rounded.VolumeOff else Icons.AutoMirrored.Rounded.VolumeUp,
                                    contentDescription = "Mute",
                                    tint = Color.White,
                                    modifier = Modifier
                                        .size(21.dp)
                                        .clickable {
                                            isMuted = !isMuted
                                            exoPlayer.volume = if (isMuted) 0f else 1f
                                        }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
