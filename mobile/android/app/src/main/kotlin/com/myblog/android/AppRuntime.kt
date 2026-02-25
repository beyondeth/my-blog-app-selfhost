package com.myblog.android

import android.content.Context
import com.myblog.android.core.auth.SharedPreferencesTokenStore
import com.myblog.android.core.di.AppDi
import com.myblog.android.core.di.AppDiFactory

object AppRuntime {
    const val BASE_URL: String = BuildConfig.API_BASE_URL
    const val OAUTH_CALLBACK_URL: String = BuildConfig.OAUTH_CALLBACK_URL
    const val OAUTH_CALLBACK_SCHEME: String = "codebase"
    const val OAUTH_CALLBACK_HOST: String = "auth"
    const val OAUTH_CALLBACK_PATH: String = "/callback"
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
