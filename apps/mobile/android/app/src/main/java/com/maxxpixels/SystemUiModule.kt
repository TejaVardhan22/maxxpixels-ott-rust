package com.maxxpixels

import android.os.Build
import android.view.View
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class SystemUiModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SystemUi"

    @ReactMethod
    fun setSecureScreen(enabled: Boolean) {
        val activity = reactApplicationContext.currentActivity ?: return
        UiThreadUtil.runOnUiThread {
            try {
                val window = activity.window ?: return@runOnUiThread
                if (enabled) {
                    window.setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                    )
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
            } catch (ignored: Exception) {
            }
        }
    }

    @ReactMethod
    fun setImmersive(enabled: Boolean) {
        val activity = reactApplicationContext.currentActivity ?: return
        UiThreadUtil.runOnUiThread {
            try {
                val window = activity.window ?: return@runOnUiThread
                val decorView = window.decorView

                val controller = WindowCompat.getInsetsController(window, decorView)
                if (enabled) {
                    controller.systemBarsBehavior =
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    controller.hide(WindowInsetsCompat.Type.systemBars())

                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                        @Suppress("DEPRECATION")
                        decorView.systemUiVisibility = (
                            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            or View.SYSTEM_UI_FLAG_FULLSCREEN
                            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        )
                    }
                } else {
                    controller.show(WindowInsetsCompat.Type.systemBars())

                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                        @Suppress("DEPRECATION")
                        decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
                    }
                }
            } catch (ignored: Exception) {
            }
        }
    }
}
