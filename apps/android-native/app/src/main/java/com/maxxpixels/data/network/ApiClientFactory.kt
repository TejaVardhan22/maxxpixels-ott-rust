package com.maxxpixels.data.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.maxxpixels.BuildConfig
import com.maxxpixels.data.local.SessionManager
import com.maxxpixels.data.model.JsonParsers
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Retrofit + OkHttp factory featuring:
 * - Automatic Bearer token injection
 * - Single-flight 401 token refresh Authenticator (prevents logout storms)
 * - Automatic retry with backoff on transient network disconnects for GET calls
 */
object ApiClientFactory {
    val json: Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    fun create(sessionManager: SessionManager): MaxxApiService {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val token = sessionManager.getAuthToken()
            val builder = original.newBuilder()
                .header("Accept", "application/json")
                .header("X-Platform", "ANDROID")
            if (!token.isNullOrBlank() && original.header("Authorization") == null) {
                builder.header("Authorization", "Bearer $token")
            }
            chain.proceed(builder.build())
        }

        // Resilient GET retry interceptor for unstable mobile networks
        val retryInterceptor = Interceptor { chain ->
            val request = chain.request()
            var attempt = 0
            var lastError: IOException? = null
            val maxAttempts = if (request.method.equals("GET", ignoreCase = true)) 2 else 1
            while (attempt < maxAttempts) {
                try {
                    return@Interceptor chain.proceed(request)
                } catch (e: IOException) {
                    lastError = e
                    attempt++
                    if (attempt >= maxAttempts) throw e
                    try {
                        Thread.sleep(450L * attempt)
                    } catch (_: InterruptedException) {
                        throw e
                    }
                }
            }
            throw lastError ?: IOException("Network request failed")
        }

        val tokenAuthenticator = object : Authenticator {
            private val lock = Any()

            override fun authenticate(route: Route?, response: Response): Request? {
                if (response.request.url.encodedPath.contains("auth/refresh")) return null
                if (responseCount(response) >= 2) return null

                synchronized(lock) {
                    val currentToken = sessionManager.getAuthToken()
                    val failedToken = response.request.header("Authorization")?.removePrefix("Bearer ")?.trim()
                    if (!currentToken.isNullOrBlank() && currentToken != failedToken) {
                        return response.request.newBuilder()
                            .header("Authorization", "Bearer $currentToken")
                            .build()
                    }

                    val refreshToken = sessionManager.getRefreshToken() ?: run {
                        sessionManager.clearSession()
                        return null
                    }

                    return try {
                        val refreshClient = OkHttpClient.Builder()
                            .connectTimeout(15, TimeUnit.SECONDS)
                            .readTimeout(20, TimeUnit.SECONDS)
                            .build()
                        val refreshRetrofit = Retrofit.Builder()
                            .baseUrl(BuildConfig.API_BASE_URL)
                            .client(refreshClient)
                            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                            .build()
                        val refreshApi = refreshRetrofit.create(MaxxApiService::class.java)
                        val body = buildJsonObject { put("refreshToken", refreshToken) }
                        val res = kotlinx.coroutines.runBlocking { refreshApi.refreshToken(body) }
                        val obj = JsonParsers.unwrapObject(res) as? JsonObject
                        if (obj != null) {
                            val updated = JsonParsers.parseUser(obj, currentToken.orEmpty(), refreshToken)
                            if (updated.authToken.isNotBlank()) {
                                sessionManager.saveSession(updated)
                                return response.request.newBuilder()
                                    .header("Authorization", "Bearer ${updated.authToken}")
                                    .build()
                            }
                        }
                        sessionManager.clearSession()
                        null
                    } catch (_: Exception) {
                        null
                    }
                }
            }

            private fun responseCount(response: Response): Int {
                var count = 1
                var prior = response.priorResponse
                while (prior != null) {
                    count++
                    prior = prior.priorResponse
                }
                return count
            }
        }

        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }

        val okHttp = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .addInterceptor(retryInterceptor)
            .addInterceptor(logging)
            .authenticator(tokenAuthenticator)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttp)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(MaxxApiService::class.java)
    }
}
