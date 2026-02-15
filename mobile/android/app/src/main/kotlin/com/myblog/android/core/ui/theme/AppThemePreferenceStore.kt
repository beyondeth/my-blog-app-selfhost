package com.myblog.android.core.ui.theme

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import com.myblog.android.feature.settings.model.AppThemePreference

private const val PREFS_NAME = "myblog-theme"
private const val PREF_THEME_PREFERENCE = "theme_preference"

object AppThemePreferenceStore {
    fun read(context: Context): AppThemePreference {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val preference = prefs.getString(PREF_THEME_PREFERENCE, AppThemePreference.SYSTEM.name)
        return parse(preference)
    }

    fun save(context: Context, preference: AppThemePreference) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_THEME_PREFERENCE, preference.name)
            .apply()
    }

    fun apply(preference: AppThemePreference) {
        AppCompatDelegate.setDefaultNightMode(
            when (preference) {
                AppThemePreference.LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
                AppThemePreference.DARK -> AppCompatDelegate.MODE_NIGHT_YES
                AppThemePreference.SYSTEM -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
            },
        )
    }

    private fun parse(value: String?): AppThemePreference {
        return runCatching { AppThemePreference.valueOf(value.orEmpty()) }
            .getOrElse { AppThemePreference.SYSTEM }
    }
}
