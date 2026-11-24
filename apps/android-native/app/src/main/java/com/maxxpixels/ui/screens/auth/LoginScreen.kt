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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.R
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Clean Web-Twin Cinema Sign In Screen:
 * - Full-bleed blurred cinema backdrop with subtle top orange glow
 * - Large prominent Brand Logo
 * - Sleek centered dark glass card with India-only (+91) compact mobile input & 6-box OTP
 */
@Composable
fun LoginScreen(
    repository: MaxxRepository,
    onAuthenticated: (hasActiveSub: Boolean) -> Unit,
    onNavigateSignUp: (prefillPhone: String) -> Unit
) {
    val brand by repository.sessionManager.brand.collectAsState()
    val scope = rememberCoroutineScope()

    var phone by remember { mutableStateOf("") }
    var step by remember { mutableStateOf("phone") } // "phone" | "otp"
    var otpCode by remember { mutableStateOf("") }

    var loading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }
    var resendCooldown by remember { mutableIntStateOf(0) }

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
                        res.message.contains("register", ignoreCase = true)
                    ) {
                        onNavigateSignUp(digits)
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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0A0A))
            .imePadding()
    ) {
        AuthCinemaBackdrop()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(Modifier.height(24.dp))

            // Large Prominent Brand Logo
            Image(
                painter = painterResource(R.drawable.app_logo),
                contentDescription = brand.name,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .height(104.dp)
                    .fillMaxWidth(0.62f)
            )

            Spacer(Modifier.height(26.dp))

            // Web-Twin Dark Glass Sign-In Card
            Surface(
                color = Color(0xCC0D0D0F),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f)),
                shadowElevation = 24.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                AnimatedContent(
                    targetState = step,
                    transitionSpec = {
                        (slideInHorizontally { it / 3 } + fadeIn()) togetherWith
                            (slideOutHorizontally { -it / 3 } + fadeOut())
                    },
                    label = "loginStep"
                ) { currentStep ->
                    Column(modifier = Modifier.padding(horizontal = 22.dp, vertical = 26.dp)) {
                        if (currentStep == "otp") {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .clickable { step = "phone"; otpCode = ""; errorMsg = "" }
                                    .padding(bottom = 14.dp)
                            ) {
                                Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = MaxxColors.TextSecondary, modifier = Modifier.size(16.dp))
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

                            AuthOrangeButton(
                                text = "Verify & Sign In",
                                onClick = { verifyOtp() },
                                enabled = otpCode.length == 6,
                                loading = loading
                            )

                            Spacer(Modifier.height(14.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Didn't receive code?", color = MaxxColors.TextMuted, fontSize = 12.sp)
                                Text(
                                    text = if (resendCooldown > 0) "Resend in ${resendCooldown}s" else "Resend code",
                                    color = if (resendCooldown > 0) MaxxColors.TextMuted else MaxxColors.OrangeStart,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.clickable(enabled = resendCooldown == 0 && !loading) {
                                        sendOtp(isResend = true)
                                    }
                                )
                            }
                        } else {
                            Text("Sign In", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
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
                            }

                            Spacer(Modifier.height(16.dp))

                            AuthOrangeButton(
                                text = "Send Sign-In Code",
                                onClick = { sendOtp(isResend = false) },
                                loading = loading
                            )

                            Spacer(Modifier.height(22.dp))

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("New to ${brand.shortName}? ", color = MaxxColors.TextSecondary, fontSize = 13.5.sp)
                                Text(
                                    text = "Sign up now.",
                                    color = Color.White,
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.clickable { onNavigateSignUp(phone) }
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(28.dp))
        }
    }
}
