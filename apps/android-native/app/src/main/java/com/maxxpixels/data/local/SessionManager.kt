package com.maxxpixels.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.maxxpixels.data.model.BrandIdentity
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.model.HomeSection
import com.maxxpixels.data.model.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID

/**
 * Hardware-backed encrypted session store + offline catalog snapshot cache.
 * Replaces AsyncStorage + custom XOR obfuscation from React Native.
 */
class SessionManager(context: Context) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "maxxpixels_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (_: Exception) {
        context.getSharedPreferences("maxxpixels_fallback_prefs", Context.MODE_PRIVATE)
    }

    private val _session = MutableStateFlow(loadSession())
    val session: StateFlow<UserSession?> = _session.asStateFlow()

    private val _brand = MutableStateFlow(loadBrand())
    val brand: StateFlow<BrandIdentity> = _brand.asStateFlow()

    private fun loadSession(): UserSession? {
        val raw = prefs.getString(KEY_SESSION, null) ?: return null
        return runCatching { json.decodeFromString<UserSession>(raw) }.getOrNull()
    }

    private fun loadBrand(): BrandIdentity {
        val raw = prefs.getString(KEY_BRAND, null) ?: return BrandIdentity()
        return runCatching { json.decodeFromString<BrandIdentity>(raw) }.getOrDefault(BrandIdentity())
    }

    fun getAuthToken(): String? = _session.value?.authToken?.takeIf { it.isNotBlank() }
    fun getRefreshToken(): String? = _session.value?.refreshToken?.takeIf { it.isNotBlank() }

    fun getOrCreateDeviceId(): String {
        val existing = prefs.getString(KEY_DEVICE_ID, null)
        if (!existing.isNullOrBlank()) return existing
        val created = "android-${UUID.randomUUID().toString().take(12)}"
        prefs.edit().putString(KEY_DEVICE_ID, created).apply()
        return created
    }

    fun saveSession(user: UserSession) {
        _session.value = user
        prefs.edit().putString(KEY_SESSION, json.encodeToString(user)).apply()
    }

    fun updateSubscription(isBuy: Int, packageName: String, expiryDate: String = "") {
        val current = _session.value ?: return
        val updated = current.copy(
            isBuy = isBuy,
            packageName = packageName.ifBlank { current.packageName },
            expiryDate = expiryDate.ifBlank { current.expiryDate }
        )
        saveSession(updated)
    }

    fun saveBrand(brand: BrandIdentity) {
        _brand.value = brand
        prefs.edit().putString(KEY_BRAND, json.encodeToString(brand)).apply()
    }

    fun clearSession() {
        _session.value = null
        prefs.edit().remove(KEY_SESSION).apply()
    }

    // ── Offline Catalog Cache (for API Disconnect Resilience) ───────────────
    fun saveCachedHome(banners: List<CatalogItem>, sections: List<HomeSection>) {
        prefs.edit()
            .putString(KEY_CACHE_BANNERS, json.encodeToString(banners))
            .putString(KEY_CACHE_SECTIONS, json.encodeToString(sections))
            .apply()
    }

    fun loadCachedBanners(): List<CatalogItem> {
        val raw = prefs.getString(KEY_CACHE_BANNERS, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<CatalogItem>>(raw) }.getOrDefault(emptyList())
    }

    fun loadCachedSections(): List<HomeSection> {
        val raw = prefs.getString(KEY_CACHE_SECTIONS, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<HomeSection>>(raw) }.getOrDefault(emptyList())
    }

    companion object {
        private const val KEY_SESSION = "user_session_v2"
        private const val KEY_BRAND = "brand_identity_v2"
        private const val KEY_DEVICE_ID = "device_id_v2"
        private const val KEY_CACHE_BANNERS = "cache_home_banners_v2"
        private const val KEY_CACHE_SECTIONS = "cache_home_sections_v2"
    }
}
