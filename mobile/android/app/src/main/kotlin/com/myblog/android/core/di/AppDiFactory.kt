package com.myblog.android.core.di

import com.myblog.android.core.auth.InMemoryTokenStore
import com.myblog.android.core.auth.RefreshCoordinator
import com.myblog.android.core.auth.TokenStore
import com.myblog.android.core.navigation.AppDestination
import com.myblog.android.core.network.AuthenticatedRequestExecutor
import com.myblog.android.core.network.HttpTransport
import com.myblog.android.core.network.JdkHttpTransport
import com.myblog.android.feature.auth.AuthRefreshCoordinator
import com.myblog.android.feature.auth.AuthRepository
import com.myblog.android.feature.auth.network.MobileContractAuthRepository
import com.myblog.android.feature.feed.FeedRepository
import com.myblog.android.feature.feed.network.HttpFeedRepository
import com.myblog.android.feature.auth.network.HttpAuthApi
import com.myblog.android.feature.settings.SettingsRepository
import com.myblog.android.feature.settings.network.HttpSettingsRepository

object AppDiFactory {
    fun createWithHttpAuth(
        baseUrl: String,
        initialDestination: AppDestination = AppDestination.Auth,
        tokenStore: TokenStore = InMemoryTokenStore(),
        transport: HttpTransport = JdkHttpTransport(),
        settingsRepository: SettingsRepository? = null,
    ): DefaultAppDi {
        val authApi = HttpAuthApi(
            transport = transport,
            baseUrl = baseUrl,
            accessTokenProvider = tokenStore::readAccessToken,
        )
        val authRepository: AuthRepository = MobileContractAuthRepository(authApi)
        val refreshCoordinator: RefreshCoordinator = AuthRefreshCoordinator(
            authRepository = authRepository,
            tokenStore = tokenStore,
        )
        val requestExecutor = AuthenticatedRequestExecutor(
            tokenStore = tokenStore,
            refreshCoordinator = refreshCoordinator,
        )
        val feedRepository: FeedRepository = HttpFeedRepository(
            transport = transport,
            requestExecutor = requestExecutor,
            baseUrl = baseUrl,
        )
        val resolvedSettingsRepository: SettingsRepository = settingsRepository ?: HttpSettingsRepository(
            transport = transport,
            requestExecutor = requestExecutor,
            baseUrl = baseUrl,
        )

        return DefaultAppDi(
            authApi = authApi,
            tokenStore = tokenStore,
            authRepositoryOverride = authRepository,
            refreshCoordinatorOverride = refreshCoordinator,
            feedRepositoryOverride = feedRepository,
            settingsRepositoryOverride = resolvedSettingsRepository,
            initialDestination = initialDestination,
        )
    }
}
