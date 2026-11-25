package com.maxxpixels

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.maxxpixels.data.local.SessionManager
import com.maxxpixels.data.network.ApiClientFactory
import com.maxxpixels.data.network.NetworkMonitor
import com.maxxpixels.data.repository.MaxxRepository

class MaxxPixelsApplication : Application(), ImageLoaderFactory {
    lateinit var sessionManager: SessionManager
        private set
    lateinit var networkMonitor: NetworkMonitor
        private set
    lateinit var repository: MaxxRepository
        private set

    override fun onCreate() {
        super.onCreate()
        sessionManager = SessionManager(this)
        networkMonitor = NetworkMonitor(this)
        val api = ApiClientFactory.create(sessionManager)
        repository = MaxxRepository(api, sessionManager)
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("coil_image_cache"))
                    .maxSizeBytes(150L * 1024L * 1024L)
                    .build()
            }
            .crossfade(120)
            .respectCacheHeaders(false)
            .build()
    }
}
