package com.myblog.android.app

import com.myblog.android.app.model.AppShellEvent
import com.myblog.android.app.model.AppShellState
import com.myblog.android.feature.auth.AuthSessionManager
import com.myblog.android.feature.auth.model.AuthState
import com.myblog.android.feature.auth.model.AuthState.LoggedIn

class AppBootstrapCoordinator(
    private val authSessionManager: AuthSessionManager,
    private val appShellCoordinator: AppShellCoordinator,
) {
    suspend fun bootstrap() {
        appShellCoordinator.dispatch(AppShellEvent.Start)
        authSessionManager.startRestore()

        when (val authState = authSessionManager.state.value) {
            is LoggedIn -> appShellCoordinator.dispatch(AppShellEvent.SessionRestored(authState))
            is AuthState.Expired -> appShellCoordinator.dispatch(AppShellEvent.SessionExpired(authState.reason))
            AuthState.LoggedOut,
            AuthState.Restoring,
            -> appShellCoordinator.dispatch(AppShellEvent.LoggedOut(reason = null))
        }
    }

    fun shellState(): AppShellState = appShellCoordinator.state.value
}
