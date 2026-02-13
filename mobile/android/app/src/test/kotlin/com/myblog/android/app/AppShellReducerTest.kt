package com.myblog.android.app

import com.myblog.android.app.model.AppShellEvent
import com.myblog.android.app.model.AppShellState
import com.myblog.android.core.navigation.AppDestination
import com.myblog.android.feature.auth.model.AuthState
import com.myblog.android.feature.auth.model.UserSession
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class AppShellReducerTest {
    @Test
    fun sessionRestoredMovesToMainFeedTab() {
        val restored = AppShellReducer.reduce(
            current = AppShellState.Booting,
            event = AppShellEvent.SessionRestored(
                authState = AuthState.LoggedIn(
                    UserSession(userId = "u1", email = "a@b.com", displayName = "A"),
                ),
            ),
        )

        val main = assertIs<AppShellState.Main>(restored)
        assertEquals(AppDestination.Feed, main.selectedTab)
    }

    @Test
    fun tabSelectionWorksOnlyInsideMainState() {
        val booting = AppShellReducer.reduce(
            current = AppShellState.Booting,
            event = AppShellEvent.TabSelected(AppDestination.Profile),
        )
        assertIs<AppShellState.Booting>(booting)

        val main = AppShellState.Main(
            selectedTab = AppDestination.Feed,
            authState = AuthState.LoggedIn(
                UserSession(userId = "u1", email = "a@b.com", displayName = "A"),
            ),
        )

        val selected = AppShellReducer.reduce(
            current = main,
            event = AppShellEvent.TabSelected(AppDestination.Profile),
        )
        assertEquals(AppDestination.Profile, (selected as AppShellState.Main).selectedTab)
    }
}
