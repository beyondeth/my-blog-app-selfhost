package com.myblog.android.core.navigation

import com.myblog.android.app.model.AppShellState

object AppRouteCoordinator {
    private const val PROFILE_SETTINGS_ROUTE = "profile/settings"

    fun currentDestination(shellState: AppShellState): AppDestination {
        return when (shellState) {
            AppShellState.Booting,
            is AppShellState.LoginRequired,
            -> AppDestination.Auth

            is AppShellState.Main -> shellState.selectedTab
        }
    }

    fun profileSettingsRoute(): String = PROFILE_SETTINGS_ROUTE
}
