package com.myblog.android

import android.app.Application

class MyBlogAndroidApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppRuntime.init(this)
    }
}
