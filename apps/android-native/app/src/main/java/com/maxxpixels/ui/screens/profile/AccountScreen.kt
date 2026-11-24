package com.maxxpixels.ui.screens.profile

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maxxpixels.data.repository.ApiResult
import com.maxxpixels.data.repository.MaxxRepository
import com.maxxpixels.ui.components.MaxxPrimaryButton
import com.maxxpixels.ui.theme.MaxxColors
import kotlinx.coroutines.launch

/**
 * 1:1 Replication of React Native AccountScreen with live PUT /api/v1/profile integration.
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
        unfocusedBorderColor = MaxxColors.BorderStrong,
        focusedContainerColor = MaxxColors.SurfaceDark,
        unfocusedContainerColor = MaxxColors.SurfaceDark,
        focusedTextColor = Color.White,
        unfocusedTextColor = Color.White,
        disabledTextColor = MaxxColors.TextSecondary,
        disabledContainerColor = MaxxColors.SurfaceDark,
        disabledBorderColor = MaxxColors.BorderSubtle
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaxxColors.CinemaBlack)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        ScreenTopHeader(title = "Account Details", onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .size(84.dp)
                    .clip(CircleShape)
                    .background(MaxxColors.SurfaceElevated),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Rounded.Person, null, tint = Color.White, modifier = Modifier.size(42.dp))
            }

            Text("Full Name", color = MaxxColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it; statusMsg = "" },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            Text("Email Address", color = MaxxColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            OutlinedTextField(
                value = email,
                onValueChange = { email = it; statusMsg = "" },
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            Text("Registered Mobile", color = MaxxColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            OutlinedTextField(
                value = phone.ifBlank { "Not linked" },
                onValueChange = {},
                enabled = false,
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            if (statusMsg.isNotBlank()) {
                Surface(
                    color = if (isError) Color(0x22EF4444) else Color(0x2210B981),
                    shape = RoundedCornerShape(10.dp),
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

            Spacer(Modifier.height(6.dp))

            MaxxPrimaryButton(
                text = "Save Changes",
                loading = saving,
                onClick = {
                    if (fullName.trim().length < 2) {
                        isError = true
                        statusMsg = "Please enter your full name."
                        return@MaxxPrimaryButton
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
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
internal fun ScreenTopHeader(title: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(MaxxColors.SurfaceDark)
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Text(title, color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
    }
}
