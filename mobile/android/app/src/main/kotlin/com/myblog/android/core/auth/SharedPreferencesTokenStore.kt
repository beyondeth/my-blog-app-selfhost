package com.myblog.android.core.auth

import android.content.Context

class SharedPreferencesTokenStore(
    context: Context,
) : TokenStore {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override suspend fun save(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .apply()
    }

    override suspend fun readAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)

    override suspend fun readRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    override suspend fun clear() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .apply()
    }

    companion object {
        private const val PREFS_NAME = "myblog_auth_tokens"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
    }
}
