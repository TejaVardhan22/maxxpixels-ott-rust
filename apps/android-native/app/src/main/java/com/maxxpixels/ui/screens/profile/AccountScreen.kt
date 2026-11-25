package com.maxxpixels.ui.screens.profile

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

/**
 * Modern Frosted-Glass AccountScreen with live PUT /api/v1/profile integration.
 */
@Composable
fun AccountScreen(
    repository: MaxxRepository,
    onBack: () -> Unit
) {
    val session by repository.sessionManager.session.collectAsState()
    val scope = rememberCoroutineScope()

    var fullName by remember(session) { mutableStateOf(session?.fullName.orEmpty()) }
    var email by remember(session) { mutableStateOf(session?.email.orEmpty()) }
    val phone = session?.phoneNumber.orEmpty()

    var saving by remember { mutableStateOf(false) }
    var statusMsg by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = MaxxColors.Primary,
        unfocusedBorderColor = Color.White.copy(alpha = 0.16f),
        focusedContainerColor = Color.Black.copy(alpha = 0.28f),
        unfocusedContainerColor = Color.Black.copy(alpha = 0.28f),
        focusedTextColor = Color.White,
        unfocusedTextColor = Color.White,
        disabledTextColor = MaxxColors.TextSecondary,
        disabledContainerColor = Color.Black.copy(alpha = 0.20f),
        disabledBorderColor = Color.White.copy(alpha = 0.08f)
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.AmbientScreenBackground)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Account Details", onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Centered Avatar with Golden Ring
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .size(88.dp)
                    .clip(CircleShape)
                    .border(2.dp, MaxxColors.Primary, CircleShape)
                    .background(MaxxColors.SurfaceElevated),
                contentAlignment = Alignment.Center
            ) {
                if (!session?.avatarUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = session?.avatarUrl,
                        contentDescription = fullName,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(Icons.Rounded.Person, null, tint = MaxxColors.Primary, modifier = Modifier.size(42.dp))
                }
            }

            // Frosted Glass Form Card
            Surface(
                color = Color.White.copy(alpha = 0.06f),
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Full Name", color = MaxxColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        OutlinedTextField(
                            value = fullName,
                            onValueChange = { fullName = it; statusMsg = "" },
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            colors = fieldColors,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Email Address", color = MaxxColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it; statusMsg = "" },
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            colors = fieldColors,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Registered Mobile", color = MaxxColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        OutlinedTextField(
                            value = phone.ifBlank { "Not linked" },
                            onValueChange = {},
                            enabled = false,
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            colors = fieldColors,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    if (statusMsg.isNotBlank()) {
                        Surface(
                            color = if (isError) Color(0x22EF4444) else Color(0x2210B981),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, if (isError) Color(0x66EF4444) else Color(0x6610B981)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(12.dp)
                            ) {
                                Icon(
                                    Icons.Rounded.CheckCircle,
                                    null,
                                    tint = if (isError) MaxxColors.ErrorSoft else MaxxColors.Success,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = statusMsg,
                                    color = if (isError) MaxxColors.ErrorSoft else MaxxColors.Success,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(4.dp))

                    // Golden Pill Save Button
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(MaxxColors.BrandGradient)
                            .clickable(enabled = !saving) {
                                if (fullName.trim().length < 2) {
                                    isError = true
                                    statusMsg = "Please enter your full name."
                                    return@clickable
                                }
                                saving = true
                                statusMsg = ""
                                scope.launch {
                                    when (val res = repository.updateProfile(fullName, email)) {
                                        is ApiResult.Success -> {
                                            isError = false
                                            statusMsg = "Profile updated successfully."
                                        }
                                        is ApiResult.Error -> {
                                            isError = true
                                            statusMsg = res.message
                                        }
                                    }
                                    saving = false
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (saving) {
                            CircularProgressIndicator(
                                color = MaxxColors.OnPrimaryDark,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(20.dp)
                            )
                        } else {
                            Text(
                                text = "Save Changes",
                                color = MaxxColors.OnPrimaryDark,
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
internal fun ScreenTopHeader(title: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            color = Color.White.copy(alpha = 0.09f),
            shape = CircleShape,
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
            modifier = Modifier
                .size(40.dp)
                .clickable(onClick = onBack)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    Icons.AutoMirrored.Rounded.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
        Spacer(Modifier.width(14.dp))
        Text(
            text = title,
            color = Color.White,
            fontSize = 20.sp,
            fontWeight = FontWeight.ExtraBold
        )
    }
}
