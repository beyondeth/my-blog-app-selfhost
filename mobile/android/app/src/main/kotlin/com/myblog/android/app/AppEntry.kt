package com.myblog.android.app

import com.myblog.android.core.di.AppDi
import com.myblog.android.core.di.AppDiFactory
import com.myblog.android.core.navigation.AppDestination
import com.myblog.android.feature.auth.AuthSessionManager

object AppEntry {
    fun start(di: AppDi): AppDestination = di.startDestination()

    fun bootstrapCoordinator(di: AppDi): AppBootstrapCoordinator {
        val authSessionManager = AuthSessionManager(
            authRepository = di.authRepository(),
            tokenStore = di.tokenStore(),
        )
        return AppBootstrapCoordinator(
            authSessionManager = authSessionManager,
            appShellCoordinator = AppShellCoordinator(),
        )
    }

    fun bootstrapCoordinatorWithHttp(
        baseUrl: String,
        initialDestination: AppDestination = AppDestination.Auth,
    ): AppBootstrapCoordinator {
        val di = AppDiFactory.createWithHttpAuth(
            baseUrl = baseUrl,
            initialDestination = initialDestination,
        )
        return bootstrapCoordinator(di)
    }
}
