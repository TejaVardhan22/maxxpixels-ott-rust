package com.maxxpixels

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.graphics.Bitmap
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Log
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.imagepipeline.core.ImagePipelineConfig
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.inmobi.sdk.InMobiSdk
import com.inmobi.sdk.SdkInitializationListener
import org.json.JSONObject

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here
          add(SystemUiPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    initFrescoBitmapOptimizations()
    initInMobiSdk()
    createNotificationChannels()
    loadReactNative(this)
  }

  private fun initInMobiSdk() {
    try {
      val consentObject = JSONObject()
      val primaryInmobiId = "8839a620596f46169ed937f1568740db"
      val fallbackInmobiId = "b0e3f3a3b99e4ed7b9a82cd25cc59481"

      InMobiSdk.init(this, primaryInmobiId, consentObject, object : SdkInitializationListener {
        override fun onInitializationComplete(error: Error?) {
          if (error == null) {
            Log.d("InMobiSdk", "InMobi SDK 11.5.1 initialized successfully with ID $primaryInmobiId")
          } else {
            Log.w("InMobiSdk", "InMobi init with $primaryInmobiId failed (${error.message}), trying fallback $fallbackInmobiId")
            try {
              InMobiSdk.init(this@MainApplication, fallbackInmobiId, consentObject, object : SdkInitializationListener {
                override fun onInitializationComplete(fallbackErr: Error?) {
                  if (fallbackErr == null) {
                    Log.d("InMobiSdk", "InMobi SDK initialized successfully with fallback ID $fallbackInmobiId")
                  } else {
                    Log.w("InMobiSdk", "InMobi fallback init error: ${fallbackErr.message}")
                  }
                }
              })
            } catch (fbEx: Exception) {
              Log.w("InMobiSdk", "InMobi fallback init exception: ${fbEx.message}")
            }
          }
        }
      })
    } catch (e: Exception) {
      Log.w("InMobiSdk", "InMobi SDK initialization caught exception: ${e.message}")
    }
  }

  private fun initFrescoBitmapOptimizations() {
    try {
      val pipelineConfig = ImagePipelineConfig.newBuilder(this)
        .setDownsampleEnabled(true)
        .setResizeAndRotateEnabledForNetwork(true)
        .setBitmapsConfig(Bitmap.Config.RGB_565)
        .build()
      Fresco.initialize(this, pipelineConfig)
    } catch (ignored: Exception) {
      // Fallback to default Fresco pipeline if already initialized
    }
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
          ?: return

      val soundUri = Uri.parse("android.resource://${packageName}/raw/maxxpixels_notify")
      val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      // New channel IDs ensure Android applies custom sound (existing channel settings are immutable).
      val alertsChannel = NotificationChannel(
        "maxxpixels_alerts",
        "MaxxPixels Alerts",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "MaxxPixels updates, new releases and alerts"
        enableLights(true)
        enableVibration(true)
        setSound(soundUri, audioAttributes)
      }

      val broadcastsChannel = NotificationChannel(
        "maxxpixels_broadcasts",
        "MaxxPixels Broadcasts",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "MaxxPixels alerts, content updates and announcements"
        enableLights(true)
        enableVibration(true)
        setSound(soundUri, audioAttributes)
      }

      notificationManager.createNotificationChannel(alertsChannel)
      notificationManager.createNotificationChannel(broadcastsChannel)
    }
  }
}
