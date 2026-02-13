package com.myblog.android.app

import com.myblog.android.app.model.AppShellEvent
import com.myblog.android.app.model.AppShellState
import com.myblog.android.core.navigation.AppDestination

object AppShellReducer {
    fun reduce(current: AppShellState, event: AppShellEvent): AppShellState {
        return when (event) {
            AppShellEvent.Start -> AppShellState.Booting
            is AppShellEvent.SessionRestored -> AppShellState.Main(
                selectedTab = AppDestination.Feed,
                authState = event.authState,
            )

            is AppShellEvent.SessionExpired -> AppShellState.LoginRequired(event.reason)
            is AppShellEvent.LoggedOut -> AppShellState.LoginRequired(event.reason)
            is AppShellEvent.TabSelected -> reduceTabSelection(current, event.destination)
        }
    }

    private fun reduceTabSelection(current: AppShellState, destination: AppDestination): AppShellState {
        if (current !is AppShellState.Main) {
            return current
        }

        if (!isTabDestination(destination)) {
            return current
        }

        return current.copy(selectedTab = destination)
    }

    private fun isTabDestination(destination: AppDestination): Boolean {
        return destination == AppDestination.Feed ||
            destination == AppDestination.Community ||
            destination == AppDestination.Profile ||
            destination == AppDestination.Compose
    }
}
