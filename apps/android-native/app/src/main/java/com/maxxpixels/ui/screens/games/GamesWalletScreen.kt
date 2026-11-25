package com.maxxpixels.ui.screens.games

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
import androidx.compose.material.icons.rounded.MonetizationOn
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.data.model.CoinOrderData
import com.maxxpixels.data.model.CoinPackItem
import com.maxxpixels.data.model.GamerProfile
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

private val WALLET_BG = Color(0xFF050A15)
private val WALLET_SURFACE = Color(0xFF111827)
private val WALLET_ACCENT = Color(0xFFA855F7)
private val WALLET_COIN = Color(0xFFFBBF24)

/**
 * 1:1 Kotlin Compose equivalent of React Native GamesWalletScreen.tsx:
 * - Shows gamer coin balance & stats
 * - Lists coin recharge packs from `GET /games/coins/packs`
 * - Highlights the smallest pack covering `recommendedCoins` (from PFF_BUY_COINS deficit)
 * - Launches native Razorpay checkout via `POST /games/coins/order` -> Razorpay -> `POST /games/coins/verify`
 */
@Composable
fun GamesWalletScreen(
    repository: MaxxRepository,
    recommendedCoins: Int = 0,
    onBack: () -> Unit,
    onLaunchCoinRazorpay: (CoinOrderData, CoinPackItem, onSuccess: () -> Unit) -> Unit
) {
    val scope = rememberCoroutineScope()
    var gamer by remember { mutableStateOf(GamerProfile()) }
    var packs by remember { mutableStateOf<List<CoinPackItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var purchasingPackId by remember { mutableStateOf<String?>(null) }
    var purchaseError by remember { mutableStateOf<String?>(null) }

    val numberFmt = remember { NumberFormat.getNumberInstance(Locale.US) }

    fun loadWallet() {
        scope.launch {
            loading = true
            errorMsg = null
            if (repository.sessionManager.getAuthToken().isNullOrBlank()) {
                errorMsg = "Please sign in to manage game coins."
                loading = false
                return@launch
            }
            gamer = repository.getGamerProfile()
            packs = repository.getCoinPacks()
            if (packs.isEmpty()) {
                errorMsg = "Coin recharges are not available right now. Please try again later."
            }
            loading = false
        }
    }

    fun refreshBalance() {
        scope.launch {
            gamer = repository.getGamerProfile()
        }
    }

    LaunchedEffect(Unit) {
        loadWallet()
    }

    val recommendedPackId = remember(recommendedCoins, packs) {
        if (recommendedCoins <= 0 || packs.isEmpty()) null
        else {
            packs.filter { it.coins >= recommendedCoins }.minByOrNull { it.coins }?.id
                ?: packs.maxByOrNull { it.coins }?.id
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WALLET_BG)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(WALLET_SURFACE)
            ) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back", tint = Color.White)
            }

            Text(
                text = "Game Coins",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold
            )

            IconButton(
                onClick = { loadWallet() },
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(WALLET_SURFACE)
            ) {
                Icon(Icons.Rounded.Refresh, contentDescription = "Refresh", tint = Color.White)
            }
        }

        HorizontalDivider(color = Color.White.copy(alpha = 0.08f))

        when {
            loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = WALLET_ACCENT)
                        Spacer(Modifier.height(12.dp))
                        Text("Loading coin store…", color = Color(0xFF94A3B8), fontSize = 13.sp)
                    }
                }
            }

            errorMsg != null && packs.isEmpty() -> {
                Box(modifier = Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = errorMsg.orEmpty(),
                            color = Color(0xFFCBD5E1),
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { loadWallet() },
                            colors = ButtonDefaults.buttonColors(containerColor = WALLET_ACCENT),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Retry", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Balance Card
                    item {
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            border = BorderStroke(1.dp, WALLET_ACCENT.copy(alpha = 0.4f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier
                                    .background(
                                        Brush.linearGradient(
                                            listOf(Color(0xFF1E1036), Color(0xFF111827))
                                        )
                                    )
                                    .padding(20.dp)
                            ) {
                                Text(
                                    text = "CURRENT WALLET BALANCE",
                                    color = Color(0xFFC084FC),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                                Spacer(Modifier.height(8.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Rounded.MonetizationOn,
                                        contentDescription = null,
                                        tint = WALLET_COIN,
                                        modifier = Modifier.size(30.dp)
                                    )
                                    Spacer(Modifier.width(10.dp))
                                    Text(
                                        text = "${numberFmt.format(gamer.coins)} Coins",
                                        color = Color.White,
                                        fontSize = 28.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                }
                                if (recommendedCoins > 0) {
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        text = "You need at least ${numberFmt.format(recommendedCoins)} more coins for this match.",
                                        color = WALLET_COIN,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                                Spacer(Modifier.height(10.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Rounded.VerifiedUser,
                                        contentDescription = null,
                                        tint = Color(0xFF34D399),
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        text = "Secured by Razorpay • Instant coin credit",
                                        color = Color(0xFF94A3B8),
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }
                    }

                    if (!purchaseError.isNullOrBlank()) {
                        item {
                            Surface(
                                color = Color(0xFF7F1D1D).copy(alpha = 0.35f),
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.45f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = purchaseError.orEmpty(),
                                    color = Color(0xFFFCA5A5),
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }
                    }

                    item {
                        Text(
                            text = "Select a Coin Pack",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    items(packs, key = { it.id }) { pack ->
                        val isRecommended = pack.id == recommendedPackId
                        val isBuying = purchasingPackId == pack.id
                        Surface(
                            color = WALLET_SURFACE,
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(
                                width = if (isRecommended) 1.5.dp else 1.dp,
                                color = if (isRecommended) WALLET_COIN else Color.White.copy(alpha = 0.1f)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = purchasingPackId == null) {
                                    purchasingPackId = pack.id
                                    purchaseError = null
                                    scope.launch {
                                        when (val orderRes = repository.createCoinOrder(pack.id)) {
                                            is ApiResult.Success -> {
                                                purchasingPackId = null
                                                onLaunchCoinRazorpay(orderRes.data, pack) {
                                                    refreshBalance()
                                                }
                                            }
                                            is ApiResult.Error -> {
                                                purchasingPackId = null
                                                purchaseError = orderRes.message
                                            }
                                        }
                                    }
                                }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(44.dp)
                                            .clip(CircleShape)
                                            .background(WALLET_COIN.copy(alpha = 0.14f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Rounded.MonetizationOn,
                                            contentDescription = null,
                                            tint = WALLET_COIN,
                                            modifier = Modifier.size(24.dp)
                                        )
                                    }
                                    Spacer(Modifier.width(12.dp))
                                    Column {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                text = "${numberFmt.format(pack.coins)} Coins",
                                                color = Color.White,
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.ExtraBold
                                            )
                                            if (isRecommended) {
                                                Spacer(Modifier.width(8.dp))
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(99.dp))
                                                        .background(WALLET_COIN)
                                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                                ) {
                                                    Text(
                                                        text = "RECOMMENDED",
                                                        color = Color.Black,
                                                        fontSize = 9.sp,
                                                        fontWeight = FontWeight.Black
                                                    )
                                                }
                                            }
                                        }
                                        if (pack.label.isNotBlank()) {
                                            Spacer(Modifier.height(2.dp))
                                            Text(
                                                text = pack.label,
                                                color = Color(0xFF94A3B8),
                                                fontSize = 12.sp
                                            )
                                        }
                                    }
                                }

                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(99.dp))
                                        .background(WALLET_ACCENT)
                                        .padding(horizontal = 16.dp, vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isBuying) {
                                        CircularProgressIndicator(
                                            color = Color.White,
                                            strokeWidth = 2.dp,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    } else {
                                        Text(
                                            text = "₹${pack.amountInr.toInt()}",
                                            color = Color.White,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.ExtraBold
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
