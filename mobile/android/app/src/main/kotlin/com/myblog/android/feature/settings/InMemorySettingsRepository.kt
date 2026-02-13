package com.myblog.android.feature.settings

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.settings.model.AppThemePreference
import com.myblog.android.feature.settings.model.NotificationPreferences
import com.myblog.android.feature.settings.model.PrivacyPreferences
import com.myblog.android.feature.settings.model.SettingsSnapshot

class InMemorySettingsRepository(
    initialSnapshot: SettingsSnapshot = SettingsSnapshot(
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
    ),
) : SettingsRepository {
    private var snapshot = initialSnapshot

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
