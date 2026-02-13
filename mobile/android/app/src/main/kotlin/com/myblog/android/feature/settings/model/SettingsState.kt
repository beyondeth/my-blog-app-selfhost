package com.myblog.android.feature.settings.model

sealed interface SettingsState {
    data object Loading : SettingsState
    data class Ready(val snapshot: SettingsSnapshot) : SettingsState
    data class Error(val message: String) : SettingsState
}
