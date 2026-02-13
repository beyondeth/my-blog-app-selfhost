package com.myblog.android

import com.myblog.android.core.di.AppDi
import com.myblog.android.core.di.AppDiFactory

object AppRuntime {
    const val BASE_URL: String = "http://10.0.2.2:3000"

    val di: AppDi by lazy {
        AppDiFactory.createWithHttpAuth(baseUrl = BASE_URL)
    }
}
