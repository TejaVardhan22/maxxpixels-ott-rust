package com.maxxpixels.ui.screens.auth

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.maxxpixels.R
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Modern Tilted Poster-Wall Welcome & OTP Sign-In Screen (Matching Reference Screen 1):
 * - Top: Tilted 3-column cinema poster collage wall fading into dark bottom sheet
 * - Bottom: Rounded dark frosted sheet (32.dp top corners) with golden pill "Get Started"
 *   and frosted glass "Sign In", smoothly transitioning into +91 Mobile OTP & 6-box verification.
 */
@Composable
fun LoginScreen(
    repository: MaxxRepository,
    onAuthenticated: (hasActiveSub: Boolean) -> Unit,
    onNavigateSignUp: (prefillPhone: String) -> Unit
) {
    val brand by repository.sessionManager.brand.collectAsState()
    val scope = rememberCoroutineScope()

    var posterWall by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var phone by remember { mutableStateOf("") }
    var step by remember { mutableStateOf("welcome") } // "welcome" | "phone" | "otp"
    var otpCode by remember { mutableStateOf("") }

    var loading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }
    var notRegistered by remember { mutableStateOf(false) }
    var resendCooldown by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        posterWall = repository.getTrending().take(9)
    }

    LaunchedEffect(resendCooldown) {
        if (resendCooldown > 0) {
            delay(1000)
            resendCooldown--
        }
    }

    fun sendOtp(isResend: Boolean = false) {
        val digits = phone.filter(Char::isDigit)
        if (digits.length < 10) {
            errorMsg = "Please enter a valid 10-digit mobile number."
            return
        }
        errorMsg = ""
        notRegistered = false
        loading = true
        scope.launch {
            when (val res = repository.sendPhoneOtp(
                phone = "+91$digits",
                isRegister = false,
                isResend = isResend
            )) {
                is ApiResult.Success -> {
                    step = "otp"
                    resendCooldown = 30
                }
                is ApiResult.Error -> {
                    if (res.message.contains("not registered", ignoreCase = true) ||
                        res.message.contains("not found", ignoreCase = true) ||
                        res.message.contains("sign up", ignoreCase = true)
                    ) {
                        notRegistered = true
                        errorMsg = "No MaxxPixels account found for +91 $digits. Please sign up first."
                    } else {
                        errorMsg = res.message
                    }
                }
            }
            loading = false
        }
    }

    fun verifyOtp(codeOverride: String? = null) {
        val cleanOtp = (codeOverride ?: otpCode).filter(Char::isDigit)
        if (cleanOtp.length != 6) {
            errorMsg = "Enter the 6-digit sign-in code."
            return
        }
        errorMsg = ""
        loading = true
        scope.launch {
            val digits = phone.filter(Char::isDigit)
            when (val res = repository.verifyPhoneOtp(
                phone = "+91$digits",
                otp = cleanOtp,
                isRegister = false
            )) {
                is ApiResult.Success -> onAuthenticated(res.data.hasActiveSubscription)
                is ApiResult.Error -> {
                    if (res.message.contains("not registered", ignoreCase = true)) {
                        onNavigateSignUp(digits)
                    } else {
                        errorMsg = res.message
                    }
                }
            }
            loading = false
        }
    }

    val fallbackDrawables = listOf(
        R.drawable.banner_movies_entertainment,
        R.drawable.banner_all_indian_languages,
        R.drawable.banner_ai_movies,
        R.drawable.banner_games
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .imePadding()
    ) {
        // 1. Tilted 3-Column Cinema Poster Wall Backdrop (Reference Screen 1)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(480.dp)
                .align(Alignment.TopCenter)
                .clip(RoundedCornerShape(0.dp))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        rotationZ = -10f
                        scaleX = 1.24f
                        scaleY = 1.24f
                        translationY = -28f
                    },
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                for (rowIdx in 0..2) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        for (colIdx in 0..2) {
                            val flatIdx = rowIdx * 3 + colIdx
                            val remoteUrl = posterWall.getOrNull(flatIdx)?.let {
                                it.posterUrl.ifBlank { it.landscapeUrl }
                            }.orEmpty()
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(0.72f)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(MaxxColors.SurfaceDark)
                            ) {
                                if (remoteUrl.isNotBlank()) {
                                    AsyncImage(
                                        model = remoteUrl,
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                } else {
                                    Image(
                                        painter = painterResource(fallbackDrawables[flatIdx % fallbackDrawables.size]),
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Bottom gradient fade into the rounded sheet
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0.0f to Color.Black.copy(alpha = 0.25f),
                                0.55f to Color(0xAA0A090E),
                                1.0f to MaxxColors.CinemaBlack
                            )
                        )
                    )
            )
        }

        // 2. Bottom Rounded Frosted Glass Sheet (Reference Screen 1)
        Surface(
            color = Color(0xF515131B),
            shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
            shadowElevation = 24.dp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                AnimatedContent(
                    targetState = step,
                    transitionSpec = {
                        (slideInHorizontally { it / 3 } + fadeIn()) togetherWith
                            (slideOutHorizontally { -it / 3 } + fadeOut())
                    },
                    label = "loginStep"
                ) { currentStep ->
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        when (currentStep) {
                            "welcome" -> {
                                Image(
                                    painter = painterResource(R.drawable.app_logo),
                                    contentDescription = brand.name,
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier.height(48.dp)
                                )
                                Spacer(Modifier.height(16.dp))
                                Text(
                                    text = "Your Entertainment\nStarts Right Here Today",
                                    color = Color.White,
                                    fontSize = 25.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    textAlign = TextAlign.Center,
                                    lineHeight = 31.sp
                                )
                                Spacer(Modifier.height(10.dp))
                                Text(
                                    text = "Discover movies, web series, short films, and Originals.\nStream anytime, anywhere effortlessly.",
                                    color = MaxxColors.TextSecondary,
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center,
                                    lineHeight = 19.sp
                                )
                                Spacer(Modifier.height(26.dp))

                                // Golden Pill Primary CTA ("Get Started")
                                GoldenPillButton(
                                    text = "Get Started",
                                    onClick = { onNavigateSignUp("") }
                                )

                                Spacer(Modifier.height(12.dp))

                                // Frosted Glass Pill Secondary CTA ("Sign In")
                                Surface(
                                    color = Color.White.copy(alpha = 0.08f),
                                    shape = RoundedCornerShape(999.dp),
                                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.18f)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(52.dp)
                                        .clickable { step = "phone" }
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            text = "Sign In",
                                            color = Color.White,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }

                            "phone" -> {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier
                                            .clickable { step = "welcome"; errorMsg = "" }
                                            .padding(bottom = 14.dp)
                                    ) {
                                        Icon(
                                            Icons.AutoMirrored.Rounded.ArrowBack,
                                            contentDescription = "Back",
                                            tint = MaxxColors.TextSecondary,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(Modifier.width(6.dp))
                                        Text("Back", color = MaxxColors.TextSecondary, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                                    }

                                    Text("Sign In", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black)
                                    Spacer(Modifier.height(6.dp))
                                    Text(
                                        text = "Enter your mobile number to receive a 6-digit sign-in code.",
                                        color = MaxxColors.TextSecondary,
                                        fontSize = 13.sp,
                                        lineHeight = 18.sp
                                    )
                                    Spacer(Modifier.height(20.dp))

                                    IndiaMobileField(
                                        phone = phone,
                                        onPhoneChange = {
                                            phone = it
                                            errorMsg = ""
                                        }
                                    )

                                    if (errorMsg.isNotBlank()) {
                                        Spacer(Modifier.height(12.dp))
                                        AuthErrorBox(errorMsg)
                                        if (notRegistered) {
                                            Spacer(Modifier.height(10.dp))
                                            GoldenPillButton(
                                                text = "Create Account Now",
                                                onClick = { onNavigateSignUp(phone.filter(Char::isDigit)) }
                                            )
                                        }
                                    }

                                    Spacer(Modifier.height(18.dp))

                                    GoldenPillButton(
                                        text = "Send Sign-In Code",
                                        loading = loading,
                                        onClick = { sendOtp(isResend = false) }
                                    )

                                    Spacer(Modifier.height(18.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("New to ${brand.shortName}? ", color = MaxxColors.TextSecondary, fontSize = 13.sp)
                                        Text(
                                            text = "Create Account",
                                            color = MaxxColors.Primary,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.clickable { onNavigateSignUp(phone) }
                                        )
                                    }
                                }
                            }

                            else -> {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier
                                            .clickable { step = "phone"; otpCode = ""; errorMsg = "" }
                                            .padding(bottom = 14.dp)
                                    ) {
                                        Icon(
                                            Icons.AutoMirrored.Rounded.ArrowBack,
                                            contentDescription = "Back",
                                            tint = MaxxColors.TextSecondary,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(Modifier.width(6.dp))
                                        Text("Change number", color = MaxxColors.TextSecondary, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                                    }

                                    Text("Enter Sign-In Code", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                                    Spacer(Modifier.height(5.dp))
                                    Text(
                                        text = "6-digit SMS code sent to +91 ${phone.filter(Char::isDigit)}",
                                        color = MaxxColors.TextSecondary,
                                        fontSize = 13.sp
                                    )

                                    Spacer(Modifier.height(20.dp))

                                    PremiumOtpBoxes(
                                        otp = otpCode,
                                        onOtpChange = { clean ->
                                            otpCode = clean
                                            errorMsg = ""
                                            if (clean.length == 6 && !loading) verifyOtp(clean)
                                        }
                                    )

                                    if (errorMsg.isNotBlank()) {
                                        Spacer(Modifier.height(12.dp))
                                        AuthErrorBox(errorMsg)
                                    }

                                    Spacer(Modifier.height(18.dp))

                                    GoldenPillButton(
                                        text = "Verify & Sign In",
                                        enabled = otpCode.length == 6,
                                        loading = loading,
                                        onClick = { verifyOtp() }
                                    )

                                    Spacer(Modifier.height(14.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("Didn't receive code?", color = MaxxColors.TextMuted, fontSize = 12.sp)
                                        Text(
                                            text = if (resendCooldown > 0) "Resend in ${resendCooldown}s" else "Resend code",
                                            color = if (resendCooldown > 0) MaxxColors.TextMuted else MaxxColors.Primary,
                                            fontSize = 12.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.clickable(enabled = resendCooldown == 0 && !loading) {
                                                sendOtp(isResend = true)
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
    }
}

@Composable
private fun GoldenPillButton(
    text: String,
    enabled: Boolean = true,
    loading: Boolean = false,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(
                if (enabled) MaxxColors.BrandGradient
                else Brush.horizontalGradient(listOf(Color(0xFF3A3542), Color(0xFF3A3542)))
            )
            .clickable(enabled = enabled && !loading, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = MaxxColors.OnPrimaryDark,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp)
            )
        } else {
            Text(
                text = text,
                color = if (enabled) MaxxColors.OnPrimaryDark else Color.White.copy(alpha = 0.5f),
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }
    }
}
