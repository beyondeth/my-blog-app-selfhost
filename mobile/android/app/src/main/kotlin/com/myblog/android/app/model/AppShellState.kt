package com.myblog.android.app.model

import com.myblog.android.core.navigation.AppDestination
import com.myblog.android.feature.auth.model.AuthState

sealed interface AppShellState {
    data object Booting : AppShellState
    data class LoginRequired(val reason: String?) : AppShellState
    data class Main(
        val selectedTab: AppDestination,
        val authState: AuthState.LoggedIn,
    ) : AppShellState
}

sealed interface AppShellEvent {
    data object Start : AppShellEvent
    data class SessionRestored(val authState: AuthState.LoggedIn) : AppShellEvent
    data class SessionExpired(val reason: String) : AppShellEvent
    data class LoggedOut(val reason: String?) : AppShellEvent
    data class TabSelected(val destination: AppDestination) : AppShellEvent
}
