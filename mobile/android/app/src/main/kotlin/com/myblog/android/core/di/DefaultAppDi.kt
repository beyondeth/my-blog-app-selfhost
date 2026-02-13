package com.myblog.android.core.di

import com.myblog.android.core.auth.InMemoryTokenStore
import com.myblog.android.core.auth.RefreshCoordinator
import com.myblog.android.core.auth.TokenStore
import com.myblog.android.core.navigation.AppDestination
import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.AuthRefreshCoordinator
import com.myblog.android.feature.auth.AuthRepository
import com.myblog.android.feature.auth.model.AuthTokens
import com.myblog.android.feature.auth.model.UserSession
import com.myblog.android.feature.auth.network.AuthApi
import com.myblog.android.feature.auth.network.MobileContractAuthRepository
import com.myblog.android.feature.feed.FeedRepository
import com.myblog.android.feature.feed.model.FeedItem
import com.myblog.android.feature.feed.model.FeedPage
import com.myblog.android.feature.settings.InMemorySettingsRepository
import com.myblog.android.feature.settings.SettingsRepository

class DefaultAppDi(
    private val authApi: AuthApi,
    private val tokenStore: TokenStore = InMemoryTokenStore(),
    private val authRepositoryOverride: AuthRepository? = null,
    private val refreshCoordinatorOverride: RefreshCoordinator? = null,
    private val feedRepositoryOverride: FeedRepository = InMemoryFeedRepository(),
    private val settingsRepositoryOverride: SettingsRepository = InMemorySettingsRepository(),
    private val initialDestination: AppDestination = AppDestination.Auth,
) : AppDi {
    private val tokenStoreInstance: TokenStore = tokenStore
    private val authRepositoryInstance: AuthRepository = authRepositoryOverride ?: MobileContractAuthRepository(authApi)
    private val refreshCoordinatorInstance: RefreshCoordinator = refreshCoordinatorOverride ?: AuthRefreshCoordinator(
        authRepository = authRepositoryInstance,
        tokenStore = tokenStoreInstance,
    )
    private val feedRepositoryInstance: FeedRepository = feedRepositoryOverride
    private val settingsRepositoryInstance: SettingsRepository = settingsRepositoryOverride

    override fun startDestination(): AppDestination = initialDestination

    override fun authRepository(): AuthRepository = authRepositoryInstance

    override fun tokenStore(): TokenStore = tokenStoreInstance

    override fun refreshCoordinator(): RefreshCoordinator = refreshCoordinatorInstance

    override fun feedRepository(): FeedRepository = feedRepositoryInstance

    override fun settingsRepository(): SettingsRepository = settingsRepositoryInstance
}

private class InMemoryFeedRepository : FeedRepository {
    private val initialItems = listOf(
        FeedItem(
            postId = "post-1",
            title = "Welcome to MyBlog Android",
            excerpt = "Initial feed wiring for Kotlin architecture.",
            authorName = "MyBlog",
            liked = false,
            likeCount = 0,
        ),
    )

    override suspend fun getFeed(cursor: String?): ApiResult<FeedPage> {
        return ApiResult.Success(
            FeedPage(
                items = if (cursor == null) initialItems else emptyList(),
                nextCursor = null,
                hasMore = false,
            ),
        )
    }

    override suspend fun refreshFeed(): ApiResult<FeedPage> = getFeed(cursor = null)
}
