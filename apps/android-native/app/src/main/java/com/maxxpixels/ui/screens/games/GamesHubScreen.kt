package com.maxxpixels.ui.screens.games

import android.annotation.SuppressLint
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Casino
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.MonetizationOn
import androidx.compose.material.icons.rounded.SportsEsports
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.maxxpixels.data.model.CoinPackItem
import com.maxxpixels.data.model.GamerProfile
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.MaxxPrimaryButton
import com.maxxpixels.ui.components.bounceClick
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

private data class GameTile(val key: String, val name: String, val tagline: String, val colors: List<Color>)

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GamesHubScreen(
    repository: MaxxRepository,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var gamer by remember { mutableStateOf(GamerProfile()) }
    var packs by remember { mutableStateOf<List<CoinPackItem>>(emptyList()) }
    var launchUrl by remember { mutableStateOf<String?>(null) }
    var launching by remember { mutableStateOf(false) }
    var launchError by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        gamer = repository.getGamerProfile()
        packs = repository.getCoinPacks()
    }

    // Full-screen PlayforFun SSO Arena WebView when a game is launched
    if (launchUrl != null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                        webViewClient = WebViewClient()
                        loadUrl(launchUrl!!)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
            IconButton(
                onClick = { launchUrl = null },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(12.dp)
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.65f))
            ) {
                Icon(Icons.Rounded.Close, "Exit Arena", tint = Color.White)
            }
        }
        return
    }

    val games = listOf(
        GameTile("ludo", "Ludo Arena", "Multiplayer Classic", listOf(Color(0xFFEC4899), Color(0xFF9333EA))),
        GameTile("carrom", "Carrom Pro", "Strike & Pocket", listOf(Color(0xFFF59E0B), Color(0xFFEA580C))),
        GameTile("snooker", "Snooker 3D", "Precision Tables", listOf(Color(0xFF10B981), Color(0xFF047857))),
        GameTile("chess", "Grand Chess", "Rapid Matches", listOf(Color(0xFF3B82F6), Color(0xFF6366F1)))
    )

    fun startGame(gameKey: String? = null) {
        launching = true
        launchError = ""
        scope.launch {
            when (val res = repository.launchGameUrl(gameKey)) {
                is ApiResult.Success -> launchUrl = res.data
                is ApiResult.Error -> launchError = res.message
            }
            launching = false
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 116.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = onBack,
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.SurfaceGlass)
                        ) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text("MAXX GAMES", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                            Text("Instant Play • No Downloads", color = MaxxColors.AccentSoft, fontSize = 11.sp)
                        }
                    }

                    Surface(
                        color = MaxxColors.SurfaceGlass,
                        shape = RoundedCornerShape(99.dp),
                        border = BorderStroke(1.dp, MaxxColors.CoinGold.copy(alpha = 0.5f))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                        ) {
                            Icon(Icons.Rounded.MonetizationOn, null, tint = MaxxColors.CoinGold, modifier = Modifier.size(17.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("${gamer.coins} Coins", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            }

            // Stats Banner
            item {
                Surface(
                    color = MaxxColors.SurfaceGlass,
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("PLAYFORFUN ARENA", color = MaxxColors.AccentSoft, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                                Spacer(Modifier.height(4.dp))
                                Text("Compete & Win Coins", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black)
                            }
                            Icon(Icons.Rounded.EmojiEvents, null, tint = MaxxColors.CoinGold, modifier = Modifier.size(34.dp))
                        }
                        Spacer(Modifier.height(14.dp))
                        MaxxPrimaryButton(
                            text = "Launch Full Arena",
                            loading = launching,
                            onClick = { startGame(null) },
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (launchError.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text(launchError, color = MaxxColors.ErrorSoft, fontSize = 12.sp)
                        }
                    }
                }
            }

            // 2x2 Game Tiles Grid
            item {
                Text("Featured Games", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    games.chunked(2).forEach { rowGames ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            rowGames.forEach { g ->
                                Surface(
                                    shape = RoundedCornerShape(18.dp),
                                    border = BorderStroke(1.dp, MaxxColors.BorderStrong),
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(118.dp)
                                        .bounceClick { startGame(g.key) }
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(Brush.linearGradient(g.colors))
                                            .padding(14.dp)
                                    ) {
                                        Icon(
                                            Icons.Rounded.SportsEsports,
                                            null,
                                            tint = Color.White.copy(alpha = 0.25f),
                                            modifier = Modifier
                                                .size(54.dp)
                                                .align(Alignment.TopEnd)
                                        )
                                        Column(modifier = Modifier.align(Alignment.BottomStart)) {
                                            Text(g.name, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black)
                                            Text(g.tagline, color = Color.White.copy(alpha = 0.85f), fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (packs.isNotEmpty()) {
                item {
                    Text("Coin Packs", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        packs.forEach { pack ->
                            Surface(
                                color = MaxxColors.SurfaceGlass,
                                shape = RoundedCornerShape(16.dp),
                                border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Rounded.MonetizationOn, null, tint = MaxxColors.CoinGold, modifier = Modifier.size(22.dp))
                                        Spacer(Modifier.width(10.dp))
                                        Column {
                                            Text("${pack.coins} Coins", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                                            if (pack.label.isNotBlank()) {
                                                Text(pack.label, color = MaxxColors.TextSecondary, fontSize = 11.sp)
                                            }
                                        }
                                    }
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(99.dp))
                                            .background(MaxxColors.BrandGradient)
                                            .padding(horizontal = 14.dp, vertical = 6.dp)
                                    ) {
                                        Text("₹${pack.amountInr.toInt()}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
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
