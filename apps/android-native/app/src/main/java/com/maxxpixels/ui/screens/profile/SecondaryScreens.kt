package com.maxxpixels.ui.screens.profile

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.model.NotificationEntry
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.screens.home.PortraitPosterCard
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch
import java.io.File

/**
 * 1:1 Replication of React Native NotificationsScreen with live GET /notifications & POST /notifications/:id/read.
 */
@Composable
fun NotificationsScreen(
    repository: MaxxRepository,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var list by remember { mutableStateOf<List<NotificationEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        list = repository.getNotifications()
        loading = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Notifications", onBack = onBack)

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaxxColors.Primary)
            }
        } else if (list.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                    Icon(Icons.Rounded.Notifications, null, tint = MaxxColors.TextMuted, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("No notifications yet", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(4.dp))
                    Text("New releases and membership alerts will appear here.", color = MaxxColors.TextSecondary, fontSize = 12.5.sp, textAlign = TextAlign.Center)
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(list, key = { it.id }) { n ->
                    Surface(
                        color = if (n.isRead) MaxxColors.SurfaceDark else MaxxColors.SurfaceElevated,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, if (n.isRead) MaxxColors.BorderSubtle else MaxxColors.Primary.copy(alpha = 0.4f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                if (!n.isRead) {
                                    list = list.map { if (it.id == n.id) it.copy(isRead = true) else it }
                                    scope.launch { repository.markNotificationRead(n.id) }
                                }
                            }
                    ) {
                        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
                            Box(
                                modifier = Modifier
                                    .padding(top = 4.dp)
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(if (n.isRead) Color.Transparent else MaxxColors.Primary)
                            )
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(n.title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                if (n.message.isNotBlank()) {
                                    Spacer(Modifier.height(4.dp))
                                    Text(n.message, color = MaxxColors.TextSecondary, fontSize = 12.5.sp, lineHeight = 17.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 1:1 Replication of React Native RentalsScreen (Available to Rent + My Rentals tabs).
 */
@Composable
fun RentalsScreen(
    repository: MaxxRepository,
    onBack: () -> Unit,
    onOpenDetails: (Long) -> Unit
) {
    var activeTab by remember { mutableIntStateOf(0) }
    var available by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        available = repository.getRentableContent()
        loading = false
    }

    val currentList = if (activeTab == 0) available else emptyList()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Movie Rentals", onBack = onBack)

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            listOf("Available to Rent", "My Rentals (0)").forEachIndexed { idx, label ->
                val selected = activeTab == idx
                Surface(
                    color = if (selected) MaxxColors.Primary else MaxxColors.SurfaceDark,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .weight(1f)
                        .clickable { activeTab = idx }
                ) {
                    Text(
                        text = label,
                        color = if (selected) Color.White else MaxxColors.TextSecondary,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 10.dp)
                    )
                }
            }
        }

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaxxColors.Primary)
            }
        } else if (currentList.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                    Icon(Icons.Rounded.Movie, null, tint = MaxxColors.TextMuted, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = if (activeTab == 0) "No rental titles right now" else "No active rentals",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(4.dp))
                    Text("Pay-per-view premieres will appear here.", color = MaxxColors.TextSecondary, fontSize = 12.5.sp)
                }
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(currentList, key = { it.id }) { item ->
                    PortraitPosterCard(item = item, onClick = { onOpenDetails(item.id) }, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

/**
 * 1:1 Replication of React Native CategoryContentScreen ("See All" 3-column grid).
 */
@Composable
fun CategoryContentScreen(
    title: String,
    typeId: Int,
    language: String,
    repository: MaxxRepository,
    onBack: () -> Unit,
    onOpenDetails: (Long) -> Unit
) {
    var items by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(typeId, language) {
        items = repository.getCategoryItems(typeId, language)
        loading = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = title.ifBlank { "Catalog" }, onBack = onBack)

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaxxColors.Primary)
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(items, key = { it.id }) { item ->
                    PortraitPosterCard(
                        item = item,
                        onClick = { onOpenDetails(item.id) },
                        modifier = Modifier.fillMaxWidth(),
                        showTitleBelow = true
                    )
                }
            }
        }
    }
}

/**
 * 1:1 Replication of React Native MyDownloadsScreen.
 */
@Composable
fun MyDownloadsScreen(
    onBack: () -> Unit,
    onExplore: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "My Downloads", onBack = onBack)
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                Icon(Icons.Rounded.CloudDownload, null, tint = Color(0xFF3B82F6), modifier = Modifier.size(54.dp))
                Spacer(Modifier.height(14.dp))
                Text("No Downloads Yet", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Titles you download for offline viewing will appear here.",
                    color = MaxxColors.TextSecondary,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(20.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaxxColors.Primary)
                        .clickable(onClick = onExplore)
                        .padding(horizontal = 24.dp, vertical = 12.dp)
                ) {
                    Text("Find Something to Watch", color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/**
 * 1:1 Replication of React Native SettingsScreen (persisted in SharedPreferences).
 */
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("maxx_app_settings", android.content.Context.MODE_PRIVATE) }

    var quality by remember { mutableStateOf(prefs.getString("video_quality", "Auto (Best)") ?: "Auto (Best)") }
    var wifiOnly by remember { mutableStateOf(prefs.getBoolean("wifi_only", false)) }
    var autoplay by remember { mutableStateOf(prefs.getBoolean("autoplay", true)) }
    var pushEnabled by remember { mutableStateOf(prefs.getBoolean("push_enabled", true)) }

    val qualities = listOf("Auto (Best)", "1080p Full HD", "720p HD", "480p Data Saver")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "App Settings", onBack = onBack)

        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text("STREAMING QUALITY", color = MaxxColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                Spacer(Modifier.height(8.dp))
                Surface(
                    color = MaxxColors.SurfaceDark,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, MaxxColors.BorderSubtle)
                ) {
                    Column {
                        qualities.forEachIndexed { idx, q ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        quality = q
                                        prefs.edit().putString("video_quality", q).apply()
                                    }
                                    .padding(horizontal = 14.dp, vertical = 14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(q, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Box(
                                    modifier = Modifier
                                        .size(18.dp)
                                        .clip(CircleShape)
                                        .background(if (quality == q) MaxxColors.Primary else MaxxColors.SurfaceElevated)
                                )
                            }
                            if (idx < qualities.lastIndex) HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                        }
                    }
                }
            }

            item {
                Text("PLAYBACK & NOTIFICATIONS", color = MaxxColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                Spacer(Modifier.height(8.dp))
                Surface(
                    color = MaxxColors.SurfaceDark,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, MaxxColors.BorderSubtle)
                ) {
                    Column {
                        SettingToggleRow("Wi-Fi Only Streaming", "Save mobile data while watching", wifiOnly) {
                            wifiOnly = it; prefs.edit().putBoolean("wifi_only", it).apply()
                        }
                        HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                        SettingToggleRow("Autoplay Next Episode", "Automatically play the next episode", autoplay) {
                            autoplay = it; prefs.edit().putBoolean("autoplay", it).apply()
                        }
                        HorizontalDivider(thickness = 0.5.dp, color = MaxxColors.BorderSubtle)
                        SettingToggleRow("Push Notifications", "New releases and offers", pushEnabled) {
                            pushEnabled = it; prefs.edit().putBoolean("push_enabled", it).apply()
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingToggleRow(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(subtitle, color = MaxxColors.TextMuted, fontSize = 11.5.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = MaxxColors.Primary)
        )
    }
}

/**
 * 1:1 Replication of React Native StorageScreen (real Android cache size + clear cache).
 */
@Composable
fun StorageScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    fun calcDirBytes(dir: File?): Long =
        dir?.walkTopDown()?.filter { it.isFile }?.sumOf { it.length() } ?: 0L

    var cacheMb by remember { mutableStateOf(calcDirBytes(context.cacheDir) / (1024.0 * 1024.0)) }
    var cleared by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Storage & Data", onBack = onBack)

        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Surface(
                color = MaxxColors.SurfaceDark,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("App & Image Cache", color = MaxxColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    Text(String.format("%.2f MB", cacheMb), color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(14.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(MaxxColors.Primary)
                            .clickable {
                                context.cacheDir?.deleteRecursively()
                                cacheMb = calcDirBytes(context.cacheDir) / (1024.0 * 1024.0)
                                cleared = true
                            }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.DeleteOutline, null, tint = Color.White, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(if (cleared) "Cache Cleared" else "Clear Cache", color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

/**
 * 1:1 Replication of React Native HelpSupportScreen (FAQ Accordion).
 */
@Composable
fun HelpSupportScreen(onBack: () -> Unit) {
    val faqs = listOf(
        "How do I activate my MaxxPixels subscription?" to "Go to My Space -> Subscription, choose a plan, apply any coupon code, and complete payment via Razorpay.",
        "Can I watch on multiple devices?" to "Yes, your MaxxPixels account works seamlessly across Web, Android Mobile, and Smart TV.",
        "How do MAXX GAMES coins work?" to "Open MAXX GAMES from the Portal Hub to play Ludo, Carrom, Snooker, and Chess using your linked wallet.",
        "How do I contact support?" to "Email support@maxxpixels.com with your registered mobile number for priority assistance."
    )
    var expandedIdx by remember { mutableIntStateOf(0) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Help & Support", onBack = onBack)

        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(faqs.indices.toList()) { idx ->
                val (q, a) = faqs[idx]
                val open = expandedIdx == idx
                Surface(
                    color = MaxxColors.SurfaceDark,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { expandedIdx = if (open) -1 else idx }
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(q, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Icon(if (open) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore, null, tint = MaxxColors.TextSecondary)
                        }
                        if (open) {
                            Spacer(Modifier.height(8.dp))
                            Text(a, color = MaxxColors.TextSecondary, fontSize = 12.5.sp, lineHeight = 18.sp)
                        }
                    }
                }
            }
        }
    }
}

/**
 * 1:1 Replication of React Native PrivacyLegalScreen with live GET /api/v1/legal API integration.
 */
@Composable
fun PrivacyLegalScreen(
    repository: MaxxRepository,
    onBack: () -> Unit
) {
    var pages by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        pages = repository.getLegalPages()
        loading = false
    }

    val displayPages = if (pages.isNotEmpty()) pages else mapOf(
        "Terms of Use" to "By accessing MaxxPixels OTT and MAXX GAMES, you agree to stream content for personal, non-commercial use in accordance with applicable Indian laws.",
        "Privacy Policy" to "We collect only the account details required to authenticate your mobile session, manage your subscription, and sync your watchlist across devices.",
        "Refund & Cancellation Policy" to "Subscriptions can be managed anytime from My Space -> Subscription. For billing queries, write to support@maxxpixels.com."
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Privacy & Legal", onBack = onBack)

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaxxColors.Primary)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(displayPages.entries.toList()) { (title, body) ->
                    Surface(
                        color = MaxxColors.SurfaceDark,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, MaxxColors.BorderSubtle),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(title, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                            Spacer(Modifier.height(8.dp))
                            Text(body, color = MaxxColors.TextSecondary, fontSize = 12.5.sp, lineHeight = 19.sp)
                        }
                    }
                }
            }
        }
    }
}
