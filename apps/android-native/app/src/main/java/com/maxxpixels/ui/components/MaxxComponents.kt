package com.maxxpixels.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.ui.theme.MaxxColors

fun Modifier.bounceClick(
    scaleDown: Float = 0.96f,
    onClick: () -> Unit
): Modifier = composed {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) scaleDown else 1f,
        animationSpec = spring(dampingRatio = 0.65f, stiffness = 500f),
        label = "bounceScale"
    )
    this
        .scale(scale)
        .clickable(
            interactionSource = interactionSource,
            indication = null,
            onClick = onClick
        )
}

@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(16.dp)
) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translate by transition.animateFloat(
        initialValue = -300f,
        targetValue = 900f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1250, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerOffset"
    )
    val brush = Brush.linearGradient(
        colors = listOf(
            Color(0xFF1F1423),
            Color(0xFF33203A),
            Color(0xFF1F1423),
        ),
        start = Offset(translate, 0f),
        end = Offset(translate + 320f, 180f)
    )
    Box(
        modifier = modifier
            .clip(shape)
            .background(brush)
    )
}

/** Pill-shaped coral-rose -> magenta primary CTA matching AppReel "Watch Now". */
@Composable
fun MaxxPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    height: Dp = 50.dp,
    shape: Shape = RoundedCornerShape(99.dp),
    leadingIcon: (@Composable () -> Unit)? = null
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed && enabled && !loading) 0.97f else 1f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 500f),
        label = "primaryBtnScale"
    )

    Box(
        modifier = modifier
            .scale(scale)
            .height(height)
            .clip(shape)
            .background(
                brush = if (enabled) MaxxColors.BrandGradient
                else Brush.horizontalGradient(listOf(Color(0xFF3A2D3E), Color(0xFF2A1F2E)))
            )
            .clickable(
                enabled = enabled && !loading,
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = Color.White,
                strokeWidth = 2.2.dp,
                modifier = Modifier.size(20.dp)
            )
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.padding(horizontal = 22.dp)
            ) {
                if (leadingIcon != null) {
                    leadingIcon()
                    Spacer(Modifier.width(8.dp))
                }
                Text(
                    text = text,
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun OfflineStatusBanner(
    isOffline: Boolean,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = isOffline,
        enter = slideInVertically { -it } + fadeIn(),
        exit = slideOutVertically { -it } + fadeOut(),
        modifier = modifier
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF3A1228))
                .border(0.5.dp, MaxxColors.AccentCoral.copy(alpha = 0.45f))
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Rounded.WifiOff,
                contentDescription = "Offline",
                tint = MaxxColors.AccentSoft,
                modifier = Modifier.size(15.dp)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "You're offline — showing saved catalog",
                color = MaxxColors.AccentSoft,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun ApiDisconnectView(
    title: String = "Connection Lost",
    message: String = "We couldn't reach MaxxPixels right now. Check your internet connection and try again.",
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            color = MaxxColors.SurfaceGlass,
            shape = RoundedCornerShape(24.dp),
            border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(28.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(58.dp)
                        .clip(CircleShape)
                        .background(MaxxColors.AccentTint),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.CloudOff,
                        contentDescription = null,
                        tint = MaxxColors.AccentCoral,
                        modifier = Modifier.size(28.dp)
                    )
                }
                Spacer(Modifier.height(16.dp))
                Text(
                    text = title,
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = message,
                    color = MaxxColors.TextSecondary,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(22.dp))
                Button(
                    onClick = onRetry,
                    colors = ButtonDefaults.buttonColors(containerColor = MaxxColors.AccentCoral),
                    shape = RoundedCornerShape(99.dp),
                    contentPadding = PaddingValues(horizontal = 28.dp, vertical = 12.dp)
                ) {
                    Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Retry", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    actionLabel: String? = "See All",
    onActionClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title,
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        if (actionLabel != null && onActionClick != null) {
            Text(
                text = actionLabel,
                color = MaxxColors.TextSecondary,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier
                    .clip(RoundedCornerShape(99.dp))
                    .clickable(onClick = onActionClick)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
    }
}
