package com.maxxpixels.ui.screens.splash

import android.net.Uri
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.maxxpixels.R
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Full-Screen Intro Video Splash (plays res/raw/splash.mp4 via Media3 ExoPlayer),
 * matching the mobile app's SplashScreen with tap-to-skip, onEnd navigation, and safety fallback.
 */
@OptIn(UnstableApi::class)
@Composable
fun SplashScreen(
    repository: MaxxRepository,
    onNavigateLogin: () -> Unit,
    onNavigateSubscription: () -> Unit,
    onNavigateHome: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var hasNavigated by remember { mutableStateOf(false) }

    fun navigateNext() {
        if (hasNavigated) return
        hasNavigated = true
        scope.launch {
            val session = repository.sessionManager.session.value
            if (session == null || !session.isLoggedIn) {
                onNavigateLogin()
            } else {
                val active = repository.syncSubscription()
                if (active) onNavigateHome() else onNavigateSubscription()
            }
        }
    }

    // Sync branding in parallel while intro video plays
    LaunchedEffect(Unit) {
        launch { repository.syncBranding() }
        // Safety fallback timer so slow decoders never freeze
        delay(12_000)
        navigateNext()
    }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            val uri = Uri.parse("android.resource://${context.packageName}/${R.raw.splash}")
            setMediaItem(MediaItem.fromUri(uri))
            repeatMode = Player.REPEAT_MODE_OFF
            volume = 1.0f
            playWhenReady = true
            prepare()
        }
    }

    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    navigateNext()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                navigateNext()
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() }
            ) { navigateNext() }
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Subtle Skip Pill top-right
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .statusBarsPadding()
                .padding(16.dp)
                .clip(RoundedCornerShape(99.dp))
                .background(Color.Black.copy(alpha = 0.45f))
                .clickable { navigateNext() }
                .padding(horizontal = 14.dp, vertical = 6.dp)
        ) {
            Text("Skip", color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
