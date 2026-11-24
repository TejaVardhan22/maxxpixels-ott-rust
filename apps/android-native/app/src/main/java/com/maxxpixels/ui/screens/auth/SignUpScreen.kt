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
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CardGiftcard
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Person
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.R
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Attractive Web-Twin Cinema Sign Up Screen:
 * - Exact same cinema backdrop as Login with large Brand Logo & circular Back button
 * - Sleek centered dark glass card with compact 46.dp fields, India-only (+91) mobile bar,
 *   clean 18+ consent row, and 6-box OTP verification.
 */
@Composable
fun SignUpScreen(
    repository: MaxxRepository,
    prefillPhone: String = "",
    onAuthenticated: (hasActiveSub: Boolean) -> Unit,
    onNavigateLogin: () -> Unit
) {
    val brand by repository.sessionManager.brand.collectAsState()
    val scope = rememberCoroutineScope()

    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var phone by remember(prefillPhone) { mutableStateOf(prefillPhone.filter(Char::isDigit).take(10)) }
    var email by remember { mutableStateOf("") }
    var referralCode by remember { mutableStateOf("") }
    var adultConfirmed by remember { mutableStateOf(true) }

    var step by remember { mutableStateOf("details") } // "details" | "otp"
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

    fun sendSignupOtp(isResend: Boolean = false) {
        val digits = phone.filter(Char::isDigit)
        if (firstName.trim().length < 2 || lastName.trim().isEmpty()) {
            errorMsg = "Please enter your first name and last name."
            return
        }
        if (digits.length < 10) {
            errorMsg = "Please enter a valid 10-digit mobile number."
            return
        }
        if (email.isNotBlank() && !email.contains("@")) {
            errorMsg = "Please enter a valid email address."
            return
        }
        if (!adultConfirmed) {
            errorMsg = "Please confirm you are 18+ and accept the Terms of Use & Privacy Policy."
            return
        }
        errorMsg = ""
        loading = true
        scope.launch {
            when (val res = repository.sendPhoneOtp(
                phone = "+91$digits",
                isRegister = true,
                isResend = isResend,
                agentCode = referralCode.trim().takeIf { it.isNotBlank() }
            )) {
                is ApiResult.Success -> {
                    step = "otp"
                    resendCooldown = 30
                }
                is ApiResult.Error -> errorMsg = res.message
            }
            loading = false
        }
    }

    fun verifySignupOtp(codeOverride: String? = null) {
        val cleanOtp = (codeOverride ?: otpCode).filter(Char::isDigit)
        if (cleanOtp.length != 6) {
            errorMsg = "Enter the 6-digit verification code."
            return
        }
        errorMsg = ""
        loading = true
        scope.launch {
            val digits = phone.filter(Char::isDigit)
            when (val res = repository.verifyPhoneOtp(
                phone = "+91$digits",
                otp = cleanOtp,
                isRegister = true,
                firstName = firstName.trim(),
                lastName = lastName.trim(),
                email = email.trim().takeIf { it.isNotBlank() },
                agentCode = referralCode.trim().takeIf { it.isNotBlank() }
            )) {
                is ApiResult.Success -> onAuthenticated(res.data.hasActiveSubscription)
                is ApiResult.Error -> errorMsg = res.message
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
                .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Top Row: Circular Back Button + Large Centered Logo
            Box(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .align(Alignment.CenterStart)
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.08f))
                        .border(1.dp, Color.White.copy(alpha = 0.14f), CircleShape)
                        .clickable {
                            if (step == "otp") {
                                step = "details"
                                otpCode = ""
                                errorMsg = ""
                            } else {
                                onNavigateLogin()
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White, modifier = Modifier.size(18.dp))
                }

                Image(
                    painter = painterResource(R.drawable.app_logo),
                    contentDescription = brand.name,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .height(74.dp)
                        .fillMaxWidth(0.52f)
                )
            }

            Spacer(Modifier.height(18.dp))

            // Web-Twin Dark Glass Sign-Up Card
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
                    label = "signupStep"
                ) { currentStep ->
                    Column(modifier = Modifier.padding(horizontal = 22.dp, vertical = 24.dp)) {
                        Text(
                            text = if (currentStep == "otp") "Verify Mobile" else "Sign Up",
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black
                        )
                        Spacer(Modifier.height(5.dp))
                        Text(
                            text = if (currentStep == "otp")
                                "Enter the 6-digit SMS code sent to +91 ${phone.filter(Char::isDigit)}"
                            else
                                "Create your ${brand.shortName} account to start streaming.",
                            color = MaxxColors.TextSecondary,
                            fontSize = 13.sp,
                            lineHeight = 18.sp
                        )

                        Spacer(Modifier.height(18.dp))

                        if (currentStep == "otp") {
                            PremiumOtpBoxes(
                                otp = otpCode,
                                onOtpChange = { clean ->
                                    otpCode = clean
                                    errorMsg = ""
                                    if (clean.length == 6 && !loading) verifySignupOtp(clean)
                                }
                            )

                            if (errorMsg.isNotBlank()) {
                                Spacer(Modifier.height(12.dp))
                                AuthErrorBox(errorMsg)
                            }

                            Spacer(Modifier.height(18.dp))

                            AuthOrangeButton(
                                text = "Verify & Create Account",
                                onClick = { verifySignupOtp() },
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
                                        sendSignupOtp(isResend = true)
                                    }
                                )
                            }
                        } else {
                            // First Name & Last Name
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                CompactAuthField(
                                    value = firstName,
                                    onValueChange = { firstName = it; errorMsg = "" },
                                    placeholder = "First name *",
                                    leadingIcon = Icons.Rounded.Person,
                                    modifier = Modifier.weight(1f)
                                )
                                CompactAuthField(
                                    value = lastName,
                                    onValueChange = { lastName = it; errorMsg = "" },
                                    placeholder = "Last name *",
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            Spacer(Modifier.height(11.dp))

                            // Compact India-Only (+91) Mobile Input
                            IndiaMobileField(
                                phone = phone,
                                onPhoneChange = {
                                    phone = it
                                    errorMsg = ""
                                },
                                placeholder = "Mobile number *"
                            )

                            Spacer(Modifier.height(11.dp))

                            // Email Address
                            CompactAuthField(
                                value = email,
                                onValueChange = { email = it; errorMsg = "" },
                                placeholder = "Email address (optional)",
                                leadingIcon = Icons.Rounded.Email,
                                keyboardType = KeyboardType.Email
                            )

                            Spacer(Modifier.height(11.dp))

                            // Referral / Agent Code
                            CompactAuthField(
                                value = referralCode,
                                onValueChange = { referralCode = it.uppercase() },
                                placeholder = "Referral / Agent code (optional)",
                                leadingIcon = Icons.Rounded.CardGiftcard
                            )

                            Spacer(Modifier.height(13.dp))

                            // Compact 18+ & Terms Consent Row
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { adultConfirmed = !adultConfirmed }
                                    .padding(vertical = 2.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clip(RoundedCornerShape(5.dp))
                                        .background(if (adultConfirmed) MaxxColors.OrangeStart else Color.Transparent)
                                        .border(
                                            width = 1.4.dp,
                                            color = if (adultConfirmed) MaxxColors.OrangeStart else MaxxColors.TextMuted,
                                            shape = RoundedCornerShape(5.dp)
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (adultConfirmed) {
                                        Icon(Icons.Rounded.Check, null, tint = Color.White, modifier = Modifier.size(14.dp))
                                    }
                                }
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    text = "I confirm I am 18+ and agree to Terms & Privacy Policy",
                                    color = MaxxColors.TextSecondary,
                                    fontSize = 11.5.sp,
                                    lineHeight = 15.sp
                                )
                            }

                            if (errorMsg.isNotBlank()) {
                                Spacer(Modifier.height(10.dp))
                                AuthErrorBox(errorMsg)
                            }

                            Spacer(Modifier.height(16.dp))

                            AuthOrangeButton(
                                text = "Send Verification Code",
                                onClick = { sendSignupOtp(isResend = false) },
                                loading = loading
                            )

                            Spacer(Modifier.height(20.dp))

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Already have an account? ", color = MaxxColors.TextSecondary, fontSize = 13.5.sp)
                                Text(
                                    text = "Sign in now.",
                                    color = Color.White,
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.clickable(onClick = onNavigateLogin)
                                )
                            }

                            Spacer(Modifier.height(10.dp))

                            Text(
                                text = "Instant SMS OTP verification protects your account across Web, Mobile, and Smart TV.",
                                color = MaxxColors.TextMuted,
                                fontSize = 11.sp,
                                lineHeight = 15.sp
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
