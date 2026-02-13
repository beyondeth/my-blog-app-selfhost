package com.myblog.android.feature.settings.model

enum class AppThemePreference {
    SYSTEM,
    LIGHT,
    DARK,
}

data class NotificationPreferences(
    val pushEnabled: Boolean,
    val marketingEnabled: Boolean,
    val communityReplyEnabled: Boolean,
)

data class PrivacyPreferences(
    val profileVisible: Boolean,
    val activityVisible: Boolean,
)

data class SettingsSnapshot(
    val themePreference: AppThemePreference,
    val notifications: NotificationPreferences,
    val privacy: PrivacyPreferences,
)
