package com.myblog.android.feature.settings

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.settings.model.AppThemePreference
import com.myblog.android.feature.settings.model.NotificationPreferences
import com.myblog.android.feature.settings.model.PrivacyPreferences
import com.myblog.android.feature.settings.model.SettingsSnapshot

interface SettingsRepository {
    suspend fun getSettings(): ApiResult<SettingsSnapshot>
    suspend fun updateThemePreference(themePreference: AppThemePreference): ApiResult<SettingsSnapshot>
    suspend fun updateNotificationPreferences(preferences: NotificationPreferences): ApiResult<SettingsSnapshot>
    suspend fun updatePrivacyPreferences(preferences: PrivacyPreferences): ApiResult<SettingsSnapshot>
}
