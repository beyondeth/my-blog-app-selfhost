package com.myblog.android.core.di

import com.myblog.android.core.auth.RefreshCoordinator
import com.myblog.android.core.auth.TokenStore
import com.myblog.android.core.navigation.AppDestination
import com.myblog.android.feature.auth.AuthRepository
import com.myblog.android.feature.feed.FeedRepository
import com.myblog.android.feature.settings.SettingsRepository

interface AppDi {
    fun startDestination(): AppDestination
    fun authRepository(): AuthRepository
    fun tokenStore(): TokenStore
    fun refreshCoordinator(): RefreshCoordinator
    fun feedRepository(): FeedRepository
    fun settingsRepository(): SettingsRepository
}
