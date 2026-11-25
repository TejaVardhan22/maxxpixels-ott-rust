package com.maxxpixels.ui.screens.subscription

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.LocalOffer
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.maxxpixels.data.model.CreatedOrder
import com.maxxpixels.data.model.SubscriptionPlan
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.ApiDisconnectView
import com.maxxpixels.ui.components.ShimmerBox
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

/**
 * Modern Warm Amber-Gold Frosted Glass Subscription Screen:
 * Synced 1:1 with the Home, Details, and Profile visual design system.
 */
@Composable
fun SubscriptionScreen(
    repository: MaxxRepository,
    onLaunchRazorpay: (order: CreatedOrder, plan: SubscriptionPlan) -> Unit,
    onSubscriptionActivated: () -> Unit,
    onBackHome: () -> Unit,
    onSignedOut: () -> Unit
) {
    val brand by repository.sessionManager.brand.collectAsState()
    val session by repository.sessionManager.session.collectAsState()
    val isVip = session?.hasActiveSubscription == true
    val scope = rememberCoroutineScope()

    var plans by remember { mutableStateOf<List<SubscriptionPlan>>(emptyList()) }
    var selectedPlan by remember { mutableStateOf<SubscriptionPlan?>(null) }
    var loadingPlans by remember { mutableStateOf(true) }
    var disconnectError by remember { mutableStateOf<String?>(null) }

    var couponInput by remember { mutableStateOf("") }
    var appliedCouponCode by remember { mutableStateOf<String?>(null) }
    var discountAmount by remember { mutableStateOf(0.0) }
    var couponError by remember { mutableStateOf("") }
    var validatingCoupon by remember { mutableStateOf(false) }

    var checkoutLoading by remember { mutableStateOf(false) }
    var checkoutError by remember { mutableStateOf("") }

    fun fetchPlans() {
        loadingPlans = true
        disconnectError = null
        scope.launch {
            when (val res = repository.getPlans()) {
                is ApiResult.Success -> {
                    plans = res.data
                    selectedPlan = res.data.firstOrNull { it.isPopular && !it.isActivePlan }
                        ?: res.data.firstOrNull { !it.isActivePlan }
                        ?: res.data.firstOrNull()
                }
                is ApiResult.Error -> disconnectError = res.message
            }
            loadingPlans = false
        }
    }

    LaunchedEffect(Unit) { fetchPlans() }

    if (disconnectError != null && plans.isEmpty()) {
        ApiDisconnectView(
            title = "Unable to load plans",
            message = disconnectError!!,
            onRetry = { fetchPlans() }
        )
        return
    }

    val effectivePrice = ((selectedPlan?.price ?: 0.0) - discountAmount).coerceAtLeast(0.0)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Frosted Top Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            if (brand.logoUrl.isNotBlank()) {
                AsyncImage(
                    model = brand.logoUrl,
                    contentDescription = brand.name,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.height(34.dp)
                )
            } else {
                Text(
                    text = brand.name.uppercase(),
                    color = Color.White,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (isVip) {
                    Surface(
                        color = Color.White.copy(alpha = 0.09f),
                        shape = RoundedCornerShape(999.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                        modifier = Modifier.clickable(onClick = onBackHome)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowBack, null, tint = Color.White, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(5.dp))
                            Text("Back", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Surface(
                    color = Color.White.copy(alpha = 0.09f),
                    shape = RoundedCornerShape(999.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                    modifier = Modifier.clickable {
                        scope.launch {
                            repository.logout()
                            onSignedOut()
                        }
                    }
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.Logout, null, tint = MaxxColors.TextSecondary, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(5.dp))
                        Text("Sign Out", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Surface(
                    color = MaxxColors.PrimaryTint,
                    shape = RoundedCornerShape(999.dp),
                    border = BorderStroke(1.dp, MaxxColors.Primary.copy(alpha = 0.45f))
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
                    ) {
                        Icon(Icons.Rounded.WorkspacePremium, null, tint = MaxxColors.Primary, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(5.dp))
                        Text(
                            text = "MAXXPIXELS VIP",
                            color = MaxxColors.PrimaryLight,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.2.sp
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    text = "Unlock unlimited Kannada & Indian cinema",
                    color = Color.White,
                    fontSize = 25.sp,
                    fontWeight = FontWeight.Black,
                    lineHeight = 30.sp
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Stream Movies, Web Series, Short Films & Originals across Mobile, Web & Smart TV.",
                    color = MaxxColors.TextSecondary,
                    fontSize = 13.sp,
                    lineHeight = 19.sp
                )
            }

            if (loadingPlans) {
                items(3) {
                    ShimmerBox(modifier = Modifier.fillMaxWidth().height(140.dp), shape = RoundedCornerShape(22.dp))
                }
            } else {
                items(plans, key = { it.id }) { plan ->
                    val isSelected = selectedPlan?.id == plan.id
                    PlanCard(
                        plan = plan,
                        selected = isSelected,
                        discountedPrice = if (isSelected && appliedCouponCode != null) effectivePrice else null,
                        onSelect = {
                            selectedPlan = plan
                            appliedCouponCode = null
                            discountAmount = 0.0
                            couponError = ""
                        }
                    )
                }

                // Frosted Glass Coupon Bar
                item {
                    Surface(
                        color = Color.White.copy(alpha = 0.06f),
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            if (appliedCouponCode != null) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(MaxxColors.PrimaryTint)
                                        .padding(horizontal = 14.dp, vertical = 11.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Rounded.LocalOffer, null, tint = MaxxColors.Primary, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(
                                            text = "$appliedCouponCode — ₹${discountAmount.toInt()} off",
                                            color = MaxxColors.PrimaryLight,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Icon(
                                        Icons.Rounded.Close,
                                        contentDescription = "Remove coupon",
                                        tint = Color.White,
                                        modifier = Modifier
                                            .size(18.dp)
                                            .clickable {
                                                appliedCouponCode = null
                                                discountAmount = 0.0
                                            }
                                    )
                                }
                            } else {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    OutlinedTextField(
                                        value = couponInput,
                                        onValueChange = { couponInput = it.uppercase(); couponError = "" },
                                        placeholder = { Text("Have a coupon code?", color = MaxxColors.TextMuted, fontSize = 13.sp) },
                                        singleLine = true,
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = MaxxColors.Primary,
                                            unfocusedBorderColor = Color.White.copy(alpha = 0.16f),
                                            focusedContainerColor = Color.Black.copy(alpha = 0.28f),
                                            unfocusedContainerColor = Color.Black.copy(alpha = 0.28f),
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White
                                        ),
                                        shape = RoundedCornerShape(14.dp),
                                        modifier = Modifier.weight(1f)
                                    )
                                    Box(
                                        modifier = Modifier
                                            .height(52.dp)
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(
                                                if (couponInput.isNotBlank() && !validatingCoupon) MaxxColors.BrandGradient
                                                else Brush.horizontalGradient(listOf(Color.White.copy(alpha = 0.10f), Color.White.copy(alpha = 0.10f)))
                                            )
                                            .clickable(enabled = couponInput.isNotBlank() && !validatingCoupon) {
                                                val pkg = selectedPlan ?: return@clickable
                                                val code = couponInput.trim().uppercase()
                                                if (code.isBlank()) return@clickable
                                                validatingCoupon = true
                                                couponError = ""
                                                scope.launch {
                                                    when (val res = repository.validateCoupon(code, pkg.price, pkg.id)) {
                                                        is ApiResult.Success -> {
                                                            appliedCouponCode = code
                                                            discountAmount = res.data
                                                            couponInput = ""
                                                        }
                                                        is ApiResult.Error -> couponError = res.message
                                                    }
                                                    validatingCoupon = false
                                                }
                                            }
                                            .padding(horizontal = 18.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = if (validatingCoupon) "..." else "Apply",
                                            color = if (couponInput.isNotBlank()) MaxxColors.OnPrimaryDark else Color.White.copy(alpha = 0.5f),
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 13.sp
                                        )
                                    }
                                }
                            }
                            if (couponError.isNotBlank()) {
                                Spacer(Modifier.height(8.dp))
                                Text(couponError, color = MaxxColors.ErrorSoft, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }

            if (checkoutError.isNotBlank()) {
                item {
                    Surface(
                        color = Color(0x22EF4444),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color(0x55EF4444)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = checkoutError,
                            color = MaxxColors.ErrorSoft,
                            fontSize = 12.5.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Rounded.VerifiedUser, null, tint = MaxxColors.Success, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Secured by Razorpay • Instant activation", color = MaxxColors.TextMuted, fontSize = 11.5.sp)
                }
            }
        }

        // Frosted Sticky Bottom Checkout Dock
        selectedPlan?.let { plan ->
            Surface(
                color = Color(0xF215131B),
                shape = RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 16.dp)) {
                    val ctaEnabled = !plan.isActivePlan && !checkoutLoading
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                if (ctaEnabled) MaxxColors.BrandGradient
                                else Brush.horizontalGradient(listOf(Color(0xFF3A3542), Color(0xFF3A3542)))
                            )
                            .clickable(enabled = ctaEnabled) {
                                checkoutLoading = true
                                checkoutError = ""
                                scope.launch {
                                    when (val orderRes = repository.createSubscriptionOrder(plan, appliedCouponCode)) {
                                        is ApiResult.Success -> {
                                            val order = orderRes.data
                                            if (order.isFree) {
                                                onSubscriptionActivated()
                                            } else {
                                                onLaunchRazorpay(order, plan)
                                            }
                                        }
                                        is ApiResult.Error -> checkoutError = orderRes.message
                                    }
                                    checkoutLoading = false
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (checkoutLoading) {
                            CircularProgressIndicator(
                                color = MaxxColors.OnPrimaryDark,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(22.dp)
                            )
                        } else {
                            Text(
                                text = when {
                                    plan.isActivePlan -> "Current Active Plan"
                                    effectivePrice <= 0.0 -> "Activate ${plan.name} Free"
                                    else -> "Continue with ${plan.name} • ${plan.currency}${effectivePrice.toInt()}"
                                },
                                color = if (ctaEnabled) MaxxColors.OnPrimaryDark else Color.White.copy(alpha = 0.6f),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlanCard(
    plan: SubscriptionPlan,
    selected: Boolean,
    discountedPrice: Double?,
    onSelect: () -> Unit
) {
    val borderColor = if (selected) MaxxColors.Primary else Color.White.copy(alpha = 0.12f)
    val displayPrice = discountedPrice ?: plan.price

    Surface(
        color = if (selected) Color(0xFF231A1D) else Color.White.copy(alpha = 0.06f),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(if (selected) 1.8.dp else 1.dp, borderColor),
        modifier = Modifier
            .fillMaxWidth()
            .bounceClick(onClick = onSelect)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Text(plan.name, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                    if (plan.isPopular) {
                        Spacer(Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(MaxxColors.BrandGradient)
                                .padding(horizontal = 9.dp, vertical = 3.dp)
                        ) {
                            Text("POPULAR", color = MaxxColors.OnPrimaryDark, fontSize = 9.sp, fontWeight = FontWeight.Black)
                        }
                    } else if (plan.isActivePlan) {
                        Spacer(Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(Color(0x2810B981))
                                .padding(horizontal = 9.dp, vertical = 3.dp)
                        ) {
                            Text("ACTIVE", color = MaxxColors.Success, fontSize = 9.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
                Row(verticalAlignment = Alignment.Bottom) {
                    if (discountedPrice != null && discountedPrice < plan.price) {
                        Text(
                            text = "${plan.currency}${plan.price.toInt()}",
                            color = MaxxColors.TextMuted,
                            fontSize = 13.sp,
                            textDecoration = TextDecoration.LineThrough
                        )
                        Spacer(Modifier.width(6.dp))
                    }
                    Text(
                        text = if (displayPrice <= 0.0) "FREE" else "${plan.currency}${displayPrice.toInt()}",
                        color = if (selected) MaxxColors.Primary else Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }

            if (plan.durationDays > 0) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "${plan.durationDays} days • ${plan.maxQuality} • ${plan.maxScreens} screen${if (plan.maxScreens > 1) "s" else ""}",
                    color = MaxxColors.TextSecondary,
                    fontSize = 11.5.sp
                )
            }

            Spacer(Modifier.height(12.dp))

            plan.features.take(4).forEach { feat ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = 3.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(18.dp)
                            .clip(CircleShape)
                            .background(MaxxColors.PrimaryTint),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Rounded.Check, null, tint = MaxxColors.Primary, modifier = Modifier.size(12.dp))
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(feat, color = Color.White.copy(alpha = 0.85f), fontSize = 12.5.sp)
                }
            }
        }
    }
}
