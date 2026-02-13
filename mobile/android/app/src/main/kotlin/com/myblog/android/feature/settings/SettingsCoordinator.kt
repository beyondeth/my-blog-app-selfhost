package com.myblog.android.feature.settings

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.settings.model.AppThemePreference
import com.myblog.android.feature.settings.model.NotificationPreferences
import com.myblog.android.feature.settings.model.PrivacyPreferences
import com.myblog.android.feature.settings.model.SettingsSnapshot
import com.myblog.android.feature.settings.model.SettingsState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class SettingsCoordinator(
    private val settingsRepository: SettingsRepository,
) {
    private val mutableState = MutableStateFlow<SettingsState>(SettingsState.Loading)
    val state: StateFlow<SettingsState> = mutableState.asStateFlow()

    suspend fun load() {
        mutableState.value = SettingsState.Loading
        mutableState.value = settingsRepository.getSettings().toSettingsState()
    }

    suspend fun updateTheme(themePreference: AppThemePreference) {
        mutableState.value = settingsRepository
            .updateThemePreference(themePreference)
            .toSettingsState()
    }

    suspend fun updateNotifications(preferences: NotificationPreferences) {
        mutableState.value = settingsRepository
            .updateNotificationPreferences(preferences)
            .toSettingsState()
    }

    suspend fun updatePrivacy(preferences: PrivacyPreferences) {
        mutableState.value = settingsRepository
            .updatePrivacyPreferences(preferences)
            .toSettingsState()
    }

    private fun ApiResult<SettingsSnapshot>.toSettingsState(): SettingsState {
        return when (this) {
            is ApiResult.Success -> SettingsState.Ready(data)
            is ApiResult.Failure -> SettingsState.Error(message)
        }
    }
}
