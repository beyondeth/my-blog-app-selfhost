package com.myblog.android.feature.settings

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.settings.model.AppThemePreference
import com.myblog.android.feature.settings.model.NotificationPreferences
import com.myblog.android.feature.settings.model.PrivacyPreferences
import com.myblog.android.feature.settings.model.SettingsSnapshot
import com.myblog.android.feature.settings.model.SettingsState
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class SettingsCoordinatorTest {
    @Test
    fun loadMapsSnapshotToReadyState() = runTest {
        val repository = FakeSettingsRepository(snapshot = sampleSnapshot())
        val coordinator = SettingsCoordinator(repository)

        coordinator.load()

        val ready = assertIs<SettingsState.Ready>(coordinator.state.value)
        assertEquals(AppThemePreference.SYSTEM, ready.snapshot.themePreference)
    }

    @Test
    fun updateThemeReplacesStateSnapshot() = runTest {
        val repository = FakeSettingsRepository(snapshot = sampleSnapshot())
        val coordinator = SettingsCoordinator(repository)

        coordinator.updateTheme(AppThemePreference.DARK)

        val ready = assertIs<SettingsState.Ready>(coordinator.state.value)
        assertEquals(AppThemePreference.DARK, ready.snapshot.themePreference)
    }
}

private class FakeSettingsRepository(
    private var snapshot: SettingsSnapshot,
) : SettingsRepository {
    override suspend fun getSettings(): ApiResult<SettingsSnapshot> = ApiResult.Success(snapshot)

    override suspend fun updateThemePreference(themePreference: AppThemePreference): ApiResult<SettingsSnapshot> {
        snapshot = snapshot.copy(themePreference = themePreference)
        return ApiResult.Success(snapshot)
    }

    override suspend fun updateNotificationPreferences(preferences: NotificationPreferences): ApiResult<SettingsSnapshot> {
        snapshot = snapshot.copy(notifications = preferences)
        return ApiResult.Success(snapshot)
    }

    override suspend fun updatePrivacyPreferences(preferences: PrivacyPreferences): ApiResult<SettingsSnapshot> {
        snapshot = snapshot.copy(privacy = preferences)
        return ApiResult.Success(snapshot)
    }
}

private fun sampleSnapshot(): SettingsSnapshot {
    return SettingsSnapshot(
        themePreference = AppThemePreference.SYSTEM,
        notifications = NotificationPreferences(
            pushEnabled = true,
            marketingEnabled = false,
            communityReplyEnabled = true,
        ),
        privacy = PrivacyPreferences(
            profileVisible = true,
            activityVisible = true,
        ),
    )
}
