package com.maxxpixels

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import coil.compose.AsyncImage
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.model.CoinOrderData
import com.maxxpixels.data.model.CoinPackItem
import com.maxxpixels.data.model.CreatedOrder
import com.maxxpixels.data.model.MaintenanceStatus
import com.maxxpixels.data.model.SubscriptionPlan
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.ui.components.NoInternetScreen
import com.maxxpixels.ui.components.OfflineStatusBanner
import com.maxxpixels.ui.screens.auth.LoginScreen
import com.maxxpixels.ui.screens.auth.SignUpScreen
import com.maxxpixels.ui.screens.details.DetailsScreen
import com.maxxpixels.ui.screens.games.GamesHubScreen
import com.maxxpixels.ui.screens.games.GamesWalletScreen
import com.maxxpixels.ui.screens.home.HomeScreen
import com.maxxpixels.ui.screens.newhot.NewHotScreen
import com.maxxpixels.ui.screens.player.PlayerScreen
import com.maxxpixels.ui.screens.portal.PortalSelectionScreen
import com.maxxpixels.ui.screens.profile.AccountScreen
import com.maxxpixels.ui.screens.profile.CategoryContentScreen
import com.maxxpixels.ui.screens.profile.HelpSupportScreen
import com.maxxpixels.ui.screens.profile.MyDownloadsScreen
import com.maxxpixels.ui.screens.profile.NotificationsScreen
import com.maxxpixels.ui.screens.profile.PrivacyLegalScreen
import com.maxxpixels.ui.screens.profile.ProfileScreen
import com.maxxpixels.ui.screens.profile.RentalsScreen
import com.maxxpixels.ui.screens.profile.SettingsScreen
import com.maxxpixels.ui.screens.profile.StorageScreen
import com.maxxpixels.ui.screens.profile.WatchlistScreen
import com.maxxpixels.ui.screens.search.SearchScreen
import com.maxxpixels.ui.screens.splash.SplashScreen
import com.maxxpixels.ui.screens.subscription.SubscriptionScreen
import com.maxxpixels.ui.theme.MaxxColors
import com.maxxpixels.ui.theme.MaxxPixelsTheme
import com.razorpay.Checkout
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.URLDecoder
import java.net.URLEncoder

class MainActivity : ComponentActivity(), PaymentResultWithDataListener {

    private var pendingOrder: Pair<CreatedOrder, SubscriptionPlan>? = null
    private var onPaymentSuccessCallback: (() -> Unit)? = null

    private var pendingCoinOrder: Pair<CoinOrderData, CoinPackItem>? = null
    private var onCoinPaymentSuccessCallback: (() -> Unit)? = null

    private var pendingTvodOrder: Pair<CreatedOrder, CatalogItem>? = null
    private var onTvodPaymentSuccessCallback: (() -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Checkout.preload(applicationContext)

        val app = application as MaxxPixelsApplication

        setContent {
            MaxxPixelsTheme {
                MaxxPixelsApp(
                    app = app,
                    onStartRazorpay = { order, plan, onActivated ->
                        pendingCoinOrder = null
                        pendingTvodOrder = null
                        pendingOrder = order to plan
                        onPaymentSuccessCallback = onActivated
                        launchRazorpayCheckout(order, plan, app)
                    },
                    onStartCoinRazorpay = { order, pack, onCredited ->
                        pendingOrder = null
                        pendingTvodOrder = null
                        pendingCoinOrder = order to pack
                        onCoinPaymentSuccessCallback = onCredited
                        launchCoinRazorpayCheckout(order, pack, app)
                    },
                    onStartTvodRazorpay = { order, item, onUnlocked ->
                        pendingOrder = null
                        pendingCoinOrder = null
                        pendingTvodOrder = order to item
                        onTvodPaymentSuccessCallback = onUnlocked
                        launchTvodRazorpayCheckout(order, item, app)
                    }
                )
            }
        }
    }

    private fun launchTvodRazorpayCheckout(
        order: CreatedOrder,
        item: CatalogItem,
        app: MaxxPixelsApplication
    ) {
        try {
            val checkout = Checkout()
            checkout.setKeyID(order.keyId)
            val user = app.sessionManager.session.value
            val options = JSONObject().apply {
                put("name", "MaxxPixels")
                put("description", "Rent: ${item.title}")
                put("currency", order.currency)
                put("amount", order.amountPaise)
                if (!order.gatewayOrderId.isNullOrBlank()) {
                    put("order_id", order.gatewayOrderId)
                }
                put("theme", JSONObject().put("color", "#FFB52E"))
                put("prefill", JSONObject().apply {
                    put("name", user?.fullName.orEmpty())
                    put("email", user?.email.orEmpty())
                    put("contact", user?.phoneNumber.orEmpty())
                })
            }
            checkout.open(this, options)
        } catch (e: Exception) {
            pendingTvodOrder = null
            Toast.makeText(this, e.message ?: "Unable to launch Razorpay", Toast.LENGTH_LONG).show()
        }
    }

    private fun launchCoinRazorpayCheckout(
        order: CoinOrderData,
        pack: CoinPackItem,
        app: MaxxPixelsApplication
    ) {
        try {
            val checkout = Checkout()
            checkout.setKeyID(order.keyId)
            val user = app.sessionManager.session.value
            val desc = buildString {
                append("${pack.coins} game coins")
                if (pack.label.isNotBlank()) append(" · ${pack.label}")
            }
            val options = JSONObject().apply {
                put("name", "MaxxPixels")
                put("description", desc)
                put("currency", order.currency)
                put("amount", if (order.amountPaise > 0) order.amountPaise else (pack.amountInr * 100).toInt())
                put("order_id", order.razorpayOrderId)
                put("theme", JSONObject().put("color", "#A855F7"))
                put("prefill", JSONObject().apply {
                    put("name", user?.fullName.orEmpty())
                    put("email", user?.email.orEmpty())
                    put("contact", user?.phoneNumber.orEmpty())
                })
            }
            checkout.open(this, options)
        } catch (e: Exception) {
            pendingCoinOrder = null
            Toast.makeText(this, e.message ?: "Unable to launch Razorpay", Toast.LENGTH_LONG).show()
        }
    }

    private fun launchRazorpayCheckout(
        order: CreatedOrder,
        plan: SubscriptionPlan,
        app: MaxxPixelsApplication
    ) {
        try {
            val checkout = Checkout()
            checkout.setKeyID(order.keyId)
            val user = app.sessionManager.session.value
            val options = JSONObject().apply {
                put("name", "MaxxPixels")
                put("description", plan.name)
                put("currency", order.currency)
                put("amount", order.amountPaise)
                if (!order.gatewayOrderId.isNullOrBlank()) {
                    put("order_id", order.gatewayOrderId)
                }
                put("theme", JSONObject().put("color", "#E50914"))
                put("prefill", JSONObject().apply {
                    put("name", user?.fullName.orEmpty())
                    put("email", user?.email.orEmpty())
                    put("contact", user?.phoneNumber.orEmpty())
                })
            }
            checkout.open(this, options)
        } catch (e: Exception) {
            Toast.makeText(this, e.message ?: "Unable to launch Razorpay", Toast.LENGTH_LONG).show()
        }
    }

    override fun onPaymentSuccess(razorpayPaymentId: String?, paymentData: PaymentData?) {
        val app = application as MaxxPixelsApplication
        val paymentId = razorpayPaymentId ?: paymentData?.paymentId ?: return
        val signature = paymentData?.signature.orEmpty()

        // 1. Coin pack recharge callback
        val coinPair = pendingCoinOrder
        if (coinPair != null) {
            pendingCoinOrder = null
            val (order, pack) = coinPair
            val orderId = paymentData?.orderId?.takeIf { it.isNotBlank() } ?: order.razorpayOrderId
            lifecycleScope.launch {
                when (val res = app.repository.verifyCoinPayment(orderId, paymentId, signature)) {
                    is ApiResult.Success -> {
                        val added = if (res.data > 0) res.data else pack.coins
                        Toast.makeText(
                            this@MainActivity,
                            "$added coins added to your wallet!",
                            Toast.LENGTH_SHORT
                        ).show()
                        onCoinPaymentSuccessCallback?.invoke()
                    }
                    is ApiResult.Error -> {
                        Toast.makeText(this@MainActivity, res.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            return
        }

        // 2. TVOD Rental callback
        val tvodPair = pendingTvodOrder
        if (tvodPair != null) {
            pendingTvodOrder = null
            val (order, item) = tvodPair
            val orderId = paymentData?.orderId?.takeIf { it.isNotBlank() } ?: order.orderId
            lifecycleScope.launch {
                when (val res = app.repository.verifyTvodPayment(orderId, paymentId, signature)) {
                    is ApiResult.Success -> {
                        Toast.makeText(this@MainActivity, "${item.title} unlocked!", Toast.LENGTH_SHORT).show()
                        onTvodPaymentSuccessCallback?.invoke()
                    }
                    is ApiResult.Error -> {
                        Toast.makeText(this@MainActivity, res.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            return
        }

        // 3. OTT Subscription callback
        val pair = pendingOrder ?: return
        pendingOrder = null
        val (order, plan) = pair
        val orderId = paymentData?.orderId ?: order.orderId

        lifecycleScope.launch {
            when (val res = app.repository.verifyPayment(orderId, paymentId, signature, plan.name)) {
                is ApiResult.Success -> {
                    Toast.makeText(this@MainActivity, "${plan.name} activated!", Toast.LENGTH_SHORT).show()
                    // Trigger subscription coin benefit in background
                    app.repository.claimSubscriptionCoins(paymentId = paymentId)
                    onPaymentSuccessCallback?.invoke()
                }
                is ApiResult.Error -> {
                    Toast.makeText(this@MainActivity, res.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    override fun onPaymentError(code: Int, description: String?, paymentData: PaymentData?) {
        pendingOrder = null
        pendingCoinOrder = null
        pendingTvodOrder = null
        Toast.makeText(this, description ?: "Payment cancelled", Toast.LENGTH_SHORT).show()
    }
}

@Composable
private fun MaxxPixelsApp(
    app: MaxxPixelsApplication,
    onStartRazorpay: (CreatedOrder, SubscriptionPlan, () -> Unit) -> Unit,
    onStartCoinRazorpay: (CoinOrderData, CoinPackItem, () -> Unit) -> Unit,
    onStartTvodRazorpay: (CreatedOrder, CatalogItem, () -> Unit) -> Unit
) {
    val navController = rememberNavController()
    val isOnline by app.networkMonitor.isOnline.collectAsState()
    val scope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current

    var maintenance by remember { mutableStateOf(MaintenanceStatus()) }
    var checkingMaintenance by remember { mutableStateOf(false) }
    var viewingOfflineDownloads by remember { mutableStateOf(false) }
    var checkingNetwork by remember { mutableStateOf(false) }

    LaunchedEffect(isOnline) {
        if (isOnline) {
            viewingOfflineDownloads = false
        }
    }

    fun refreshMaintenance() {
        scope.launch {
            checkingMaintenance = true
            maintenance = app.repository.checkMaintenanceStatus()
            checkingMaintenance = false
        }
    }

    LaunchedEffect(Unit) {
        refreshMaintenance()
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                refreshMaintenance()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (maintenance.active) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF08080C))
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                color = Color(0xFF12121A),
                shape = RoundedCornerShape(20.dp),
                border = BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (maintenance.logoUrl.isNotBlank()) {
                        AsyncImage(
                            model = maintenance.logoUrl,
                            contentDescription = maintenance.appName,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.height(48.dp)
                        )
                    } else {
                        Text(
                            text = maintenance.appName,
                            color = Color.White,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                    Spacer(Modifier.height(16.dp))
                    Surface(
                        color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(99.dp),
                        border = BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.4f))
                    ) {
                        Text(
                            text = "SCHEDULED MAINTENANCE",
                            color = Color(0xFFFCD34D),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.8.sp,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
                        )
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(
                        text = "We'll Be Right Back",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = maintenance.message,
                        color = Color(0xFFD4D4D8),
                        fontSize = 14.sp,
                        lineHeight = 21.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(22.dp))
                    Button(
                        onClick = { refreshMaintenance() },
                        enabled = !checkingMaintenance,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        if (checkingMaintenance) {
                            CircularProgressIndicator(
                                color = Color.White,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(18.dp)
                            )
                        } else {
                            Text("Check Status Again", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
        return
    }

    // Full-Screen Amazon/Prime-style Offline Screen when no network / internet is available
    if (!isOnline) {
        if (viewingOfflineDownloads) {
            MyDownloadsScreen(
                onBack = { viewingOfflineDownloads = false },
                onExplore = {
                    if (app.networkMonitor.refresh()) {
                        viewingOfflineDownloads = false
                    }
                }
            )
        } else {
            NoInternetScreen(
                checking = checkingNetwork,
                onRetry = {
                    checkingNetwork = true
                    scope.launch {
                        kotlinx.coroutines.delay(350)
                        val backOnline = app.networkMonitor.refresh()
                        checkingNetwork = false
                        if (backOnline) {
                            refreshMaintenance()
                        }
                    }
                },
                onOpenDownloads = { viewingOfflineDownloads = true }
            )
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
    ) {
        OfflineStatusBanner(isOffline = !isOnline)

        Box(modifier = Modifier.weight(1f)) {
            NavHost(
                navController = navController,
                startDestination = "splash",
                enterTransition = {
                    fadeIn(tween(200, easing = FastOutSlowInEasing)) +
                        slideInHorizontally(tween(220, easing = FastOutSlowInEasing)) { it / 12 }
                },
                exitTransition = {
                    fadeOut(tween(150, easing = FastOutSlowInEasing))
                },
                popEnterTransition = {
                    fadeIn(tween(180, easing = FastOutSlowInEasing)) +
                        slideInHorizontally(tween(200, easing = FastOutSlowInEasing)) { -it / 14 }
                },
                popExitTransition = {
                    fadeOut(tween(170, easing = FastOutSlowInEasing)) +
                        slideOutHorizontally(tween(190, easing = FastOutSlowInEasing)) { it / 12 }
                }
            ) {
                composable("splash") {
                    SplashScreen(
                        repository = app.repository,
                        onNavigateLogin = {
                            navController.navigate("login") { popUpTo("splash") { inclusive = true } }
                        },
                        onNavigateSubscription = {
                            navController.navigate("subscription") { popUpTo("splash") { inclusive = true } }
                        },
                        onNavigateHome = {
                            navController.navigate("portal") { popUpTo("splash") { inclusive = true } }
                        }
                    )
                }

                composable("login") {
                    LoginScreen(
                        repository = app.repository,
                        onAuthenticated = { hasActiveSub ->
                            val target = if (hasActiveSub) "portal" else "subscription"
                            navController.navigate(target) { popUpTo("login") { inclusive = true } }
                        },
                        onNavigateSignUp = { prefillPhone ->
                            val safe = URLEncoder.encode(prefillPhone, "UTF-8")
                            navController.navigate("signup?phone=$safe")
                        }
                    )
                }

                composable(
                    route = "signup?phone={phone}",
                    arguments = listOf(navArgument("phone") { type = NavType.StringType; defaultValue = "" })
                ) { entry ->
                    val prefill = URLDecoder.decode(entry.arguments?.getString("phone").orEmpty(), "UTF-8")
                    SignUpScreen(
                        repository = app.repository,
                        prefillPhone = prefill,
                        onAuthenticated = { hasActiveSub ->
                            val target = if (hasActiveSub) "portal" else "subscription"
                            navController.navigate(target) { popUpTo(0) { inclusive = true } }
                        },
                        onNavigateLogin = { navController.popBackStack() }
                    )
                }

                composable("subscription") {
                    SubscriptionScreen(
                        repository = app.repository,
                        onLaunchRazorpay = { order, plan ->
                            onStartRazorpay(order, plan) {
                                navController.navigate("portal") {
                                    popUpTo("subscription") { inclusive = true }
                                }
                            }
                        },
                        onSubscriptionActivated = {
                            navController.navigate("portal") {
                                popUpTo("subscription") { inclusive = true }
                            }
                        },
                        onBackHome = { navController.popBackStack() },
                        onSignedOut = {
                            navController.navigate("login") { popUpTo(0) { inclusive = true } }
                        }
                    )
                }

                // Exact RN PortalSelectionScreen
                composable("portal") {
                    PortalSelectionScreen(
                        repository = app.repository,
                        onOpenOttPortal = { lang, typeId ->
                            navController.navigate("main?lang=$lang&typeId=$typeId&tab=0")
                        },
                        onOpenGamesHub = { navController.navigate("games") },
                        onOpenSearch = { navController.navigate("main?lang=kannada&typeId=0&tab=1") },
                        onOpenSubscription = { navController.navigate("subscription") }
                    )
                }

                composable("games") {
                    GamesHubScreen(
                        repository = app.repository,
                        onBack = { navController.popBackStack() },
                        onOpenWallet = { recommendedCoins ->
                            navController.navigate("games-wallet?recommendedCoins=$recommendedCoins")
                        },
                        onRequireLogin = {
                            navController.navigate("login") { popUpTo(0) { inclusive = true } }
                        }
                    )
                }

                composable(
                    route = "games-wallet?recommendedCoins={recommendedCoins}",
                    arguments = listOf(
                        navArgument("recommendedCoins") {
                            type = NavType.IntType
                            defaultValue = 0
                        }
                    )
                ) { entry ->
                    val recommendedCoins = entry.arguments?.getInt("recommendedCoins") ?: 0
                    GamesWalletScreen(
                        repository = app.repository,
                        recommendedCoins = recommendedCoins,
                        onBack = { navController.popBackStack() },
                        onLaunchCoinRazorpay = { order, pack, onCredited ->
                            onStartCoinRazorpay(order, pack, onCredited)
                        }
                    )
                }

                // 1:1 RN MainScreen 4-Tab Shell: Home | Search | New & Hot | My Space
                composable(
                    route = "main?lang={lang}&typeId={typeId}&tab={tab}",
                    arguments = listOf(
                        navArgument("lang") { type = NavType.StringType; defaultValue = "kannada" },
                        navArgument("typeId") { type = NavType.IntType; defaultValue = 0 },
                        navArgument("tab") { type = NavType.IntType; defaultValue = 0 }
                    )
                ) { entry ->
                    val lang = entry.arguments?.getString("lang") ?: "kannada"
                    val typeId = entry.arguments?.getInt("typeId") ?: 0
                    val initialTab = entry.arguments?.getInt("tab") ?: 0
                    RnMainTabsShell(
                        app = app,
                        initialLanguage = lang,
                        initialTypeId = typeId,
                        initialTab = initialTab,
                        onOpenDetails = { id -> navController.navigate("details/$id") },
                        onPlay = { id, title ->
                            val encoded = URLEncoder.encode(title, "UTF-8")
                            navController.navigate("player/$id/0/$encoded")
                        },
                        onOpenNotifications = { navController.navigate("notifications") },
                        onOpenCategory = { title, tid, l ->
                            val enc = URLEncoder.encode(title, "UTF-8")
                            navController.navigate("category/$enc/$tid/$l")
                        },
                        onOpenGames = { navController.navigate("games") },
                        onOpenSubscription = { navController.navigate("subscription") },
                        onOpenAccount = { navController.navigate("account") },
                        onOpenWatchlist = { navController.navigate("watchlist") },
                        onOpenRentals = { navController.navigate("rentals") },
                        onOpenDownloads = { navController.navigate("downloads") },
                        onOpenStorage = { navController.navigate("storage") },
                        onOpenSettings = { navController.navigate("settings") },
                        onOpenHelp = { navController.navigate("help") },
                        onOpenLegal = { navController.navigate("legal") },
                        onOpenPortalHub = {
                            navController.navigate("portal") { launchSingleTop = true }
                        },
                        onSignedOut = {
                            navController.navigate("login") { popUpTo(0) { inclusive = true } }
                        }
                    )
                }

                composable("account") {
                    AccountScreen(repository = app.repository, onBack = { navController.popBackStack() })
                }

                composable("notifications") {
                    NotificationsScreen(repository = app.repository, onBack = { navController.popBackStack() })
                }

                composable("watchlist") {
                    WatchlistScreen(
                        repository = app.repository,
                        onBack = { navController.popBackStack() },
                        onOpenDetails = { id -> navController.navigate("details/$id") },
                        onExplore = { navController.popBackStack() }
                    )
                }

                composable("rentals") {
                    RentalsScreen(
                        repository = app.repository,
                        onBack = { navController.popBackStack() },
                        onOpenDetails = { id -> navController.navigate("details/$id") }
                    )
                }

                composable("downloads") {
                    MyDownloadsScreen(
                        onBack = { navController.popBackStack() },
                        onExplore = { navController.popBackStack() }
                    )
                }

                composable("storage") {
                    StorageScreen(onBack = { navController.popBackStack() })
                }

                composable("settings") {
                    SettingsScreen(onBack = { navController.popBackStack() })
                }

                composable("help") {
                    HelpSupportScreen(onBack = { navController.popBackStack() })
                }

                composable("legal") {
                    PrivacyLegalScreen(repository = app.repository, onBack = { navController.popBackStack() })
                }

                composable(
                    route = "category/{title}/{typeId}/{lang}",
                    arguments = listOf(
                        navArgument("title") { type = NavType.StringType },
                        navArgument("typeId") { type = NavType.IntType },
                        navArgument("lang") { type = NavType.StringType }
                    )
                ) { entry ->
                    val title = URLDecoder.decode(entry.arguments?.getString("title").orEmpty(), "UTF-8")
                    val tid = entry.arguments?.getInt("typeId") ?: 0
                    val l = entry.arguments?.getString("lang") ?: "kannada"
                    CategoryContentScreen(
                        title = title,
                        typeId = tid,
                        language = l,
                        repository = app.repository,
                        onBack = { navController.popBackStack() },
                        onOpenDetails = { id -> navController.navigate("details/$id") }
                    )
                }

                composable(
                    route = "details/{contentId}",
                    arguments = listOf(navArgument("contentId") { type = NavType.LongType })
                ) { entry ->
                    val contentId = entry.arguments?.getLong("contentId") ?: 0L
                    DetailsScreen(
                        contentId = contentId,
                        repository = app.repository,
                        onBack = { navController.popBackStack() },
                        onOpenDetails = { nextId -> navController.navigate("details/$nextId") },
                        onPlay = { cid, epId, title ->
                            val encoded = URLEncoder.encode(title, "UTF-8")
                            navController.navigate("player/$cid/${epId ?: 0L}/$encoded")
                        },
                        onRequireSubscription = { navController.navigate("subscription") },
                        onLaunchTvodRazorpay = { order, item, onUnlocked ->
                            onStartTvodRazorpay(order, item, onUnlocked)
                        }
                    )
                }

                composable(
                    route = "player/{contentId}/{episodeId}/{title}",
                    arguments = listOf(
                        navArgument("contentId") { type = NavType.LongType },
                        navArgument("episodeId") { type = NavType.LongType },
                        navArgument("title") { type = NavType.StringType }
                    )
                ) { entry ->
                    val cid = entry.arguments?.getLong("contentId") ?: 0L
                    val epId = entry.arguments?.getLong("episodeId")?.takeIf { it > 0L }
                    val title = URLDecoder.decode(entry.arguments?.getString("title").orEmpty(), "UTF-8")
                    PlayerScreen(
                        contentId = cid,
                        episodeId = epId,
                        title = title,
                        repository = app.repository,
                        onBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}

/**
 * 1:1 Replication of React Native MainScreen (apps/mobile/src/screens/MainScreen/MainScreen.tsx):
 * 4 Bottom Tabs: Home | Search | New & Hot | My Space (#11141E surface, #E50914 active tint, #8E8E93 inactive)
 */
@Composable
private fun RnMainTabsShell(
    app: MaxxPixelsApplication,
    initialLanguage: String,
    initialTypeId: Int,
    initialTab: Int,
    onOpenDetails: (Long) -> Unit,
    onPlay: (Long, String) -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenCategory: (String, Int, String) -> Unit,
    onOpenGames: () -> Unit,
    onOpenSubscription: () -> Unit,
    onOpenAccount: () -> Unit,
    onOpenWatchlist: () -> Unit,
    onOpenRentals: () -> Unit,
    onOpenDownloads: () -> Unit,
    onOpenStorage: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenHelp: () -> Unit,
    onOpenLegal: () -> Unit,
    onOpenPortalHub: () -> Unit,
    onSignedOut: () -> Unit
) {
    var selectedTab by remember(initialTab) { mutableIntStateOf(initialTab) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
    ) {
        AnimatedContent(
            targetState = selectedTab,
            transitionSpec = {
                fadeIn(tween(170, easing = FastOutSlowInEasing)) togetherWith
                    fadeOut(tween(120, easing = FastOutSlowInEasing))
            },
            label = "mainTabTransition"
        ) { tabIdx ->
            when (tabIdx) {
                0 -> HomeScreen(
                    repository = app.repository,
                    initialLanguage = initialLanguage,
                    initialTypeId = initialTypeId,
                    onOpenDetails = onOpenDetails,
                    onPlayItem = onPlay,
                    onOpenSearch = { selectedTab = 1 },
                    onOpenNotifications = onOpenNotifications,
                    onOpenCategory = onOpenCategory,
                    onOpenSubscription = onOpenSubscription,
                    onOpenGames = onOpenGames,
                    onOpenPortalHub = onOpenPortalHub,
                    onOpenAccount = onOpenAccount
                )
                1 -> SearchScreen(
                    repository = app.repository,
                    onOpenDetails = onOpenDetails
                )
                2 -> NewHotScreen(
                    repository = app.repository,
                    language = initialLanguage,
                    onOpenDetails = onOpenDetails,
                    onPlayItem = onPlay
                )
                else -> ProfileScreen(
                    repository = app.repository,
                    onOpenDetails = onOpenDetails,
                    onOpenSubscription = onOpenSubscription,
                    onOpenAccount = onOpenAccount,
                    onOpenWatchlist = onOpenWatchlist,
                    onOpenRentals = onOpenRentals,
                    onOpenDownloads = onOpenDownloads,
                    onOpenStorage = onOpenStorage,
                    onOpenSettings = onOpenSettings,
                    onOpenHelp = onOpenHelp,
                    onOpenLegal = onOpenLegal,
                    onSignedOut = onSignedOut
                )
            }
        }

        // Floating Frosted Pill Bottom Navigation Bar with Smooth Spring Motion
        val tabs = listOf(
            Triple("Home", Icons.Rounded.Home, 0),
            Triple("Search", Icons.Rounded.Search, 1),
            Triple("New", Icons.Rounded.LocalFireDepartment, 2),
            Triple("Profile", Icons.Rounded.Person, 3)
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Surface(
                color = MaxxColors.FloatingDockBg,
                shape = RoundedCornerShape(999.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                shadowElevation = 18.dp
            ) {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 8.dp, vertical = 7.dp)
                        .animateContentSize(
                            animationSpec = spring(
                                stiffness = Spring.StiffnessMediumLow,
                                dampingRatio = Spring.DampingRatioNoBouncy
                            )
                        ),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    tabs.forEach { (label, icon, idx) ->
                        val active = selectedTab == idx
                        val pillBg by animateColorAsState(
                            targetValue = if (active) Color.White else Color.White.copy(alpha = 0.09f),
                            animationSpec = tween(180),
                            label = "navPillBg"
                        )
                        val iconTint by animateColorAsState(
                            targetValue = if (active) MaxxColors.OnPrimaryDark else Color.White.copy(alpha = 0.85f),
                            animationSpec = tween(180),
                            label = "navIconTint"
                        )
                        Surface(
                            color = pillBg,
                            shape = RoundedCornerShape(999.dp),
                            modifier = Modifier
                                .height(46.dp)
                                .animateContentSize(
                                    animationSpec = spring(
                                        stiffness = Spring.StiffnessMediumLow,
                                        dampingRatio = Spring.DampingRatioNoBouncy
                                    )
                                )
                                .clickable { selectedTab = idx }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = if (active) 18.dp else 13.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(7.dp)
                            ) {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = label,
                                    tint = iconTint,
                                    modifier = Modifier.size(20.dp)
                                )
                                if (active) {
                                    Text(
                                        text = label,
                                        color = MaxxColors.OnPrimaryDark,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
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
