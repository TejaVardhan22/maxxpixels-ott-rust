package com.maxxpixels.data.network

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Complete Rust API (/api/v1/) contract migrated from React Native services.
 * Uses kotlinx.serialization JsonElement so both camelCase and snake_case backend
 * envelopes unwrap cleanly without crashing on optional fields.
 */
interface MaxxApiService {

    // ── Settings & Legal ────────────────────────────────────────────────────
    @GET("settings")
    suspend fun getSettings(): JsonElement

    @GET("legal")
    suspend fun getLegalPages(): JsonElement

    // ── Auth & Profile ──────────────────────────────────────────────────────
    @POST("auth/send-otp")
    suspend fun sendOtp(@Body body: JsonObject): JsonElement

    @POST("auth/resend-otp")
    suspend fun resendOtp(@Body body: JsonObject): JsonElement

    @POST("auth/verify-otp")
    suspend fun verifyOtp(@Body body: JsonObject): JsonElement

    @POST("auth/login")
    suspend fun login(@Body body: JsonObject): JsonElement

    @POST("auth/register")
    suspend fun register(@Body body: JsonObject): JsonElement

    @POST("auth/refresh")
    suspend fun refreshToken(@Body body: JsonObject): JsonElement

    @POST("auth/logout")
    suspend fun logout(@Body body: JsonObject): JsonElement

    @GET("auth/profile")
    suspend fun getProfile(): JsonElement

    @PUT("profile")
    suspend fun updateProfile(@Body body: JsonObject): JsonElement

    @Multipart
    @POST("storage/upload")
    suspend fun uploadFile(
        @Part file: MultipartBody.Part,
        @Part("folder") folder: RequestBody
    ): JsonElement

    @POST("auth/device-token")
    suspend fun registerDeviceToken(@Body body: JsonObject): JsonElement

    // ── Catalog & Discovery ─────────────────────────────────────────────────
    @GET("content-types")
    suspend fun getContentTypes(): JsonElement

    @GET("cms/banners")
    suspend fun getBanners(
        @Query("platform") platform: String = "MOBILE",
        @Query("typeId") typeId: Int? = null,
        @Query("language") language: String? = null
    ): JsonElement

    @GET("cms/sections")
    suspend fun getSections(
        @Query("typeId") typeId: Int? = null,
        @Query("language") language: String? = null
    ): JsonElement

    @GET("categories")
    suspend fun getCategories(): JsonElement

    @GET("languages")
    suspend fun getLanguages(): JsonElement

    @GET("catalog/{id}")
    suspend fun getContentDetail(@Path("id") id: String): JsonElement

    @GET("catalog/seasons/{seasonId}/episodes")
    suspend fun getSeasonEpisodes(@Path("seasonId") seasonId: Long): JsonElement

    @GET("search")
    suspend fun search(
        @Query("q") query: String,
        @Query("size") size: Int = 40,
        @Query("language") language: String? = null,
        @Query("type") type: String? = null
    ): JsonElement

    @GET("content/trending")
    suspend fun getTrending(): JsonElement

    @GET("content/shorts")
    suspend fun getShorts(): JsonElement

    @GET("content/by-language/{lang}")
    suspend fun getContentByLanguage(@Path("lang") lang: String): JsonElement

    @GET("content/non-kannada")
    suspend fun getNonKannadaContent(): JsonElement

    // ── Playback, Heartbeat & Telemetry ─────────────────────────────────────
    @POST("video/play")
    suspend fun authorizePlayback(@Body body: JsonObject): JsonElement

    @POST("playback/heartbeat")
    suspend fun sendHeartbeat(@Body body: JsonObject): JsonElement

    @POST("playback/stop")
    suspend fun stopPlayback(@Body body: JsonObject): JsonElement

    @POST("watch/history")
    suspend fun syncWatchHistory(@Body body: JsonObject): JsonElement

    @GET("watch/continue-watching")
    suspend fun getContinueWatching(): JsonElement

    @POST("analytics/event")
    suspend fun recordAnalyticsEvent(@Body body: JsonObject): JsonElement

    // ── Watchlist & Notifications ───────────────────────────────────────────
    @GET("watchlist")
    suspend fun getWatchlist(): JsonElement

    @POST("watchlist/{contentId}")
    suspend fun addToWatchlist(@Path("contentId") contentId: Long, @Body body: JsonObject): JsonElement

    @DELETE("watchlist/{contentId}")
    suspend fun removeFromWatchlist(@Path("contentId") contentId: Long): JsonElement

    @GET("notifications")
    suspend fun getNotifications(): JsonElement

    @POST("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: Long, @Body body: JsonObject): JsonElement

    @POST("notifications/read-all")
    suspend fun markAllNotificationsRead(@Body body: JsonObject): JsonElement

    @DELETE("notifications/clear-all")
    suspend fun clearAllNotifications(): JsonElement

    // ── Subscriptions, Coupons & Razorpay Payments ──────────────────────────
    @GET("plans")
    suspend fun getPlans(): JsonElement

    @GET("payments/my-subscription")
    suspend fun getMySubscription(): JsonElement

    @GET("coupons/validate")
    suspend fun validateCoupon(
        @Query("code") code: String,
        @Query("amount") amount: Double,
        @Query("planId") planId: Long? = null
    ): JsonElement

    @POST("payments/create-order")
    suspend fun createOrder(@Body body: JsonObject): JsonElement

    @POST("payments/verify")
    suspend fun verifyPayment(
        @Body body: JsonObject,
        @Query("provider") provider: String = "RAZORPAY"
    ): JsonElement

    @GET("tvod/products")
    suspend fun getTvodProducts(): JsonElement

    @GET("tvod/purchases")
    suspend fun getMyTvodPurchases(): JsonElement

    // ── Super-App Portal Banners & Games Arena (PlayforFun + Coin Wallet) ───
    @GET("cms/portal-banners")
    suspend fun getPortalBanners(@Query("portalKey") portalKey: String = "all"): JsonElement

    @GET("games/playforfun/launch")
    suspend fun launchGame(@Query("game") game: String? = null): JsonElement

    @GET("games/playforfun/me")
    suspend fun getGamerProfile(): JsonElement

    @GET("games/coins/packs")
    suspend fun getCoinPacks(): JsonElement

    @POST("games/coins/order")
    suspend fun createCoinOrder(@Body body: JsonObject): JsonElement

    @POST("games/coins/verify")
    suspend fun verifyCoinPayment(@Body body: JsonObject): JsonElement

    @POST("games/coins/subscription-grant")
    suspend fun claimSubscriptionCoins(@Body body: JsonObject): JsonElement
}
