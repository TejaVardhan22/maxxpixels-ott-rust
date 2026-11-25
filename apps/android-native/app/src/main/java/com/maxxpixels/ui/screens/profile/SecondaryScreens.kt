package com.maxxpixels.ui.screens.profile

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Email
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
import java.util.Locale

private val HTML_TAG_REGEX = Regex("<[^>]*>")

private fun stripHtml(raw: String): String =
    raw.replace(HTML_TAG_REGEX, " ")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace(Regex("\\s+"), " ")
        .trim()

/**
 * Frosted-Glass NotificationsScreen with live GET /notifications & POST /notifications/:id/read.
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
            .background(MaxxColors.AmbientScreenBackground)
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
                Surface(
                    color = Color.White.copy(alpha = 0.06f),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                    modifier = Modifier.padding(24.dp)
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(28.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(MaxxColors.PrimaryTint),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Rounded.Notifications, null, tint = MaxxColors.Primary, modifier = Modifier.size(28.dp))
                        }
                        Spacer(Modifier.height(14.dp))
                        Text("No notifications yet", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "New releases and membership alerts will appear here.",
                            color = MaxxColors.TextSecondary,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(list, key = { it.id }) { n ->
                    Surface(
                        color = if (n.isRead) Color.White.copy(alpha = 0.05f) else Color.White.copy(alpha = 0.10f),
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(
                            1.dp,
                            if (n.isRead) Color.White.copy(alpha = 0.10f) else MaxxColors.Primary.copy(alpha = 0.45f)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                if (!n.isRead) {
                                    list = list.map { if (it.id == n.id) it.copy(isRead = true) else it }
                                    scope.launch { repository.markNotificationRead(n.id) }
                                }
                            }
                    ) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
                            Box(
                                modifier = Modifier
                                    .padding(top = 5.dp)
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(if (n.isRead) Color.Transparent else MaxxColors.Primary)
                            )
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(n.title, color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
                                if (n.message.isNotBlank()) {
                                    Spacer(Modifier.height(4.dp))
                                    Text(n.message, color = MaxxColors.TextSecondary, fontSize = 12.5.sp, lineHeight = 18.sp)
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
 * Frosted-Glass RentalsScreen (Available to Rent + My Rentals pill tabs).
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
            .background(MaxxColors.AmbientScreenBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Movie Rentals", onBack = onBack)

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            listOf("Available to Rent", "My Rentals (0)").forEachIndexed { idx, label ->
                val selected = activeTab == idx
                if (selected) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(999.dp))
                            .background(MaxxColors.BrandGradient)
                            .clickable { activeTab = idx }
                            .padding(vertical = 11.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(label, color = MaxxColors.OnPrimaryDark, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                    }
                } else {
                    Surface(
                        color = Color.White.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(999.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                        modifier = Modifier
                            .weight(1f)
                            .clickable { activeTab = idx }
                    ) {
                        Text(
                            text = label,
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(vertical = 11.dp)
                        )
                    }
                }
            }
        }

        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaxxColors.Primary)
            }
        } else if (currentList.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Surface(
                    color = Color.White.copy(alpha = 0.06f),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                    modifier = Modifier.padding(24.dp)
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(28.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(Color(0x28C084FC)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Rounded.Movie, null, tint = Color(0xFFC084FC), modifier = Modifier.size(28.dp))
                        }
                        Spacer(Modifier.height(14.dp))
                        Text(
                            text = if (activeTab == 0) "No rental titles right now" else "No active rentals",
                            color = Color.White,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Pay-per-view premieres will appear here.",
                            color = MaxxColors.TextSecondary,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                contentPadding = PaddingValues(18.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(currentList, key = { it.id }) { item ->
                    PortraitPosterCard(
                        item = item,
                        onClick = { onOpenDetails(item.id) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

/**
 * Frosted-Glass CategoryContentScreen ("See All" 3-column grid).
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
            .background(MaxxColors.AmbientScreenBackground)
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
                contentPadding = PaddingValues(18.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
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
 * Frosted-Glass MyDownloadsScreen.
 */
@Composable
fun MyDownloadsScreen(
    onBack: () -> Unit,
    onExplore: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "My Downloads", onBack = onBack)
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Surface(
                color = Color.White.copy(alpha = 0.06f),
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                modifier = Modifier.padding(24.dp)
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(28.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(Color(0x2660A5FA)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Rounded.CloudDownload, null, tint = Color(0xFF60A5FA), modifier = Modifier.size(30.dp))
                    }
                    Spacer(Modifier.height(14.dp))
                    Text("No Downloads Yet", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Titles you download for offline viewing will appear here.",
                        color = MaxxColors.TextSecondary,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(22.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(MaxxColors.BrandGradient)
                            .clickable(onClick = onExplore)
                            .padding(horizontal = 26.dp, vertical = 12.dp)
                    ) {
                        Text(
                            text = "Find Something to Watch",
                            color = MaxxColors.OnPrimaryDark,
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
        }
    }
}

/**
 * Frosted-Glass SettingsScreen (persisted in SharedPreferences).
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
            .background(MaxxColors.AmbientScreenBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "App Settings", onBack = onBack)

        LazyColumn(
            contentPadding = PaddingValues(18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            item {
                Text(
                    "STREAMING QUALITY",
                    color = MaxxColors.TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.2.sp,
                    modifier = Modifier.padding(start = 6.dp)
                )
                Spacer(Modifier.height(8.dp))
                Surface(
                    color = Color.White.copy(alpha = 0.06f),
                    shape = RoundedCornerShape(22.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
                ) {
                    Column {
                        qualities.forEachIndexed { idx, q ->
                            val selected = quality == q
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        quality = q
                                        prefs.edit().putString("video_quality", q).apply()
                                    }
                                    .padding(horizontal = 16.dp, vertical = 15.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = q,
                                    color = if (selected) MaxxColors.Primary else Color.White,
                                    fontSize = 14.5.sp,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                                )
                                Box(
                                    modifier = Modifier
                                        .size(22.dp)
                                        .clip(CircleShape)
                                        .background(if (selected) MaxxColors.Primary else Color.White.copy(alpha = 0.10f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (selected) {
                                        Icon(
                                            Icons.Rounded.Check,
                                            contentDescription = null,
                                            tint = MaxxColors.OnPrimaryDark,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                }
                            }
                            if (idx < qualities.lastIndex) {
                                HorizontalDivider(
                                    thickness = 0.5.dp,
                                    color = Color.White.copy(alpha = 0.08f),
                                    modifier = Modifier.padding(horizontal = 16.dp)
                                )
                            }
                        }
                    }
                }
            }

            item {
                Text(
                    "PLAYBACK & NOTIFICATIONS",
                    color = MaxxColors.TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.2.sp,
                    modifier = Modifier.padding(start = 6.dp)
                )
                Spacer(Modifier.height(8.dp))
                Surface(
                    color = Color.White.copy(alpha = 0.06f),
                    shape = RoundedCornerShape(22.dp),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
                ) {
                    Column {
                        SettingToggleRow("Wi-Fi Only Streaming", "Save mobile data while watching", wifiOnly) {
                            wifiOnly = it; prefs.edit().putBoolean("wifi_only", it).apply()
                        }
                        HorizontalDivider(thickness = 0.5.dp, color = Color.White.copy(alpha = 0.08f), modifier = Modifier.padding(horizontal = 16.dp))
                        SettingToggleRow("Autoplay Next Episode", "Automatically play the next episode", autoplay) {
                            autoplay = it; prefs.edit().putBoolean("autoplay", it).apply()
                        }
                        HorizontalDivider(thickness = 0.5.dp, color = Color.White.copy(alpha = 0.08f), modifier = Modifier.padding(horizontal = 16.dp))
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
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, color = MaxxColors.TextSecondary, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaxxColors.OnPrimaryDark,
                checkedTrackColor = MaxxColors.Primary,
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = Color.White.copy(alpha = 0.16f)
            )
        )
    }
}

/**
 * Frosted-Glass StorageScreen (real Android cache size + clear cache).
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
            .background(MaxxColors.AmbientScreenBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Storage & Data", onBack = onBack)

        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Surface(
                color = Color.White.copy(alpha = 0.06f),
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        text = "APP & IMAGE CACHE",
                        color = MaxxColors.TextMuted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = String.format(Locale.US, "%.2f MB", cacheMb),
                        color = Color.White,
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Black
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Temporary posters, thumbnails, and API cache stored on this device.",
                        color = MaxxColors.TextSecondary,
                        fontSize = 12.5.sp
                    )
                    Spacer(Modifier.height(18.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(MaxxColors.BrandGradient)
                            .clickable {
                                context.cacheDir?.deleteRecursively()
                                cacheMb = calcDirBytes(context.cacheDir) / (1024.0 * 1024.0)
                                cleared = true
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.DeleteOutline, null, tint = MaxxColors.OnPrimaryDark, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = if (cleared) "Cache Cleared" else "Clear Cache",
                                color = MaxxColors.OnPrimaryDark,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Frosted-Glass HelpSupportScreen (FAQ Accordion + Email Support CTA).
 */
@Composable
fun HelpSupportScreen(onBack: () -> Unit) {
    val context = LocalContext.current
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
            .background(MaxxColors.AmbientScreenBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Help & Support", onBack = onBack)

        LazyColumn(
            contentPadding = PaddingValues(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(faqs.indices.toList()) { idx ->
                val (q, a) = faqs[idx]
                val open = expandedIdx == idx
                Surface(
                    color = Color.White.copy(alpha = if (open) 0.09f else 0.06f),
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(
                        1.dp,
                        if (open) MaxxColors.Primary.copy(alpha = 0.45f) else Color.White.copy(alpha = 0.12f)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { expandedIdx = if (open) -1 else idx }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(q, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Spacer(Modifier.width(8.dp))
                            Icon(
                                if (open) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,
                                contentDescription = null,
                                tint = if (open) MaxxColors.Primary else MaxxColors.TextSecondary
                            )
                        }
                        if (open) {
                            Spacer(Modifier.height(10.dp))
                            Text(a, color = MaxxColors.TextSecondary, fontSize = 12.5.sp, lineHeight = 19.sp)
                        }
                    }
                }
            }

            item {
                Spacer(Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(MaxxColors.BrandGradient)
                        .clickable {
                            runCatching {
                                context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@maxxpixels.com")))
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Email, null, tint = MaxxColors.OnPrimaryDark, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Email Support", color = MaxxColors.OnPrimaryDark, fontSize = 14.5.sp, fontWeight = FontWeight.ExtraBold)
                    }
                }
            }
        }
    }
}

/**
 * Frosted-Glass PrivacyLegalScreen with live GET /api/v1/legal API integration.
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
            .background(MaxxColors.AmbientScreenBackground)
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
                contentPadding = PaddingValues(18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                items(displayPages.entries.toList()) { (title, body) ->
                    Surface(
                        color = Color.White.copy(alpha = 0.06f),
                        shape = RoundedCornerShape(22.dp),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Text(title, color = MaxxColors.Primary, fontSize = 15.5.sp, fontWeight = FontWeight.ExtraBold)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = stripHtml(body),
                                color = MaxxColors.TextSecondary,
                                fontSize = 13.sp,
                                lineHeight = 20.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
