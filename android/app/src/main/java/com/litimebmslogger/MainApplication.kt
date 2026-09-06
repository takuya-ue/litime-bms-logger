package com.litimebmslogger

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsAccessor
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsLocalAccessor
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {
    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        // RN 0.77.x: libreact_featureflagsjni.so is merged into libreactnative.so and
        // not shipped as a separate file. ReactNativeFeatureFlags tries to load it via
        // SoLoader before libreactnative.so is available, causing a crash. Replace the
        // CxxAccessor with the pure-Kotlin LocalAccessor so no .so load is attempted.
        // load() will still call ReactNativeFeatureFlags.override() which sets the
        // correct New Architecture flag values through the local accessor.
        try {
            val localAccessor = ReactNativeFeatureFlagsLocalAccessor()
            val accessorField = ReactNativeFeatureFlags.javaClass.getDeclaredField("accessor")
            accessorField.isAccessible = true
            accessorField.set(ReactNativeFeatureFlags, localAccessor)
            val providerField = ReactNativeFeatureFlags.javaClass.getDeclaredField("accessorProvider")
            providerField.isAccessible = true
            val provider: () -> ReactNativeFeatureFlagsAccessor = { ReactNativeFeatureFlagsLocalAccessor() }
            providerField.set(ReactNativeFeatureFlags, provider)
        } catch (_: Exception) {
            // Reflection failed — app will crash on first flag read, same as current state.
        }
        SoLoader.init(this, OpenSourceMergedSoMapping)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
    }
}
