package com.maxxpixels.ui.screens.player

import android.app.Activity
import android.content.pm.ActivityInfo
import android.view.WindowManager
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.maxxpixels.data.model.PlaybackAuth
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.ApiDisconnectView
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

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
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    // Enforce landscape + FLAG_SECURE (DRM screenshot/screen-recording protection)
    DisposableEffect(Unit) {
        val originalOrientation = activity?.requestedOrientation ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose {
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
                is ApiResult.Success -> auth = res.data
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
                CircularProgressIndicator(color = MaxxColors.OrangeStart)
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
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(playback.streamUrl))
            prepare()
            if (playback.resumePositionSeconds > 0) {
                seekTo(playback.resumePositionSeconds * 1000L)
            }
            playWhenReady = true
        }
    }

    // 10-second playback heartbeat to Rust API (keeps concurrency slot & syncs Continue Watching)
    LaunchedEffect(exoPlayer, playback.sessionToken) {
        while (true) {
            delay(10_000)
            val pos = (exoPlayer.currentPosition / 1000L).toInt()
            val dur = (exoPlayer.duration.coerceAtLeast(0L) / 1000L).toInt()
            if (pos > 0) {
                repository.sendHeartbeat(playback.sessionToken, contentId, pos, dur)
            }
        }
    }

    // Release player and notify POST /playback/stop on exit
    DisposableEffect(exoPlayer) {
        onDispose {
            val pos = (exoPlayer.currentPosition / 1000L).toInt()
            val dur = (exoPlayer.duration.coerceAtLeast(0L) / 1000L).toInt()
            scope.launch {
                repository.stopPlayback(playback.sessionToken, contentId, pos, dur)
            }
            exoPlayer.release()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = true
                    setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Subtle Top Overlay Bar (Back + Title)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.72f), Color.Transparent)))
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.45f))
            ) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White)
            }
            Text(
                text = title,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
