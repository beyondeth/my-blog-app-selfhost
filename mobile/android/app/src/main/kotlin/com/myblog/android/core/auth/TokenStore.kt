package com.myblog.android.core.auth

interface TokenStore {
    suspend fun save(accessToken: String, refreshToken: String)
    suspend fun readAccessToken(): String?
    suspend fun readRefreshToken(): String?
    suspend fun clear()
}
