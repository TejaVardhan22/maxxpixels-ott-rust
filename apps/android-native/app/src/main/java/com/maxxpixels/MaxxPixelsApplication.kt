package com.maxxpixels

import android.app.Application
import com.maxxpixels.data.local.SessionManager
import com.maxxpixels.data.network.ApiClientFactory
import com.maxxpixels.data.network.NetworkMonitor
import com.maxxpixels.data.repository.MaxxRepository

class MaxxPixelsApplication : Application() {
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
}
