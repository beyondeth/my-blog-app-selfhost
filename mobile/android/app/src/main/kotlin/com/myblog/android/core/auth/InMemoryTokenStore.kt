package com.myblog.android.core.auth

class InMemoryTokenStore : TokenStore {
    private var accessToken: String? = null
    private var refreshToken: String? = null

    override suspend fun save(accessToken: String, refreshToken: String) {
        this.accessToken = accessToken
        this.refreshToken = refreshToken
    }

    override suspend fun readAccessToken(): String? = accessToken

    override suspend fun readRefreshToken(): String? = refreshToken

    override suspend fun clear() {
        accessToken = null
        refreshToken = null
    }
}
