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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import com.maxxpixels.ui.components.MaxxPrimaryButton
import com.maxxpixels.ui.components.ShimmerBox
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

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
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Minimal Netflix-style header (No bottom nav or browsing bar)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
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
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (isVip) {
                    Surface(
                        color = MaxxColors.SurfaceDark,
                        shape = RoundedCornerShape(99.dp),
                        border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                        modifier = Modifier.clickable(onClick = onBackHome)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                        ) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowBack, null, tint = Color.White, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(5.dp))
                            Text("Home", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Surface(
                    color = MaxxColors.SurfaceDark,
                    shape = RoundedCornerShape(99.dp),
                    border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                    modifier = Modifier.clickable {
                        scope.launch {
                            repository.logout()
                            onSignedOut()
                        }
                    }
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
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
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text(
                    text = "CHOOSE YOUR PLAN",
                    color = MaxxColors.OrangeSoft,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.6.sp
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Unlock unlimited Kannada & Indian cinema",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    lineHeight = 29.sp
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Watch Movies, Web Series, Short Films & Originals across Mobile, Web & Smart TV.",
                    color = MaxxColors.TextSecondary,
                    fontSize = 13.sp,
                    lineHeight = 19.sp
                )
                Spacer(Modifier.height(8.dp))
            }

            if (loadingPlans) {
                items(3) {
                    ShimmerBox(modifier = Modifier.fillMaxWidth().height(136.dp), shape = RoundedCornerShape(16.dp))
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

                // Coupon Bar
                item {
                    Spacer(Modifier.height(4.dp))
                    Surface(
                        color = MaxxColors.SurfaceDark,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            if (appliedCouponCode != null) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(MaxxColors.OrangeTint)
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Rounded.LocalOffer, null, tint = MaxxColors.OrangeSoft, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(
                                            text = "$appliedCouponCode — ₹${discountAmount.toInt()} off",
                                            color = MaxxColors.OrangeSoft,
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
                                        placeholder = { Text("Have a coupon code?", fontSize = 13.sp) },
                                        singleLine = true,
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = MaxxColors.OrangeStart,
                                            unfocusedBorderColor = MaxxColors.BorderStrong,
                                            focusedContainerColor = MaxxColors.SurfaceElevated,
                                            unfocusedContainerColor = MaxxColors.SurfaceElevated,
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White
                                        ),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    )
                                    Button(
                                        onClick = {
                                            val pkg = selectedPlan ?: return@Button
                                            val code = couponInput.trim().uppercase()
                                            if (code.isBlank()) return@Button
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
                                        },
                                        enabled = couponInput.isNotBlank() && !validatingCoupon,
                                        colors = ButtonDefaults.buttonColors(containerColor = MaxxColors.SurfaceElevated),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)
                                    ) {
                                        Text(if (validatingCoupon) "..." else "Apply", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
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
                    Text(checkoutError, color = MaxxColors.ErrorSoft, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }
        }

        // Sticky Bottom Checkout Bar
        selectedPlan?.let { plan ->
            Surface(
                color = MaxxColors.SurfaceDark,
                border = BorderStroke(0.5.dp, MaxxColors.BorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
                    MaxxPrimaryButton(
                        text = if (plan.isActivePlan) {
                            "Current Active Plan"
                        } else if (effectivePrice <= 0.0) {
                            "Activate ${plan.name} Free"
                        } else {
                            "Continue with ${plan.name} • ${plan.currency}${effectivePrice.toInt()}"
                        },
                        enabled = !plan.isActivePlan,
                        loading = checkoutLoading,
                        onClick = {
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
                        modifier = Modifier.fillMaxWidth()
                    )
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
    val borderColor = if (selected) MaxxColors.OrangeStart else MaxxColors.BorderSubtle
    val displayPrice = discountedPrice ?: plan.price

    Surface(
        color = if (selected) Color(0xFF1A1412) else MaxxColors.SurfaceDark,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(if (selected) 1.8.dp else 1.dp, borderColor),
        modifier = Modifier
            .fillMaxWidth()
            .bounceClick(onClick = onSelect)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(plan.name, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                    if (plan.isPopular) {
                        Spacer(Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(MaxxColors.BrandGradient)
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text("POPULAR", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
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
                        color = if (selected) MaxxColors.OrangeSoft else Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            plan.features.take(3).forEach { feat ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = 2.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(MaxxColors.OrangeTint),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Rounded.Check, null, tint = MaxxColors.OrangeStart, modifier = Modifier.size(11.dp))
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(feat, color = MaxxColors.TextSecondary, fontSize = 12.5.sp)
                }
            }
        }
    }
}
