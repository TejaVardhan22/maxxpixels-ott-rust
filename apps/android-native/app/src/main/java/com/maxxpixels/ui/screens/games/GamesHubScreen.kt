package com.maxxpixels.ui.screens.games

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.MonetizationOn
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

private const val PLAYFORFUN_PUBLIC_KEY = "pk_b13e8b8d067d61963234"
private val GAMES_BG = Color(0xFF050A15)
private val GAMES_SURFACE = Color(0xFF111827)
private val GAMES_ACCENT = Color(0xFFA855F7)
private val GAMES_COIN_GOLD = Color(0xFFFBBF24)

private fun isValidPlayforFunUrl(url: String): Boolean {
    return try {
        val uri = Uri.parse(url)
        val originOk = uri.scheme == "https" && uri.host.equals("playforfun.in", ignoreCase = true)
        val path = uri.path.orEmpty()
        originOk && (
            path == "/arena" ||
                Regex("^/play/(ludo|carrom|snooker|chess)$").matches(path)
            )
    } catch (_: Exception) {
        false
    }
}

private fun appendPublicKey(url: String): String {
    return try {
        val uri = Uri.parse(url)
        if (!uri.getQueryParameter("pk").isNullOrBlank()) {
            url
        } else {
            uri.buildUpon().appendQueryParameter("pk", PLAYFORFUN_PUBLIC_KEY).build().toString()
        }
    } catch (_: Exception) {
        val sep = if (url.contains("?")) "&" else "?"
        "$url${sep}pk=$PLAYFORFUN_PUBLIC_KEY"
    }
}

/**
 * 1:1 Kotlin Compose equivalent of React Native GamesWebViewScreen.tsx:
 * - Immediately fetches signed PlayforFun SSO URL (`GET /games/playforfun/launch`)
 * - Renders top header (Back, MAXX GAMES, Gold Coins wallet icon, Close X)
 * - Exposes `window.ReactNativeWebView.postMessage` JS bridge for `PFF_BUY_COINS` -> GamesWalletScreen
 * - Fires subscription coin grant (`POST /games/coins/subscription-grant`) in background
 * - Hardware back navigates WebView history before exiting
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GamesHubScreen(
    repository: MaxxRepository,
    game: String? = null,
    title: String = "MAXX GAMES",
    onBack: () -> Unit,
    onOpenWallet: (recommendedCoins: Int) -> Unit = {},
    onRequireLogin: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var launchUrl by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var canGoBack by remember { mutableStateOf(false) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    fun fetchLaunchUrl() {
        scope.launch {
            loading = true
            error = null
            if (repository.sessionManager.getAuthToken().isNullOrBlank()) {
                error = "Please sign in to play games."
                loading = false
                return@launch
            }
            when (val res = repository.launchGameUrl(game)) {
                is ApiResult.Success -> {
                    val raw = res.data
                    if (!isValidPlayforFunUrl(raw)) {
                        error = "Received an invalid game launch URL."
                        loading = false
                    } else {
                        launchUrl = appendPublicKey(raw)
                        error = null
                    }
                }
                is ApiResult.Error -> {
                    error = res.message.ifBlank { "Unable to launch games right now. Please try again." }
                    loading = false
                }
            }
        }
    }

    LaunchedEffect(game) {
        fetchLaunchUrl()
    }

    // Fire-and-forget subscription coin top-up whenever the arena launches
    LaunchedEffect(launchUrl) {
        if (!launchUrl.isNullOrBlank()) {
            repository.claimSubscriptionCoins()
        }
    }

    // Safety timeout: never trap the user on an endless loading overlay
    LaunchedEffect(loading, launchUrl) {
        if (loading && !launchUrl.isNullOrBlank()) {
            delay(25_000)
            loading = false
        }
    }

    BackHandler {
        val wv = webViewRef
        if (canGoBack && wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            onBack()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GAMES_BG)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Header bar matching GamesWebViewScreen.tsx
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(GAMES_BG)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(GAMES_SURFACE)
            ) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back", tint = Color.White)
            }

            Text(
                text = title,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.6.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp)
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { onOpenWallet(0) },
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(GAMES_SURFACE)
                ) {
                    Icon(Icons.Rounded.MonetizationOn, contentDescription = "Game Coins", tint = GAMES_COIN_GOLD)
                }
                Spacer(Modifier.width(8.dp))
                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(GAMES_SURFACE)
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                }
            }
        }

        HorizontalDivider(color = Color.White.copy(alpha = 0.08f))

        // Main Content Area
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            val errMsg = error
            if (errMsg != null) {
                val lower = errMsg.lowercase()
                val needsSignIn = lower.contains("sign in") ||
                    lower.contains("session expired") ||
                    lower.contains("expired token") ||
                    lower.contains("invalid token") ||
                    lower.contains("unauthorized")

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Couldn't open games",
                        color = Color.White,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = errMsg,
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp
                    )
                    Spacer(Modifier.height(20.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(
                            onClick = { fetchLaunchUrl() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = GAMES_BG),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Try Again", fontWeight = FontWeight.Bold)
                        }
                        if (needsSignIn) {
                            OutlinedButton(
                                onClick = onRequireLogin,
                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.25f)),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Sign In", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            } else if (launchUrl.isNullOrBlank()) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(color = GAMES_ACCENT)
                    Spacer(Modifier.height(14.dp))
                    Text("Launching PlayforFun arena…", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                }
            } else {
                val mainHandler = remember { Handler(Looper.getMainLooper()) }
                val activeUrl = launchUrl!!

                AndroidView(
                    factory = { ctx ->
                        WebView(ctx).apply {
                            webViewRef = this
                            setBackgroundColor(android.graphics.Color.parseColor("#050A15"))
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.mediaPlaybackRequiresUserGesture = false
                            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            settings.setSupportMultipleWindows(false)
                            settings.cacheMode = WebSettings.LOAD_DEFAULT
                            CookieManager.getInstance().setAcceptCookie(true)
                            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

                            // Expose ReactNativeWebView bridge so PlayforFun's PFF_BUY_COINS event works 1:1
                            addJavascriptInterface(
                                object {
                                    @JavascriptInterface
                                    fun postMessage(raw: String?) {
                                        if (raw.isNullOrBlank()) return
                                        try {
                                            val data = JSONObject(raw)
                                            val type = data.optString("type").ifBlank { data.optString("event") }
                                            if (type == "PFF_BUY_COINS") {
                                                val deficit = if (data.isNull("deficitCoins")) -1 else data.optInt("deficitCoins", -1)
                                                val required = if (data.isNull("requiredCoins")) -1 else data.optInt("requiredCoins", -1)
                                                val rawRec = if (deficit > 0) deficit else if (required > 0) required else 500
                                                mainHandler.post { onOpenWallet(rawRec) }
                                            }
                                        } catch (_: Exception) {
                                            // Ignore non-JSON messages
                                        }
                                    }
                                },
                                "ReactNativeWebView"
                            )

                            webViewClient = object : WebViewClient() {
                                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                    loading = true
                                    canGoBack = view?.canGoBack() == true
                                }

                                override fun onPageFinished(view: WebView?, url: String?) {
                                    loading = false
                                    canGoBack = view?.canGoBack() == true
                                }

                                override fun onReceivedError(
                                    view: WebView?,
                                    request: WebResourceRequest?,
                                    webError: WebResourceError?
                                ) {
                                    if (request?.isForMainFrame == true) {
                                        loading = false
                                    }
                                }

                                override fun shouldOverrideUrlLoading(
                                    view: WebView?,
                                    request: WebResourceRequest?
                                ): Boolean {
                                    val target = request?.url?.toString().orEmpty()
                                    if (target.isBlank()) return false
                                    if (target.startsWith("https://playforfun.in") || target.startsWith("http://playforfun.in")) {
                                        return false
                                    }
                                    if (target.startsWith("intent:") || target.startsWith("mailto:") || target.startsWith("tel:")) {
                                        runCatching {
                                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target)))
                                        }
                                        return true
                                    }
                                    return false
                                }
                            }

                            loadUrl(activeUrl)
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )

                if (loading) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(GAMES_BG.copy(alpha = 0.85f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = GAMES_ACCENT)
                            Spacer(Modifier.height(12.dp))
                            Text("Loading games…", color = Color(0xFFCBD5E1), fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}
