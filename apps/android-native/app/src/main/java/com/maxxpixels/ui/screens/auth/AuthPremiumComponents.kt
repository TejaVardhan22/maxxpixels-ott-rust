package com.maxxpixels.ui.screens.auth

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.R
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.theme.MaxxColors

/**
 * Shared Twin Cinema Backdrop matching apps/web login & register pages:
 * Full-bleed blurred cinema art + deep vertical dark scrim + subtle top warm orange spotlight.
 */
@Composable
internal fun AuthCinemaBackdrop() {
    Box(modifier = Modifier.fillMaxSize()) {
        Image(
            painter = painterResource(R.drawable.banner_movies_entertainment),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .alpha(0.28f)
                .blur(4.dp)
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xD80A0A0A),
                            Color(0xB30A0A0A),
                            Color(0xF50A0A0A),
                            Color(0xFF0A0A0A)
                        )
                    )
                )
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(340.dp)
                .background(
                    Brush.radialGradient(
                        colors = listOf(Color(0x28FF6D2E), Color.Transparent),
                        radius = 700f
                    )
                )
        )
    }
}

/**
 * Compact, sleek dark-glass input field (46.dp height) with animated focus border.
 */
@Composable
internal fun CompactAuthField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    var focused by remember { mutableStateOf(false) }
    val borderColor by animateColorAsState(
        targetValue = if (focused) Color.White.copy(alpha = 0.85f) else Color.White.copy(alpha = 0.18f),
        animationSpec = tween(180),
        label = "compactBorder"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(46.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xE618181A))
            .border(1.dp, borderColor, RoundedCornerShape(10.dp))
            .padding(horizontal = 13.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (leadingIcon != null) {
                Icon(
                    imageVector = leadingIcon,
                    contentDescription = null,
                    tint = if (focused) MaxxColors.OrangeStart else MaxxColors.TextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(9.dp))
            }
            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) {
                    Text(
                        text = placeholder,
                        color = MaxxColors.TextMuted,
                        fontSize = 13.5.sp
                    )
                }
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    singleLine = true,
                    textStyle = TextStyle(
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    ),
                    keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                    cursorBrush = SolidColor(MaxxColors.OrangeStart),
                    modifier = Modifier
                        .fillMaxWidth()
                        .onFocusChanged { focused = it.isFocused }
                )
            }
        }
    }
}

/**
 * Compact India-Only (+91) Unified Mobile Input (single sleek 46.dp field, no country dropdown).
 */
@Composable
internal fun IndiaMobileField(
    phone: String,
    onPhoneChange: (String) -> Unit,
    placeholder: String = "Mobile number",
    modifier: Modifier = Modifier
) {
    var focused by remember { mutableStateOf(false) }
    val borderColor by animateColorAsState(
        targetValue = if (focused) Color.White.copy(alpha = 0.85f) else Color.White.copy(alpha = 0.18f),
        animationSpec = tween(180),
        label = "mobileBorder"
    )

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .height(46.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xE618181A))
            .border(1.dp, borderColor, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp)
    ) {
        Text("🇮🇳", fontSize = 15.sp)
        Spacer(Modifier.width(6.dp))
        Text(
            text = "+91",
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(Modifier.width(10.dp))
        Box(
            modifier = Modifier
                .width(1.dp)
                .fillMaxHeight(0.52f)
                .background(Color.White.copy(alpha = 0.18f))
        )
        Spacer(Modifier.width(11.dp))
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (phone.isEmpty()) {
                Text(
                    text = placeholder,
                    color = MaxxColors.TextMuted,
                    fontSize = 13.5.sp
                )
            }
            BasicTextField(
                value = phone,
                onValueChange = { raw -> onPhoneChange(raw.filter(Char::isDigit).take(10)) },
                singleLine = true,
                textStyle = TextStyle(
                    color = Color.White,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp
                ),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                cursorBrush = SolidColor(MaxxColors.OrangeStart),
                modifier = Modifier
                    .fillMaxWidth()
                    .onFocusChanged { focused = it.isFocused }
            )
        }
    }
}

/**
 * 6-Box Segmented Glass OTP Input — compact & crisp.
 */
@Composable
internal fun PremiumOtpBoxes(
    otp: String,
    onOtpChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        BasicTextField(
            value = otp,
            onValueChange = { raw -> onOtpChange(raw.filter(Char::isDigit).take(6)) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            cursorBrush = SolidColor(Color.Transparent),
            textStyle = TextStyle(color = Color.Transparent),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .alpha(0.01f)
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(6) { index ->
                val char = otp.getOrNull(index)?.toString().orEmpty()
                val isCurrent = index == otp.length.coerceAtMost(5) && otp.length < 6
                val isFilled = char.isNotEmpty()
                val borderColor by animateColorAsState(
                    targetValue = when {
                        isCurrent -> MaxxColors.OrangeStart
                        isFilled -> Color.White.copy(alpha = 0.55f)
                        else -> Color.White.copy(alpha = 0.16f)
                    },
                    animationSpec = tween(160),
                    label = "otpBorder$index"
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isFilled) Color(0xFF221A16) else Color(0xE618181A))
                        .border(
                            width = if (isCurrent) 1.5.dp else 1.dp,
                            color = borderColor,
                            shape = RoundedCornerShape(10.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isFilled) {
                        Text(
                            text = char,
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center
                        )
                    } else if (isCurrent) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.OrangeStart)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Signature Web-Twin Orange Gradient CTA Button (48.dp height, crisp 10.dp radius).
 */
@Composable
internal fun AuthOrangeButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    enabled: Boolean = true
) {
    val bgBrush = if (enabled) {
        Brush.horizontalGradient(listOf(Color(0xFFFF6D2E), Color(0xFFFF5500)))
    } else {
        Brush.horizontalGradient(listOf(Color(0xFF2A2A2D), Color(0xFF2A2A2D)))
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(bgBrush)
            .bounceClick { if (enabled && !loading) onClick() },
        contentAlignment = Alignment.Center
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = Color.White,
                strokeWidth = 2.2.dp,
                modifier = Modifier.size(20.dp)
            )
        } else {
            Text(
                text = text,
                color = if (enabled) Color.White else MaxxColors.TextMuted,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
internal fun AuthErrorBox(message: String) {
    Surface(
        color = Color(0x22FF6D2E),
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, Color(0x66FF6D2E)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp)
        ) {
            Icon(Icons.Rounded.ErrorOutline, null, tint = Color(0xFFFFB088), modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                text = message,
                color = Color(0xFFFFB088),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
