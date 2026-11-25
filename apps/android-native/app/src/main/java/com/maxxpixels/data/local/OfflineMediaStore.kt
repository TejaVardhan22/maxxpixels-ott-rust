package com.maxxpixels.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

@Serializable
data class OfflineDownloadEntry(
    val contentId: Long,
    val title: String,
    val posterUrl: String = "",
    val durationLabel: String = "",
    val localFilePath: String,
    val sizeBytes: Long = 0L,
    val downloadedAtMs: Long = System.currentTimeMillis()
)

/**
 * Secure App-Private Offline Media Store:
 * - Saves downloaded files strictly inside internal private storage (`filesDir/secure_offline`)
 *   so external file managers and other apps cannot read or copy protected media.
 * - Stores download index metadata inside Hardware-Keystore-backed EncryptedSharedPreferences.
 */
class OfflineMediaStore(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val mediaDir: File = File(context.filesDir, "secure_offline").apply { mkdirs() }

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "maxxpixels_offline_index",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (_: Exception) {
        context.getSharedPreferences("maxxpixels_offline_index_fb", Context.MODE_PRIVATE)
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    fun listDownloads(): List<OfflineDownloadEntry> {
        val raw = prefs.getString(KEY_INDEX, null) ?: return emptyList()
        val entries = runCatching { json.decodeFromString<List<OfflineDownloadEntry>>(raw) }.getOrDefault(emptyList())
        return entries.filter { File(it.localFilePath).exists() }
    }

    fun isDownloaded(contentId: Long): Boolean =
        listDownloads().any { it.contentId == contentId }

    fun deleteDownload(contentId: Long) {
        val current = listDownloads().toMutableList()
        val target = current.firstOrNull { it.contentId == contentId }
        if (target != null) {
            runCatching { File(target.localFilePath).delete() }
            current.removeAll { it.contentId == contentId }
            saveIndex(current)
        }
    }

    suspend fun downloadToPrivateStorage(
        contentId: Long,
        title: String,
        posterUrl: String,
        durationLabel: String,
        streamUrl: String
    ): Result<OfflineDownloadEntry> = withContext(Dispatchers.IO) {
        runCatching {
            val ext = if (streamUrl.contains(".m3u8", ignoreCase = true)) "m3u8" else "mp4"
            val outFile = File(mediaDir, "mx_${contentId}.$ext")
            val req = Request.Builder().url(streamUrl).build()
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) error("Download failed (HTTP ${resp.code})")
                val body = resp.body ?: error("Empty stream response")
                body.byteStream().use { input ->
                    outFile.outputStream().use { output ->
                        input.copyTo(output, bufferSize = 32 * 1024)
                    }
                }
            }
            val entry = OfflineDownloadEntry(
                contentId = contentId,
                title = title,
                posterUrl = posterUrl,
                durationLabel = durationLabel,
                localFilePath = outFile.absolutePath,
                sizeBytes = outFile.length(),
                downloadedAtMs = System.currentTimeMillis()
            )
            val updated = listDownloads().filterNot { it.contentId == contentId } + entry
            saveIndex(updated)
            entry
        }
    }

    private fun saveIndex(entries: List<OfflineDownloadEntry>) {
        prefs.edit().putString(KEY_INDEX, json.encodeToString(entries)).apply()
    }

    companion object {
        private const val KEY_INDEX = "offline_downloads_v1"
    }
}
