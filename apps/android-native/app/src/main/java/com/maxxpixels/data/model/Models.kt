package com.maxxpixels.data.model

import com.maxxpixels.BuildConfig
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull

@Serializable
data class UserSession(
    val id: Long = 0L,
    val fullName: String = "Subscriber",
    val email: String = "",
    val phoneNumber: String = "",
    val avatarUrl: String = "",
    val authToken: String = "",
    val refreshToken: String = "",
    val isBuy: Int = 0,
    val packageName: String = "Free",
    val expiryDate: String = ""
) {
    val isLoggedIn: Boolean get() = id > 0L && authToken.isNotBlank()
    val hasActiveSubscription: Boolean get() = isBuy == 1
}

@Serializable
data class BrandIdentity(
    val name: String = "MaxxPixels",
    val shortName: String = "MaxxPixels",
    val logoUrl: String = "",
    val description: String = "Stream Movies, Short Films & Web Series"
)

@Serializable
data class ContentTypeItem(
    val id: Int,
    val slug: String,
    val title: String
)

@Serializable
data class CatalogItem(
    val id: Long,
    val title: String,
    val slug: String = "",
    val description: String = "",
    val posterUrl: String = "",
    val landscapeUrl: String = "",
    val contentType: String = "MOVIE",
    val videoType: Int = 1,
    val typeId: Int = 1,
    val language: String = "Kannada",
    val releaseYear: String = "",
    val durationLabel: String = "",
    val durationSeconds: Int = 0,
    val maturityRating: String = "U/A 13+",
    val genres: List<String> = emptyList(),
    val isPremium: Boolean = false,
    val isRent: Boolean = false,
    val rentPrice: Double = 0.0,
    val purchasePrice: Double = 0.0,
    val isPurchased: Boolean = false,
    val isBookmarked: Boolean = false,
    val isLiked: Boolean = false,
    val resumeSeconds: Int = 0,
    val progressPercent: Float = 0f,
    val trailerUrl: String = "",
    val creatorName: String = "",
    val cast: List<CastMember> = emptyList(),
    val seasons: List<SeasonItem> = emptyList()
)

@Serializable
data class CastMember(
    val id: Long = 0L,
    val name: String,
    val role: String = "Cast",
    val photoUrl: String = ""
)

@Serializable
data class SeasonItem(
    val id: Long,
    val name: String,
    val seasonNumber: Int = 1
)

@Serializable
data class EpisodeItem(
    val id: Long,
    val name: String,
    val description: String = "",
    val thumbnailUrl: String = "",
    val durationLabel: String = "",
    val isPremium: Boolean = false,
    val episodeNumber: Int = 1
)

@Serializable
data class HomeSection(
    val id: Long,
    val title: String,
    val isLandscape: Boolean = false,
    val items: List<CatalogItem> = emptyList()
)

@Serializable
data class SubscriptionPlan(
    val id: Long,
    val name: String,
    val description: String = "",
    val price: Double = 0.0,
    val originalPrice: Double? = null,
    val currency: String = "₹",
    val durationDays: Int = 30,
    val billingPeriod: String = "MONTHLY",
    val maxScreens: Int = 1,
    val maxQuality: String = "Full HD",
    val allowOfflineDownload: Boolean = false,
    val isActivePlan: Boolean = false,
    val isPopular: Boolean = false,
    val features: List<String> = emptyList()
)

@Serializable
data class PlaybackAuth(
    val streamUrl: String,
    val sessionToken: String = "",
    val resumePositionSeconds: Int = 0,
    val durationSeconds: Int = 0,
    val showAds: Boolean = false,
    val vastTagUrl: String? = null,
    val isHls: Boolean = true
)

@Serializable
data class CreatedOrder(
    val orderId: String,
    val gatewayOrderId: String? = null,
    val keyId: String = "",
    val amountPaise: Long = 0L,
    val currency: String = "INR",
    val isFree: Boolean = false,
    val status: String = "CREATED"
)

@Serializable
data class NotificationEntry(
    val id: Long,
    val title: String,
    val message: String,
    val imageUrl: String = "",
    val createdAt: String = "",
    val isRead: Boolean = false
)

@Serializable
data class PortalBannerItem(
    val id: Long = 0L,
    val portalKey: String = "",
    val title: String = "",
    val subtitle: String = "",
    val imageUrl: String = "",
    val buttonLabel: String = ""
)

@Serializable
data class GamerProfile(
    val gamerUid: String = "",
    val name: String = "",
    val coins: Int = 0,
    val matchesPlayed: Int = 0,
    val matchesWon: Int = 0
)

@Serializable
data class CoinPackItem(
    val id: String,
    val coins: Int,
    val amountInr: Double,
    val label: String = ""
)

@Serializable
data class CoinOrderData(
    val razorpayOrderId: String,
    val keyId: String,
    val amountPaise: Int,
    val currency: String = "INR",
    val coins: Int = 0
)

@Serializable
data class MaintenanceStatus(
    val active: Boolean = false,
    val message: String = "We are currently performing scheduled maintenance. Please check back shortly.",
    val appName: String = "MaxxPixels",
    val logoUrl: String = ""
)

object MediaUrlNormalizer {
    private val apiOrigin: String = BuildConfig.API_BASE_URL
        .removeSuffix("/")
        .removeSuffix("/api/v1")
        .removeSuffix("/api")

    fun normalize(raw: String?): String {
        val value = raw?.trim().orEmpty()
        if (value.isEmpty()) return ""
        if (value.startsWith("file:") || value.startsWith("content:") || value.startsWith("data:")) {
            return value
        }
        if (value.startsWith("//")) return "https:$value"
        if (!value.startsWith("http://", true) && !value.startsWith("https://", true)) {
            val clean = value.trimStart('/')
            return when {
                clean.startsWith("uploads/", true) -> "$apiOrigin/api/v1/uploads/${clean.removePrefix("uploads/")}"
                clean.startsWith("storage/", true) -> "$apiOrigin/api/v1/uploads/${clean.removePrefix("storage/")}"
                else -> "$apiOrigin/api/v1/uploads/$clean"
            }
        }
        // Route Bunny storage pull-zone URLs through the backend media proxy; leave HLS streams untouched.
        val isStream = value.contains(".b-cdn.net", true) && value.contains("vz-", true) || value.contains(".m3u8", true)
        if (!isStream && (value.contains("maxxpixels-images.b-cdn.net", true) || value.contains("cdn.maxxpixels.com", true))) {
            val idx = value.indexOf("/", startIndex = 8)
            if (idx > 0) {
                val rel = value.substring(idx + 1)
                    .removePrefix("api/v1/uploads/")
                    .removePrefix("uploads/")
                return "$apiOrigin/api/v1/uploads/$rel"
            }
        }
        return value
    }
}

/** Resilient JSON helpers to parse both camelCase and snake_case fields from Rust API responses. */
object JsonParsers {
    fun unwrapObject(el: JsonElement?): JsonObject? {
        if (el == null) return null
        if (el is JsonObject) {
            val inner = el["data"] ?: el["result"]
            if (inner is JsonObject) return inner
            if (inner is JsonArray && inner.firstOrNull() is JsonObject) return inner.first() as JsonObject
            return el
        }
        if (el is JsonArray && el.firstOrNull() is JsonObject) return el.first() as JsonObject
        return null
    }

    fun unwrapArray(el: JsonElement?): List<JsonObject> {
        if (el == null) return emptyList()
        val arr = when (el) {
            is JsonArray -> el
            is JsonObject -> {
                val d = el["data"] ?: el["result"]
                when (d) {
                    is JsonArray -> d
                    is JsonObject -> d["content"] as? JsonArray ?: d["items"] as? JsonArray
                    else -> el["content"] as? JsonArray ?: el["items"] as? JsonArray
                }
            }
            else -> null
        }
        return arr?.mapNotNull { it as? JsonObject } ?: emptyList()
    }

    fun str(obj: JsonObject?, vararg keys: String): String {
        if (obj == null) return ""
        for (k in keys) {
            val v = obj[k]
            if (v is JsonPrimitive && !v.isString && v.contentOrNull != null && v.content != "null") {
                return v.content
            }
            if (v is JsonPrimitive && v.isString && v.content.isNotBlank()) {
                return v.content.trim()
            }
        }
        return ""
    }

    fun long(obj: JsonObject?, vararg keys: String): Long {
        if (obj == null) return 0L
        for (k in keys) {
            val v = obj[k] as? JsonPrimitive ?: continue
            v.longOrNull?.let { return it }
            v.contentOrNull?.toLongOrNull()?.let { return it }
        }
        return 0L
    }

    fun int(obj: JsonObject?, vararg keys: String): Int = long(obj, *keys).toInt()

    fun double(obj: JsonObject?, vararg keys: String): Double {
        if (obj == null) return 0.0
        for (k in keys) {
            val v = obj[k] as? JsonPrimitive ?: continue
            v.doubleOrNull?.let { return it }
            v.contentOrNull?.toDoubleOrNull()?.let { return it }
        }
        return 0.0
    }

    fun bool(obj: JsonObject?, vararg keys: String): Boolean {
        if (obj == null) return false
        for (k in keys) {
            val v = obj[k] as? JsonPrimitive ?: continue
            v.booleanOrNull?.let { return it }
            v.intOrNull?.let { return it == 1 }
            val s = v.contentOrNull?.lowercase()
            if (s == "true" || s == "1") return true
            if (s == "false" || s == "0") return false
        }
        return false
    }

    fun parseUser(root: JsonObject, existingToken: String = "", existingRefresh: String = ""): UserSession {
        val userObj = (root["user"] as? JsonObject) ?: root
        val token = str(root, "accessToken", "access_token", "token", "auth_token")
            .ifBlank { str(userObj, "authToken", "auth_token", "accessToken") }
            .ifBlank { existingToken }
        val refresh = str(root, "refreshToken", "refresh_token")
            .ifBlank { str(userObj, "refreshToken", "refresh_token") }
            .ifBlank { existingRefresh }

        val isBuy = when {
            int(userObj, "is_buy", "isBuy", "is_buy_package") == 1 -> 1
            int(root, "is_buy", "isBuy") == 1 -> 1
            bool(userObj, "isSubscribed", "is_subscribed", "subscribed") -> 1
            bool(root, "isSubscribed", "is_subscribed") -> 1
            str(userObj, "subscriptionStatus", "subscription_status").equals("ACTIVE", true) -> 1
            else -> 0
        }

        return UserSession(
            id = long(userObj, "id", "userId", "user_id"),
            fullName = str(userObj, "fullName", "full_name", "name", "userName").ifBlank { "Subscriber" },
            email = str(userObj, "email"),
            phoneNumber = str(userObj, "phoneNumber", "phone_number", "mobileNumber", "mobile_number", "phone", "mobile"),
            avatarUrl = MediaUrlNormalizer.normalize(str(userObj, "avatarUrl", "avatar_url", "image")),
            authToken = token,
            refreshToken = refresh,
            isBuy = isBuy,
            packageName = str(userObj, "packageName", "package_name", "planName", "plan_name")
                .ifBlank { str(root, "packageName", "package_name") }
                .ifBlank { if (isBuy == 1) "VIP Membership" else "Free" },
            expiryDate = str(userObj, "expiryDate", "expiry_date", "endDate", "end_date", "expire_date")
        )
    }

    fun formatDuration(seconds: Int): String {
        if (seconds <= 0) return ""
        val h = seconds / 3600
        val m = (seconds % 3600) / 60
        return when {
            h > 0 && m > 0 -> "${h}h ${m}m"
            h > 0 -> "${h}h"
            m > 0 -> "${m}m"
            else -> "${seconds}s"
        }
    }

    fun parseCatalogItem(obj: JsonObject): CatalogItem {
        val contentObj = (obj["content"] as? JsonObject) ?: obj
        val id = long(obj, "contentId", "content_id", "video_id", "videoId", "id")
            .let { if (it > 0) it else long(contentObj, "id", "video_id") }

        val rawPoster = str(
            contentObj,
            "posterUrl", "poster_url", "poster", "thumbnail", "image", "imageUrl", "image_url"
        ).ifBlank { str(obj, "posterUrl", "thumbnail", "image", "mobileImageUrl", "imageUrl") }

        val rawLandscape = str(
            obj,
            "mobileImageUrl", "bannerImageUrl", "bannerUrl", "banner_url", "landscapeImageUrl",
            "landscape_image_url", "landscape", "imageUrl", "banner"
        ).ifBlank {
            str(contentObj, "landscapeImageUrl", "landscape_image_url", "landscape", "bannerUrl", "banner")
        }.ifBlank { rawPoster }

        val durationSec = int(contentObj, "durationSeconds", "duration_seconds", "video_duration")
            .let { if (it > 0) it else int(obj, "durationSeconds", "duration_seconds", "video_duration") }
        val durationLabel = str(contentObj, "duration").ifBlank { formatDuration(durationSec) }

        val genresList = mutableListOf<String>()
        val rawGenres = contentObj["genres"] ?: contentObj["categories"] ?: obj["genres"]
        if (rawGenres is JsonArray) {
            rawGenres.forEach { g ->
                when (g) {
                    is JsonPrimitive -> g.contentOrNull?.takeIf { it.isNotBlank() }?.let(genresList::add)
                    is JsonObject -> str(g, "name", "title").takeIf { it.isNotBlank() }?.let(genresList::add)
                    else -> {}
                }
            }
        } else if (rawGenres is JsonPrimitive && rawGenres.content.isNotBlank()) {
            rawGenres.content.split(",", "•", "|").map { it.trim() }.filter { it.isNotBlank() }.forEach(genresList::add)
        }
        val catName = str(contentObj, "category_name", "categoryName", "genre")
        if (catName.isNotBlank() && genresList.isEmpty()) genresList.add(catName)

        val rawCastElem = contentObj["cast"]
            ?: contentObj["castMembers"]
            ?: contentObj["cast_members"]
            ?: contentObj["cast_crew"]
            ?: contentObj["castAndCrew"]
            ?: contentObj["actors"]
            ?: contentObj["starring"]
            ?: obj["cast"]
        val castList = when (rawCastElem) {
            is JsonArray -> rawCastElem.mapNotNull { entry ->
                when (entry) {
                    is JsonPrimitive -> entry.contentOrNull?.takeIf { it.isNotBlank() }?.let { CastMember(name = it) }
                    is JsonObject -> {
                        val n = str(entry, "name", "fullName", "full_name", "actorName", "title")
                        if (n.isBlank()) null else CastMember(
                            id = long(entry, "id"),
                            name = n,
                            role = str(entry, "role", "character", "designation", "type").ifBlank { "Cast" },
                            photoUrl = MediaUrlNormalizer.normalize(str(entry, "imageUrl", "image_url", "image", "avatarUrl", "photo", "profileImage"))
                        )
                    }
                    else -> null
                }
            }
            is JsonPrimitive -> rawCastElem.contentOrNull
                ?.split(",", "•", "|")
                ?.map { it.trim() }
                ?.filter { it.isNotBlank() }
                ?.map { CastMember(name = it, role = "Cast") }
                ?: emptyList()
            else -> emptyList()
        }

        val seasonsList = (contentObj["seasons"] as? JsonArray ?: contentObj["season"] as? JsonArray)
            ?.mapIndexedNotNull { idx, entry ->
                val sObj = entry as? JsonObject ?: return@mapIndexedNotNull null
                val sid = long(sObj, "id", "seasonId")
                if (sid <= 0) null else SeasonItem(
                    id = sid,
                    name = str(sObj, "name", "title").ifBlank { "Season ${idx + 1}" },
                    seasonNumber = int(sObj, "seasonNumber", "season_number").let { if (it > 0) it else idx + 1 }
                )
            } ?: emptyList()

        val monetization = str(contentObj, "monetization", "accessType", "access_type").uppercase()
        val rentPrice = double(contentObj, "rent_price", "rentPrice", "price")
        val purchasePrice = double(contentObj, "purchase_price", "purchasePrice", "buy_price", "buyPrice")
        val isPurchased = bool(contentObj, "is_purchased", "isPurchased", "hasPurchased", "has_purchased")
        val isRent = bool(contentObj, "is_rent", "isRent") || monetization == "TVOD" || monetization == "RENT" || rentPrice > 0.0 || purchasePrice > 0.0
        val isPremium = !isRent && (bool(contentObj, "is_premium", "isPremium") || monetization == "SVOD")

        val resumeSec = int(obj, "positionSeconds", "position_seconds", "stop_time", "watchedSeconds")
        val rawPct = double(obj, "percentage").toFloat()
        val computedPct = when {
            rawPct > 0f -> (rawPct / 100f).coerceIn(0f, 1f)
            resumeSec > 0 && durationSec > 0 -> (resumeSec.toFloat() / durationSec.toFloat()).coerceIn(0f, 1f)
            else -> 0f
        }

        val ctRaw = str(contentObj, "contentType", "content_type", "type").ifBlank { "MOVIE" }.uppercase()
        val inferredTypeId = int(contentObj, "type_id", "typeId").let { explicit ->
            if (explicit > 0) explicit else when {
                ctRaw.contains("SERIES") || ctRaw.contains("SHOW") -> 6
                ctRaw.contains("SHORT") -> 3
                ctRaw.contains("MICRO") || ctRaw.contains("REEL") -> 4
                ctRaw.contains("SONG") || ctRaw.contains("MUSIC") || ctRaw.contains("ALBUM") -> 2
                ctRaw.contains("PODCAST") -> 5
                ctRaw.contains("AI") -> 7
                else -> 1
            }
        }

        val resolvedCreator = str(
            contentObj,
            "creatorName", "creator_name", "creator",
            "directorName", "director_name", "director",
            "producerName", "producer_name", "producer",
            "productionHouse", "production_house", "studio", "channelName"
        ).ifBlank {
            castList.firstOrNull {
                val r = it.role.lowercase()
                r.contains("director") || r.contains("creator") || r.contains("producer")
            }?.name.orEmpty()
        }

        return CatalogItem(
            id = id,
            title = str(contentObj, "title", "name").ifBlank { str(obj, "title", "name").ifBlank { "Untitled" } },
            slug = str(contentObj, "slug").ifBlank { str(obj, "slug") },
            description = str(
                contentObj,
                "description", "synopsis", "longDescription", "long_description",
                "shortDescription", "short_description", "overview", "storyline"
            ).ifBlank { str(obj, "description", "synopsis", "subtitle") },
            posterUrl = MediaUrlNormalizer.normalize(rawPoster),
            landscapeUrl = MediaUrlNormalizer.normalize(rawLandscape),
            contentType = ctRaw,
            videoType = int(contentObj, "video_type", "videoType").let { if (it > 0) it else inferredTypeId },
            typeId = inferredTypeId,
            language = str(contentObj, "originalLanguage", "language", "language_name").ifBlank { "Kannada" },
            releaseYear = str(contentObj, "releaseYear", "release_year").take(4),
            durationLabel = durationLabel,
            durationSeconds = durationSec,
            maturityRating = str(contentObj, "ageRating", "maturity_rating", "age_rating", "certification").ifBlank { "U/A 13+" },
            genres = genresList.take(3),
            isPremium = isPremium,
            isRent = isRent,
            rentPrice = rentPrice,
            purchasePrice = purchasePrice,
            isPurchased = isPurchased,
            isBookmarked = bool(contentObj, "is_bookmark", "isBookmarked"),
            isLiked = bool(contentObj, "is_user_like", "is_like", "isLiked"),
            resumeSeconds = resumeSec,
            progressPercent = computedPct,
            trailerUrl = MediaUrlNormalizer.normalize(str(contentObj, "trailerUrl", "trailer_url")),
            creatorName = resolvedCreator,
            cast = castList,
            seasons = seasonsList
        )
    }

    fun parsePlan(obj: JsonObject): SubscriptionPlan {
        val features = mutableListOf<String>()
        val rawFeatures = obj["features"] ?: obj["data"]
        if (rawFeatures is JsonArray) {
            rawFeatures.forEach { f ->
                when (f) {
                    is JsonPrimitive -> f.contentOrNull?.takeIf { it.isNotBlank() }?.let(features::add)
                    is JsonObject -> str(f, "title", "package_value", "name").takeIf { it.isNotBlank() }?.let(features::add)
                    else -> {}
                }
            }
        }
        val price = double(obj, "discountPrice", "discount_price", "price")
        val orig = double(obj, "price").takeIf { it > price && price > 0 }
        val name = str(obj, "name", "title").ifBlank { "VIP Plan" }
        val maxScreens = int(obj, "maxConcurrentStreams", "max_concurrent_streams", "maxDevices", "no_of_device").let { if (it > 0) it else 1 }
        val maxQuality = str(obj, "maxVideoQuality", "max_video_quality", "videoQuality").ifBlank { "Full HD" }

        if (features.isEmpty()) {
            features.add("Stream in $maxQuality quality")
            features.add("Watch on up to $maxScreens device${if (maxScreens > 1) "s" else ""}")
            features.add("All Movies, Web Series & Originals")
        }

        val allowOffline = bool(
            obj,
            "allowDownloads", "allow_downloads", "allowOfflineDownload", "allow_offline_download",
            "offlineDownloads", "offline_downloads", "downloadEnabled", "download_enabled", "canDownload"
        ) || features.any { f ->
            val fl = f.lowercase()
            (fl.contains("download") || fl.contains("offline")) && !fl.contains("no download") && !fl.contains("no offline")
        }

        return SubscriptionPlan(
            id = long(obj, "id"),
            name = name,
            description = str(obj, "description"),
            price = price,
            originalPrice = orig,
            currency = str(obj, "currency_code", "currencySymbol").ifBlank { "₹" },
            durationDays = int(obj, "durationDays", "duration_days", "time").let { if (it > 0) it else 30 },
            billingPeriod = str(obj, "billingPeriod", "billing_period", "billingCycle").ifBlank { "MONTHLY" },
            maxScreens = maxScreens,
            maxQuality = maxQuality,
            allowOfflineDownload = allowOffline,
            isActivePlan = bool(obj, "is_active_plan", "isActivePlan"),
            isPopular = name.contains("annual", true) || name.contains("platinum", true) || name.contains("premium", true),
            features = features
        )
    }
}
