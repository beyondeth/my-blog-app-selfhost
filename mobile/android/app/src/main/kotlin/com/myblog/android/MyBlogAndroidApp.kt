package com.myblog.android

import android.app.Application
import com.myblog.android.core.ui.theme.AppThemePreferenceStore

class MyBlogAndroidApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppThemePreferenceStore.apply(AppThemePreferenceStore.read(this))
        AppRuntime.init(this)
    }
}
