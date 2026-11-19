# ==============================================================================
# MaxxPixels OTT Production ProGuard & R8 Optimization Rules
# Prevents class-stripping, JNI errors, and package flattening crashes
# ==============================================================================

# General Keep Attributes
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,JavascriptInterface,SourceFile,LineNumberTable

# Preserve Application & MainActivity entrypoints
-keep class com.maxxpixels.** { *; }
-keepclassmembers class com.maxxpixels.** { *; }

# React Native Core & JNI Bridges
-keep class com.facebook.react.** { *; }
-keepclassmembers class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keepclassmembers class com.facebook.jni.** { *; }

-keepclassmembers class * {
    native <methods>;
    @com.facebook.react.bridge.ReactMethod *;
    @com.facebook.react.uimanager.annotations.ReactProp *;
    @com.facebook.react.uimanager.annotations.ReactPropGroup *;
    @android.webkit.JavascriptInterface <methods>;
}

-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

-keepclassmembers class * implements com.facebook.react.bridge.JavaScriptModule {
    public *;
}
-keepclassmembers class * implements com.facebook.react.bridge.NativeModule {
    @com.facebook.react.bridge.ReactMethod *;
}
-keep class com.facebook.react.turbomodule.core.CallInvokerHolderImpl { *; }
-keep class com.facebook.react.turbomodule.core.NativeMethodCallInvokerHolderImpl { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.jni.**

# Hermes JavaScript Engine
-keep class com.facebook.hermes.** { *; }
-keepclassmembers class com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**

# SoLoader Native Library Loader
-keep class com.facebook.soloader.** { *; }
-keepclassmembers class com.facebook.soloader.** { *; }
-dontwarn com.facebook.soloader.**

# React Native Video, ExoPlayer & Media3
-keep class com.brentvatne.** { *; }
-keepclassmembers class com.brentvatne.** { *; }
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-dontwarn com.brentvatne.**
-dontwarn com.google.android.exoplayer2.**

# Safe Area & React Navigation Screens
-keep class com.swmansion.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-dontwarn com.swmansion.**
-dontwarn com.th3rdwave.safeareacontext.**
-dontwarn com.horcrux.svg.**
-dontwarn com.reactnativecommunity.asyncstorage.**

# Google Mobile Ads (AdMob)
-keep class io.invertase.googlemobileads.** { *; }
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**
-dontwarn io.invertase.googlemobileads.**

# Firebase & Google Play Services
-keep class io.invertase.firebase.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Razorpay Payment Gateway SDK
-keep class com.razorpay.** { *; }
-keepclassmembers class com.razorpay.** { *; }
-keep class com.razorpay.CheckoutActivity { *; }
-dontwarn com.razorpay.**

# Network Libraries (OkHttp, Okio)
-dontwarn okhttp3.**
-dontwarn okio.**

# Fresco Image Pipeline & Bitmaps
-keep class com.facebook.drawee.** { *; }
-keep class com.facebook.imagepipeline.** { *; }
-dontwarn com.facebook.drawee.**
-dontwarn com.facebook.imagepipeline.**

# Image Picker
-dontwarn com.imagepicker.**

# InMobi Android SDK 11.5.1 & OMSDK Optimization Rules
-keep class com.inmobi.** { *; }
-keepclassmembers class com.inmobi.** { *; }
-dontwarn com.inmobi.**
-keep class com.iab.omid.** { *; }
-keepclassmembers class com.iab.omid.** { *; }
-dontwarn com.iab.omid.**
