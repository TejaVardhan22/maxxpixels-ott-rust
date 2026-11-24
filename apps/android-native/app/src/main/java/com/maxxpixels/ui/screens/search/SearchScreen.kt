package com.maxxpixels.ui.screens.search

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.screens.home.PortraitPosterCard
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.delay

/**
 * 1:1 Replication of React Native ExploreScreen (apps/mobile/src/screens/ExploreScreen/ExploreScreen.tsx):
 * Search bar + horizontal filter chips + Trending header + 3-column poster grid.
 */
@Composable
fun SearchScreen(
    repository: MaxxRepository,
    onOpenDetails: (Long) -> Unit
) {
    val chips = listOf("All", "Movies", "Web Series", "Podcasts", "Songs", "Micro-Drama", "Shorts", "AI Cinema", "Free Content", "VIP 4K")
    var query by remember { mutableStateOf("") }
    var activeFilter by remember { mutableStateOf("All") }
    var results by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var trending by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }

    LaunchedEffect(Unit) {
        trending = repository.getTrending()
    }

    LaunchedEffect(query) {
        if (query.trim().length < 2) {
            results = emptyList()
            return@LaunchedEffect
        }
        delay(300)
        when (val res = repository.search(query)) {
            is ApiResult.Success -> results = res.data
            is ApiResult.Error -> {}
        }
    }

    val rawItems = if (query.trim().length >= 2) results else trending
    val itemsToShow = rawItems.filter { item ->
        when (activeFilter) {
            "Free Content" -> !item.isPremium
            "VIP 4K" -> item.isPremium
            else -> true
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search movies, series, actors...", color = MaxxColors.TextMuted, fontSize = 14.sp) },
                leadingIcon = { Icon(Icons.Rounded.Search, null, tint = MaxxColors.TextSecondary) },
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { query = "" }) {
                            Icon(Icons.Rounded.Close, "Clear", tint = MaxxColors.TextSecondary)
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaxxColors.Primary,
                    unfocusedBorderColor = MaxxColors.SurfaceElevated,
                    focusedContainerColor = MaxxColors.SurfaceDark,
                    unfocusedContainerColor = MaxxColors.SurfaceDark,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            )
        }

        // Filter Chips Horizontal Scroll
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            items(chips) { chip ->
                val active = activeFilter == chip
                Surface(
                    color = if (active) MaxxColors.Primary else MaxxColors.SurfaceDark,
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, if (active) MaxxColors.Primary else MaxxColors.BorderSubtle),
                    modifier = Modifier.clickable { activeFilter = chip }
                ) {
                    Text(
                        text = chip,
                        color = if (active) Color.White else MaxxColors.TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }
        }

        // Header Row
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
        ) {
            if (query.trim().length < 2) {
                Icon(Icons.AutoMirrored.Rounded.TrendingUp, null, tint = Color(0xFFFBBF24), modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Popular & Trending Searches", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            } else {
                Text("Results for \"$query\" (${itemsToShow.size})", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }

        // 3-Column Poster Grid (Exact RN ExploreScreen)
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(itemsToShow, key = { it.id }) { item ->
                PortraitPosterCard(
                    item = item,
                    onClick = { onOpenDetails(item.id) },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
