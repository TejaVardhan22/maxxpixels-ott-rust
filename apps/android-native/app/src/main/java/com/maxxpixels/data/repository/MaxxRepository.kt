package com.maxxpixels.data.repository

import com.maxxpixels.data.local.SessionManager
import com.maxxpixels.data.model.BrandIdentity
import com.maxxpixels.data.model.CatalogItem
import com.maxxpixels.data.model.CoinOrderData
import com.maxxpixels.data.model.CoinPackItem
import com.maxxpixels.data.model.ContentTypeItem
import com.maxxpixels.data.model.CreatedOrder
import com.maxxpixels.data.model.EpisodeItem
import com.maxxpixels.data.model.GamerProfile
import com.maxxpixels.data.model.HomeSection
import com.maxxpixels.data.model.JsonParsers
import com.maxxpixels.data.model.MaintenanceStatus
import com.maxxpixels.data.model.MediaUrlNormalizer
import com.maxxpixels.data.model.NotificationEntry
import com.maxxpixels.data.model.PlaybackAuth
import com.maxxpixels.data.model.PortalBannerItem
import com.maxxpixels.data.model.SubscriptionPlan
import com.maxxpixels.data.model.UserSession
import com.maxxpixels.data.network.MaxxApiService
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.IOException

sealed class ApiResult<out T> {
    data class Success<T>(val data: T, val fromCache: Boolean = false) : ApiResult<T>()
    data class Error(val message: String, val isDisconnected: Boolean = false) : ApiResult<Nothing>()
}

class MaxxRepository(
    private val api: MaxxApiService,
    val sessionManager: SessionManager
) {
    private fun extractError(e: Throwable): ApiResult.Error {
        if (e is IOException) {
            return ApiResult.Error("No internet connection. Please check your network and try again.", isDisconnected = true)
        }
        if (e is HttpException) {
            val raw = runCatching { e.response()?.errorBody()?.string() }.getOrNull().orEmpty()
            val parsedMsg = runCatching {
                val obj = com.maxxpixels.data.network.ApiClientFactory.json.parseToJsonElement(raw) as? JsonObject
                JsonParsers.str(obj, "message", "error")
            }.getOrNull().orEmpty()
            val msg = parsedMsg.ifBlank {
                when (e.code()) {
                    401 -> "Session expired. Please sign in again."
                    403 -> "Active subscription required."
                    404 -> "Requested resource was not found."
                    409 -> "Account already exists."
                    in 500..599 -> "Server is temporarily unreachable. Please try again."
                    else -> "Request failed (${e.code()})."
                }
            }
            return ApiResult.Error(msg, isDisconnected = e.code() >= 500)
        }
        return ApiResult.Error(e.message ?: "Something went wrong.")
    }

    private fun checkEnvelopeError(res: kotlinx.serialization.json.JsonElement): String? {
        val root = res as? JsonObject ?: return null
        val successVal = root["success"]
        val isExplicitFalse = successVal != null && !JsonParsers.bool(root, "success")
        val statusCode = JsonParsers.int(root, "status")
        if (isExplicitFalse || statusCode >= 400) {
            return JsonParsers.str(root, "message", "error").ifBlank { "Request failed ($statusCode)." }
        }
        return null
    }

    // ── Branding & Settings ─────────────────────────────────────────────────
    suspend fun syncBranding(): BrandIdentity {
        return try {
            val res = api.getSettings()
            val obj = JsonParsers.unwrapObject(res)
            if (obj != null) {
                val name = JsonParsers.str(obj, "APP_NAME", "app_name", "appName", "platform_name").ifBlank { "MaxxPixels" }
                val shortName = JsonParsers.str(obj, "APP_SHORT_NAME", "app_short_name", "appShortName").ifBlank { name }
                val logo = MediaUrlNormalizer.normalize(
                    JsonParsers.str(obj, "APP_LOGO_URL", "dark_logo_url", "darkLogoUrl", "logo_url", "logoUrl", "app_logo")
                )
                val desc = JsonParsers.str(obj, "APP_TAGLINE", "seo_description", "app_description")
                    .ifBlank { "Stream Movies, Short Films & Web Series" }
                val brand = BrandIdentity(name, shortName, logo, desc)
                sessionManager.saveBrand(brand)
                brand
            } else {
                sessionManager.brand.value
            }
        } catch (_: Exception) {
            sessionManager.brand.value
        }
    }

    // ── Auth ────────────────────────────────────────────────────────────────
    suspend fun sendPhoneOtp(
        phone: String,
        isRegister: Boolean = false,
        isResend: Boolean = false,
        agentCode: String? = null
    ): ApiResult<String> {
        return try {
            val clean = phone.trim().let { if (it.startsWith("+")) it else "+91${it.filter(Char::isDigit)}" }
            val body = buildJsonObject {
                put("identifier", clean)
                put("phone", clean)
                put("mode", if (isRegister) "register" else "login")
                put("isRegister", isRegister)
                if (!agentCode.isNullOrBlank()) put("agentCode", agentCode.trim().uppercase())
            }
            val res = if (isResend) api.resendOtp(body) else api.sendOtp(body)
            checkEnvelopeError(res)?.let { return ApiResult.Error(it) }
            val obj = JsonParsers.unwrapObject(res)
            ApiResult.Success(JsonParsers.str(obj, "message").ifBlank { "OTP sent to $clean" })
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun verifyPhoneOtp(
        phone: String,
        otp: String,
        isRegister: Boolean = false,
        firstName: String? = null,
        lastName: String? = null,
        email: String? = null,
        agentCode: String? = null
    ): ApiResult<UserSession> {
        return try {
            val clean = phone.trim().let { if (it.startsWith("+")) it else "+91${it.filter(Char::isDigit)}" }
            val fullName = listOfNotNull(firstName?.trim(), lastName?.trim())
                .filter { it.isNotBlank() }
                .joinToString(" ")
            val body = buildJsonObject {
                put("identifier", clean)
                put("phone", clean)
                put("mobile_number", clean)
                put("otp", otp.trim())
                put("code", otp.trim())
                put("mode", if (isRegister) "register" else "login")
                put("isRegister", isRegister)
                put("deviceId", sessionManager.getOrCreateDeviceId())
                put("platform", "ANDROID")
                if (fullName.isNotBlank()) {
                    put("fullName", fullName)
                    put("full_name", fullName)
                    put("name", fullName)
                }
                if (!firstName.isNullOrBlank()) put("firstName", firstName.trim())
                if (!lastName.isNullOrBlank()) put("lastName", lastName.trim())
                if (!email.isNullOrBlank()) put("email", email.trim())
                if (!agentCode.isNullOrBlank()) put("agentCode", agentCode.trim().uppercase())
            }
            val res = api.verifyOtp(body)
            checkEnvelopeError(res)?.let { return ApiResult.Error(it) }
            val obj = JsonParsers.unwrapObject(res) ?: return ApiResult.Error("Invalid verification response.")
            val user = JsonParsers.parseUser(obj)
            if (!user.isLoggedIn) return ApiResult.Error("Could not establish session. Please try again.")
            sessionManager.saveSession(user)
            ApiResult.Success(user)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    /**
     * Authoritative subscription sync with network-disconnect demotion guard:
     * never revokes a locally verified VIP subscription if the server is offline.
     */
    suspend fun syncSubscription(): Boolean {
        val current = sessionManager.session.value ?: return false
        return try {
            val res = api.getMySubscription()
            val obj = JsonParsers.unwrapObject(res)
            if (obj != null) {
                val active = JsonParsers.int(obj, "is_buy", "isBuy") == 1 ||
                    JsonParsers.bool(obj, "isSubscribed", "is_subscribed") ||
                    JsonParsers.str(obj, "status").equals("ACTIVE", true)
                val pkg = JsonParsers.str(obj, "package_name", "packageName", "planName", "plan_name")
                    .ifBlank { if (active) "VIP Membership" else "Free" }
                val exp = JsonParsers.str(obj, "expiryDate", "expiry_date", "endDate", "end_date")
                sessionManager.updateSubscription(if (active) 1 else 0, pkg, exp)
                active
            } else {
                current.hasActiveSubscription
            }
        } catch (_: Exception) {
            current.hasActiveSubscription
        }
    }

    suspend fun logout() {
        val refresh = sessionManager.getRefreshToken()
        if (!refresh.isNullOrBlank()) {
            runCatching { api.logout(buildJsonObject { put("refreshToken", refresh) }) }
        }
        sessionManager.clearSession()
    }

    // ── Home Catalog (Cache-First Offline Resilience) ───────────────────────
    data class HomeData(
        val banners: List<CatalogItem>,
        val sections: List<HomeSection>,
        val contentTypes: List<ContentTypeItem>,
        val continueWatching: List<CatalogItem>,
        val fromCache: Boolean = false
    )

    suspend fun loadHomeCatalog(typeId: Int = 0, language: String? = null): ApiResult<HomeData> {
        return try {
            val bannerRes = runCatching {
                api.getBanners("MOBILE", typeId.takeIf { it > 0 }, language)
            }.getOrNull()
            val sectionRes = runCatching {
                api.getSections(typeId.takeIf { it > 0 }, language)
            }.getOrNull()
            val typesRes = runCatching { api.getContentTypes() }.getOrNull()
            val cwRes = if (sessionManager.getAuthToken() != null) {
                runCatching { api.getContinueWatching() }.getOrNull()
            } else null

            // Mirror React Native useHomeCatalog: also fetch language pool & trending so Home is populated even when cms/sections is empty
            val langPoolRes = runCatching {
                if (language == "non-kannada" || language == "all-indian") {
                    api.getNonKannadaContent()
                } else {
                    api.getContentByLanguage(language?.ifBlank { "kannada" } ?: "kannada")
                }
            }.getOrNull()
            val trendingRes = runCatching { api.getTrending() }.getOrNull()

            val banners = JsonParsers.unwrapArray(bannerRes).map(JsonParsers::parseCatalogItem)
            val cmsSections = JsonParsers.unwrapArray(sectionRes).mapIndexedNotNull { idx, secObj ->
                val rawItems = (secObj["items"] as? JsonArray ?: secObj["data"] as? JsonArray)
                    ?.mapNotNull { it as? JsonObject }
                    ?.map(JsonParsers::parseCatalogItem)
                    .orEmpty()
                if (rawItems.isEmpty()) return@mapIndexedNotNull null
                val title = JsonParsers.str(secObj, "title", "name").ifBlank { "Featured" }
                if (title.contains("continue watching", true)) return@mapIndexedNotNull null
                val layout = JsonParsers.str(secObj, "layout", "screenLayout", "screen_layout").lowercase()
                HomeSection(
                    id = JsonParsers.long(secObj, "id").let { if (it > 0) it else idx + 1L },
                    title = title,
                    isLandscape = layout.contains("landscape") || layout.contains("horizontal"),
                    items = rawItems
                )
            }

            val langItems = JsonParsers.unwrapArray(langPoolRes).map(JsonParsers::parseCatalogItem)
            val trendingItems = JsonParsers.unwrapArray(trendingRes).map(JsonParsers::parseCatalogItem)
            val combinedPool = (langItems + trendingItems).distinctBy { it.id }
                .filter { item -> typeId == 0 || item.typeId == typeId || item.videoType == typeId }

            val fallbackSections = if (cmsSections.isNotEmpty()) {
                cmsSections
            } else {
                buildList {
                    if (trendingItems.isNotEmpty() && typeId == 0) {
                        add(HomeSection(101L, "Trending Now", false, trendingItems.take(15)))
                    }
                    val movies = combinedPool.filter { it.typeId == 1 || it.contentType == "MOVIE" }
                    if (movies.isNotEmpty()) add(HomeSection(102L, "Movies", false, movies))
                    val series = combinedPool.filter { it.typeId == 6 || it.contentType.contains("SERIES") }
                    if (series.isNotEmpty()) add(HomeSection(103L, "Web Series", false, series))
                    val shorts = combinedPool.filter { it.typeId == 3 || it.contentType.contains("SHORT") }
                    if (shorts.isNotEmpty()) add(HomeSection(104L, "Short Films", false, shorts))
                    val micro = combinedPool.filter { it.typeId == 4 || it.contentType.contains("MICRO") }
                    if (micro.isNotEmpty()) add(HomeSection(105L, "Micro-Drama", false, micro))
                    val songs = combinedPool.filter { it.typeId == 2 || it.contentType.contains("SONG") || it.contentType.contains("MUSIC") }
                    if (songs.isNotEmpty()) add(HomeSection(106L, "Songs & Music", false, songs))
                    val podcasts = combinedPool.filter { it.typeId == 5 || it.contentType.contains("PODCAST") }
                    if (podcasts.isNotEmpty()) add(HomeSection(107L, "Podcasts", false, podcasts))
                    if (isEmpty() && combinedPool.isNotEmpty()) {
                        add(HomeSection(108L, "Latest Releases", false, combinedPool))
                    }
                }
            }

            val types = JsonParsers.unwrapArray(typesRes).mapNotNull { t ->
                val title = JsonParsers.str(t, "title", "name")
                val slug = JsonParsers.str(t, "slug").ifBlank { title.lowercase() }
                if (title.isBlank()) null else ContentTypeItem(
                    id = JsonParsers.int(t, "id").let { if (it > 0) it else 1 },
                    slug = slug,
                    title = title
                )
            }.ifEmpty {
                listOf(
                    ContentTypeItem(1, "movie", "Movies"),
                    ContentTypeItem(6, "series", "Web Series"),
                    ContentTypeItem(3, "short_film", "Short Films"),
                    ContentTypeItem(4, "microdrama", "Micro-Drama"),
                    ContentTypeItem(2, "album", "Songs"),
                    ContentTypeItem(5, "podcast", "Podcasts")
                )
            }

            val cw = JsonParsers.unwrapArray(cwRes).map(JsonParsers::parseCatalogItem)
            val effectiveBanners = banners.ifEmpty { fallbackSections.firstOrNull()?.items?.take(6).orEmpty() }

            if (typeId == 0 && (language == null || language == "kannada") && fallbackSections.isNotEmpty()) {
                sessionManager.saveCachedHome(effectiveBanners, fallbackSections)
            }

            ApiResult.Success(HomeData(effectiveBanners, fallbackSections, types, cw, fromCache = false))
        } catch (e: Throwable) {
            // Serve Room/EncryptedPrefs cached snapshot on API disconnect
            val cachedBanners = sessionManager.loadCachedBanners()
            val cachedSections = sessionManager.loadCachedSections()
            if (cachedSections.isNotEmpty()) {
                ApiResult.Success(
                    HomeData(
                        banners = cachedBanners,
                        sections = cachedSections,
                        contentTypes = listOf(
                            ContentTypeItem(1, "movie", "Movies"),
                            ContentTypeItem(6, "series", "Web Series"),
                            ContentTypeItem(3, "short_film", "Short Films"),
                            ContentTypeItem(4, "microdrama", "Micro-Drama")
                        ),
                        continueWatching = emptyList(),
                        fromCache = true
                    ),
                    fromCache = true
                )
            } else {
                extractError(e)
            }
        }
    }

    // ── Content Details, Search, Episodes & Watchlist ───────────────────────
    suspend fun getContentDetail(id: Long): ApiResult<CatalogItem> {
        return try {
            val res = api.getContentDetail(id.toString())
            val obj = JsonParsers.unwrapObject(res) ?: return ApiResult.Error("Title not found.")
            val item = JsonParsers.parseCatalogItem(obj)
            recordEvent(item.id, item.title, "CONTENT_VIEW", "VIEW")
            ApiResult.Success(item)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun getSeasonEpisodes(seasonId: Long): List<EpisodeItem> {
        return runCatching {
            val res = api.getSeasonEpisodes(seasonId)
            JsonParsers.unwrapArray(res).mapIndexed { idx, ep ->
                val durSec = JsonParsers.int(ep, "durationSeconds", "duration_seconds", "video_duration")
                EpisodeItem(
                    id = JsonParsers.long(ep, "id"),
                    name = JsonParsers.str(ep, "name", "title").ifBlank { "Episode ${idx + 1}" },
                    description = JsonParsers.str(ep, "description", "synopsis"),
                    thumbnailUrl = MediaUrlNormalizer.normalize(
                        JsonParsers.str(ep, "landscape", "thumbnail", "image", "imageUrl")
                    ),
                    durationLabel = JsonParsers.formatDuration(durSec),
                    isPremium = JsonParsers.bool(ep, "is_premium", "isPremium"),
                    episodeNumber = JsonParsers.int(ep, "episodeNumber", "episode_number").let { if (it > 0) it else idx + 1 }
                )
            }
        }.getOrDefault(emptyList())
    }

    suspend fun search(query: String): ApiResult<List<CatalogItem>> {
        return try {
            val res = api.search(query.trim())
            ApiResult.Success(JsonParsers.unwrapArray(res).map(JsonParsers::parseCatalogItem))
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun getTrending(): List<CatalogItem> =
        runCatching { JsonParsers.unwrapArray(api.getTrending()).map(JsonParsers::parseCatalogItem) }.getOrDefault(emptyList())

    suspend fun getWatchlist(): List<CatalogItem> =
        runCatching { JsonParsers.unwrapArray(api.getWatchlist()).map(JsonParsers::parseCatalogItem) }.getOrDefault(emptyList())

    suspend fun toggleWatchlist(contentId: Long, title: String, add: Boolean): Boolean {
        return try {
            if (add) {
                api.addToWatchlist(contentId, buildJsonObject {
                    put("contentId", contentId)
                    put("content_id", contentId)
                })
                recordEvent(contentId, title, "WATCHLIST_ADD", "WATCHLIST")
            } else {
                api.removeFromWatchlist(contentId)
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    suspend fun toggleLike(contentId: Long, title: String) {
        recordEvent(contentId, title, "CONTENT_LIKE", "LIKE")
    }

    suspend fun recordEvent(contentId: Long, title: String, eventType: String, interactionType: String) {
        runCatching {
            api.recordAnalyticsEvent(buildJsonObject {
                put("contentId", contentId)
                put("contentTitle", title)
                put("eventType", eventType)
                put("interactionType", interactionType)
                put("deviceType", "ANDROID")
            })
        }
    }

    suspend fun getNotifications(): List<NotificationEntry> {
        return runCatching {
            JsonParsers.unwrapArray(api.getNotifications()).map { n ->
                NotificationEntry(
                    id = JsonParsers.long(n, "id", "notification_id"),
                    title = JsonParsers.str(n, "title", "name").ifBlank { "MaxxPixels" },
                    message = JsonParsers.str(n, "message", "description"),
                    imageUrl = MediaUrlNormalizer.normalize(JsonParsers.str(n, "imageUrl", "image")),
                    createdAt = JsonParsers.str(n, "createdAt", "created_at"),
                    isRead = JsonParsers.bool(n, "read", "is_read")
                )
            }
        }.getOrDefault(emptyList())
    }

    suspend fun markNotificationRead(id: Long) {
        runCatching { api.markNotificationRead(id, buildJsonObject {}) }
    }

    suspend fun updateProfile(
        fullName: String,
        email: String,
        avatarUrl: String? = null
    ): ApiResult<UserSession> {
        return try {
            val parts = fullName.trim().split(" ", limit = 2)
            val body = buildJsonObject {
                put("fullName", fullName.trim())
                put("full_name", fullName.trim())
                put("name", fullName.trim())
                put("firstName", parts.firstOrNull().orEmpty())
                if (parts.size > 1) put("lastName", parts[1])
                if (email.isNotBlank()) put("email", email.trim())
                if (!avatarUrl.isNullOrBlank()) {
                    put("avatarUrl", avatarUrl.trim())
                    put("avatar_url", avatarUrl.trim())
                }
            }
            api.updateProfile(body)
            val current = sessionManager.session.value
            val updated = (current ?: UserSession()).copy(
                fullName = fullName.trim(),
                email = email.trim(),
                avatarUrl = avatarUrl?.takeIf { it.isNotBlank() }?.let { MediaUrlNormalizer.normalize(it) }
                    ?: current?.avatarUrl.orEmpty()
            )
            sessionManager.saveSession(updated)
            ApiResult.Success(updated)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun uploadAvatar(bytes: ByteArray, fileName: String, mimeType: String): ApiResult<String> {
        return try {
            val mediaType = mimeType.ifBlank { "image/jpeg" }.toMediaTypeOrNull()
            val part = MultipartBody.Part.createFormData(
                name = "file",
                filename = fileName.ifBlank { "avatar.jpg" },
                body = bytes.toRequestBody(mediaType)
            )
            val folderBody = "avatars".toRequestBody("text/plain".toMediaTypeOrNull())
            val res = api.uploadFile(part, folderBody)
            checkEnvelopeError(res)?.let { return ApiResult.Error(it) }
            val obj = JsonParsers.unwrapObject(res)
            val rawUrl = JsonParsers.str(obj, "url", "fileUrl", "file_url", "avatarUrl")
            if (rawUrl.isBlank()) return ApiResult.Error("Upload succeeded but no image URL returned.")
            val normalized = MediaUrlNormalizer.normalize(rawUrl)
            val current = sessionManager.session.value
            if (current != null) {
                updateProfile(current.fullName, current.email, normalized)
            }
            ApiResult.Success(normalized)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun getLegalPages(): Map<String, String> {
        return runCatching {
            val res = api.getLegalPages()
            val arr = JsonParsers.unwrapArray(res)
            if (arr.isNotEmpty()) {
                arr.associate { obj ->
                    val title = JsonParsers.str(obj, "title", "name", "slug").ifBlank { "Policy" }
                    val content = JsonParsers.str(obj, "content", "body", "description")
                    title to content
                }
            } else {
                val obj = JsonParsers.unwrapObject(res)
                if (obj != null) {
                    buildMap {
                        JsonParsers.str(obj, "terms", "terms_of_use").takeIf { it.isNotBlank() }?.let { put("Terms of Use", it) }
                        JsonParsers.str(obj, "privacy", "privacy_policy").takeIf { it.isNotBlank() }?.let { put("Privacy Policy", it) }
                        JsonParsers.str(obj, "refund", "refund_policy").takeIf { it.isNotBlank() }?.let { put("Refund Policy", it) }
                    }
                } else emptyMap()
            }
        }.getOrDefault(emptyMap())
    }

    suspend fun getRentableContent(): List<CatalogItem> {
        return runCatching {
            val tvodList = runCatching {
                JsonParsers.unwrapArray(api.getTvodProducts()).map(JsonParsers::parseCatalogItem)
            }.getOrDefault(emptyList())
            val home = loadHomeCatalog(typeId = 0, language = "kannada")
            val homeRent = if (home is ApiResult.Success) {
                (home.data.banners + home.data.sections.flatMap { it.items }).filter { it.isRent }
            } else emptyList()
            (tvodList + homeRent).distinctBy { it.id }
        }.getOrDefault(emptyList())
    }

    suspend fun getMyRentals(): List<CatalogItem> {
        return runCatching {
            JsonParsers.unwrapArray(api.getMyTvodPurchases()).map(JsonParsers::parseCatalogItem)
        }.getOrDefault(emptyList())
    }

    suspend fun getCategoryItems(typeId: Int, language: String): List<CatalogItem> {
        return runCatching {
            val apiLang = if (language == "all-indian") "non-kannada" else language
            when (val res = loadHomeCatalog(typeId = typeId, language = apiLang)) {
                is ApiResult.Success -> (res.data.banners + res.data.sections.flatMap { it.items }).distinctBy { it.id }
                is ApiResult.Error -> getTrending()
            }
        }.getOrDefault(emptyList())
    }

    // ── Subscriptions, Coupons & Razorpay Checkout ──────────────────────────
    suspend fun getPlans(): ApiResult<List<SubscriptionPlan>> {
        return try {
            val res = api.getPlans()
            ApiResult.Success(JsonParsers.unwrapArray(res).map(JsonParsers::parsePlan))
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun validateCoupon(code: String, amountInRupees: Double, planId: Long): ApiResult<Double> {
        return try {
            val res = api.validateCoupon(code.trim().uppercase(), amountInRupees, planId)
            val obj = JsonParsers.unwrapObject(res)
            val discount = JsonParsers.double(obj, "discountAmount", "discount_amount")
            ApiResult.Success(discount)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun createSubscriptionOrder(plan: SubscriptionPlan, couponCode: String?): ApiResult<CreatedOrder> {
        return try {
            val user = sessionManager.session.value
            val body = buildJsonObject {
                put("planId", plan.id)
                put("plan_id", plan.id)
                put("package_id", plan.id)
                put("provider", "RAZORPAY")
                put("gateway", "RAZORPAY")
                if (user != null) {
                    put("userId", user.id)
                    put("email", user.email)
                    put("phone", user.phoneNumber)
                    put("full_name", user.fullName)
                }
                if (!couponCode.isNullOrBlank()) {
                    put("couponCode", couponCode.trim().uppercase())
                    put("coupon_code", couponCode.trim().uppercase())
                }
            }
            val res = api.createOrder(body)
            val obj = JsonParsers.unwrapObject(res) ?: return ApiResult.Error("Unable to create payment order.")
            val orderId = JsonParsers.str(obj, "gatewayOrderId", "razorpayOrderId", "orderId", "order_id", "id")
            val keyId = JsonParsers.str(obj, "keyId", "key_id", "key", "razorpay_key")
            val amountPaise = JsonParsers.long(obj, "amount")
            val isFree = JsonParsers.bool(obj, "isFree") || amountPaise <= 0L ||
                JsonParsers.str(obj, "status").equals("SUCCESS", true)
            if (isFree) {
                sessionManager.updateSubscription(1, plan.name)
            }
            ApiResult.Success(
                CreatedOrder(
                    orderId = orderId,
                    gatewayOrderId = orderId.takeIf { it.startsWith("order_") },
                    keyId = keyId,
                    amountPaise = amountPaise,
                    currency = JsonParsers.str(obj, "currency").ifBlank { "INR" },
                    isFree = isFree,
                    status = JsonParsers.str(obj, "status").ifBlank { "CREATED" }
                )
            )
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun verifyPayment(
        orderId: String,
        paymentId: String,
        signature: String,
        planName: String
    ): ApiResult<Boolean> {
        return try {
            val body = buildJsonObject {
                put("order_id", orderId)
                put("orderId", orderId)
                put("razorpay_order_id", orderId)
                put("razorpay_payment_id", paymentId)
                put("paymentId", paymentId)
                put("razorpay_signature", signature)
                put("signature", signature)
            }
            api.verifyPayment(body)
            sessionManager.updateSubscription(1, planName)
            ApiResult.Success(true)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun createTvodOrder(
        contentId: Long,
        priceInr: Double,
        purchaseType: String = "RENT"
    ): ApiResult<CreatedOrder> {
        return try {
            val user = sessionManager.session.value
            val body = buildJsonObject {
                put("contentId", contentId)
                put("content_id", contentId)
                put("video_id", contentId)
                put("type", purchaseType.uppercase())
                put("purchaseType", purchaseType.uppercase())
                put("orderType", "TVOD")
                if (priceInr > 0.0) put("amount", priceInr)
                put("provider", "RAZORPAY")
                put("gateway", "RAZORPAY")
                if (user != null) {
                    put("userId", user.id)
                    put("email", user.email)
                    put("phone", user.phoneNumber)
                    put("full_name", user.fullName)
                }
            }
            val res = api.createOrder(body)
            checkEnvelopeError(res)?.let { return ApiResult.Error(it) }
            val obj = JsonParsers.unwrapObject(res) ?: return ApiResult.Error("Unable to start rental checkout.")
            val orderId = JsonParsers.str(obj, "gatewayOrderId", "razorpayOrderId", "orderId", "order_id", "id")
            val keyId = JsonParsers.str(obj, "keyId", "key_id", "key", "razorpay_key")
            val amountPaise = JsonParsers.long(obj, "amount").let {
                if (it > 0L) it else (priceInr * 100).toLong()
            }
            val isFree = JsonParsers.bool(obj, "isFree") || amountPaise <= 0L ||
                JsonParsers.str(obj, "status").equals("SUCCESS", true)
            ApiResult.Success(
                CreatedOrder(
                    orderId = orderId,
                    gatewayOrderId = orderId.takeIf { it.startsWith("order_") },
                    keyId = keyId,
                    amountPaise = amountPaise,
                    currency = JsonParsers.str(obj, "currency").ifBlank { "INR" },
                    isFree = isFree,
                    status = JsonParsers.str(obj, "status").ifBlank { "CREATED" }
                )
            )
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun verifyTvodPayment(
        orderId: String,
        paymentId: String,
        signature: String
    ): ApiResult<Boolean> {
        return try {
            val body = buildJsonObject {
                put("order_id", orderId)
                put("orderId", orderId)
                put("razorpay_order_id", orderId)
                put("razorpay_payment_id", paymentId)
                put("paymentId", paymentId)
                put("razorpay_signature", signature)
                put("signature", signature)
            }
            val res = api.verifyPayment(body)
            checkEnvelopeError(res)?.let { return ApiResult.Error(it) }
            ApiResult.Success(true)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    // ── Secure Playback & Heartbeats ────────────────────────────────────────
    suspend fun authorizePlayback(contentId: Long, episodeId: Long? = null): ApiResult<PlaybackAuth> {
        return try {
            val body = buildJsonObject {
                put("content_id", contentId)
                put("video_id", episodeId ?: contentId)
                put("video_type", if (episodeId != null) 2 else 1)
                put("device", "mobile")
                put("device_type", "ANDROID")
                put("deviceType", "ANDROID")
                put("device_id", sessionManager.getOrCreateDeviceId())
                if (episodeId != null) put("episodeId", episodeId)
            }
            val res = api.authorizePlayback(body)
            val obj = JsonParsers.unwrapObject(res) ?: return ApiResult.Error("No playable stream returned.")
            val url = MediaUrlNormalizer.normalize(
                JsonParsers.str(obj, "stream_url", "streamUrl", "hls_url", "hlsUrl", "master_playlist_url")
            )
            if (url.isBlank()) return ApiResult.Error("This title has no playable stream yet.")
            ApiResult.Success(
                PlaybackAuth(
                    streamUrl = url,
                    sessionToken = JsonParsers.str(obj, "sessionToken", "session_token", "sessionId"),
                    resumePositionSeconds = JsonParsers.int(obj, "resumePositionSeconds", "resume_position_seconds"),
                    durationSeconds = JsonParsers.int(obj, "durationSeconds", "duration_seconds"),
                    showAds = JsonParsers.bool(obj, "showAds", "show_ads"),
                    vastTagUrl = JsonParsers.str(obj, "vastTagUrl", "vast_tag_url").takeIf { it.isNotBlank() },
                    isHls = url.contains(".m3u8", true) || url.contains("manifest", true)
                )
            )
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun sendHeartbeat(sessionToken: String, contentId: Long, posSec: Int, durSec: Int) {
        if (sessionToken.isBlank() || posSec <= 0) return
        runCatching {
            api.sendHeartbeat(buildJsonObject {
                put("sessionToken", sessionToken)
                put("contentId", contentId)
                put("positionSeconds", posSec)
                put("currentPositionSeconds", posSec)
                put("durationSeconds", durSec)
                put("totalDurationSeconds", durSec)
                put("deviceType", "ANDROID")
            })
        }
    }

    suspend fun stopPlayback(sessionToken: String, contentId: Long, posSec: Int, durSec: Int) {
        if (sessionToken.isBlank()) return
        runCatching {
            api.stopPlayback(buildJsonObject {
                put("sessionToken", sessionToken)
                put("contentId", contentId)
                put("positionSeconds", posSec)
                put("durationSeconds", durSec)
                put("deviceType", "ANDROID")
            })
        }
    }

    // ── Super-App Portal Banners & Games Arena ──────────────────────────────
    suspend fun getPortalBanners(): List<PortalBannerItem> {
        return runCatching {
            JsonParsers.unwrapArray(api.getPortalBanners("all")).map { obj ->
                PortalBannerItem(
                    id = JsonParsers.long(obj, "id"),
                    portalKey = JsonParsers.str(obj, "portalKey", "portal_key"),
                    title = JsonParsers.str(obj, "title"),
                    subtitle = JsonParsers.str(obj, "subtitle"),
                    imageUrl = MediaUrlNormalizer.normalize(
                        JsonParsers.str(obj, "mobileImageUrl", "imageUrl", "image_url")
                    ),
                    buttonLabel = JsonParsers.str(obj, "buttonLabel", "button_label")
                )
            }
        }.getOrDefault(emptyList())
    }

    suspend fun getGamerProfile(): GamerProfile {
        return runCatching {
            val obj = JsonParsers.unwrapObject(api.getGamerProfile())
            val lifetime = obj?.get("lifetime") as? JsonObject
            GamerProfile(
                gamerUid = JsonParsers.str(obj, "gamerUid", "gamer_uid"),
                name = JsonParsers.str(obj, "name"),
                coins = JsonParsers.int(obj, "coins"),
                matchesPlayed = JsonParsers.int(lifetime, "matchesPlayed"),
                matchesWon = JsonParsers.int(lifetime, "matchesWon")
            )
        }.getOrDefault(GamerProfile())
    }

    suspend fun getCoinPacks(): List<CoinPackItem> {
        return runCatching {
            val res = api.getCoinPacks()
            val arr = (JsonParsers.unwrapObject(res)?.get("packs") as? JsonArray)
                ?.mapNotNull { it as? JsonObject }
                ?: JsonParsers.unwrapArray(res)
            arr.mapNotNull { p ->
                val id = JsonParsers.str(p, "id", "packId")
                val coins = JsonParsers.int(p, "coins")
                if (id.isBlank() || coins <= 0) null else CoinPackItem(
                    id = id,
                    coins = coins,
                    amountInr = JsonParsers.double(p, "amountInr", "amount_inr"),
                    label = JsonParsers.str(p, "label")
                )
            }
        }.getOrDefault(emptyList())
    }

    suspend fun checkMaintenanceStatus(): MaintenanceStatus {
        return try {
            val res = api.getSettings()
            val obj = JsonParsers.unwrapObject(res)
            if (obj != null) {
                val active = JsonParsers.bool(obj, "maintenanceMode", "maintenance_mode", "maintenance_mode_enabled")
                val msg = JsonParsers.str(obj, "maintenanceMessage", "maintenance_message")
                    .ifBlank { "We are currently performing scheduled maintenance to improve your experience. Please check back shortly." }
                val name = JsonParsers.str(obj, "APP_NAME", "app_name", "appName", "appShortName")
                    .ifBlank { sessionManager.brand.value.name.ifBlank { "MaxxPixels" } }
                val logo = MediaUrlNormalizer.normalize(
                    JsonParsers.str(obj, "darkLogoUrl", "dark_logo_url", "logoUrl", "logo_url", "APP_LOGO_URL")
                ).ifBlank { sessionManager.brand.value.logoUrl }
                MaintenanceStatus(active = active, message = msg, appName = name, logoUrl = logo)
            } else {
                MaintenanceStatus()
            }
        } catch (_: Exception) {
            MaintenanceStatus()
        }
    }

    suspend fun launchGameUrl(game: String? = null): ApiResult<String> {
        return try {
            val res = api.launchGame(game)
            checkEnvelopeError(res)?.let { return ApiResult.Error(it) }
            val obj = JsonParsers.unwrapObject(res)
            val url = JsonParsers.str(obj, "launchUrl", "launch_url", "url")
            if (url.isBlank()) ApiResult.Error("Could not launch game arena right now.")
            else ApiResult.Success(url)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun createCoinOrder(packId: String): ApiResult<CoinOrderData> {
        return try {
            val res = api.createCoinOrder(buildJsonObject { put("packId", packId) })
            checkEnvelopeError(res)?.let { return ApiResult.Error(it) }
            val obj = JsonParsers.unwrapObject(res)
                ?: return ApiResult.Error("Could not start coin recharge order.")
            val orderId = JsonParsers.str(obj, "razorpayOrderId", "razorpay_order_id", "id")
            val keyId = JsonParsers.str(obj, "keyId", "key_id", "key", "razorpayKeyId")
            val amount = JsonParsers.int(obj, "amount")
            val currency = JsonParsers.str(obj, "currency").ifBlank { "INR" }
            val coins = JsonParsers.int(obj, "coins")
            if (orderId.isBlank()) return ApiResult.Error("Could not start payment (missing order id).")
            if (keyId.isBlank()) return ApiResult.Error("Payment gateway is not configured (missing Razorpay key).")
            ApiResult.Success(
                CoinOrderData(
                    razorpayOrderId = orderId,
                    keyId = keyId,
                    amountPaise = amount,
                    currency = currency,
                    coins = coins
                )
            )
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun verifyCoinPayment(
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String
    ): ApiResult<Int> {
        return try {
            val res = api.verifyCoinPayment(buildJsonObject {
                put("razorpayOrderId", razorpayOrderId)
                put("razorpayPaymentId", razorpayPaymentId)
                put("razorpaySignature", razorpaySignature)
            })
            checkEnvelopeError(res)?.let { return ApiResult.Error(it) }
            val obj = JsonParsers.unwrapObject(res)
            val coins = JsonParsers.int(obj, "coins")
            ApiResult.Success(coins)
        } catch (e: Throwable) {
            extractError(e)
        }
    }

    suspend fun claimSubscriptionCoins(
        paymentId: String? = null,
        subscriptionId: String? = null,
        validUntil: String? = null
    ) {
        runCatching {
            api.claimSubscriptionCoins(buildJsonObject {
                if (!paymentId.isNullOrBlank()) put("paymentId", paymentId)
                if (!subscriptionId.isNullOrBlank()) put("subscriptionId", subscriptionId)
                if (!validUntil.isNullOrBlank()) put("validUntil", validUntil)
            })
        }
    }
}
