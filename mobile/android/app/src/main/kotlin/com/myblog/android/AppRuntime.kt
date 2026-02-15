package com.myblog.android

import android.content.Context
import com.myblog.android.core.auth.SharedPreferencesTokenStore
import com.myblog.android.core.di.AppDi
import com.myblog.android.core.di.AppDiFactory

object AppRuntime {
    const val BASE_URL: String = "http://10.0.2.2:3000"
    private lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    val di: AppDi by lazy {
        check(::appContext.isInitialized) { "AppRuntime.init(context) must be called before accessing di" }
        AppDiFactory.createWithHttpAuth(
            baseUrl = BASE_URL,
            tokenStore = SharedPreferencesTokenStore(appContext),
        )
    }
}
