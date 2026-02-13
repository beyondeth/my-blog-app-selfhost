package com.myblog.android.feature.auth

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthTokens
import com.myblog.android.feature.auth.model.LoginRequest
import com.myblog.android.feature.auth.model.UserSession

interface AuthRepository {
    suspend fun login(request: LoginRequest): ApiResult<AuthTokens>
    suspend fun refresh(refreshToken: String): ApiResult<AuthTokens>
    suspend fun me(): ApiResult<UserSession>
    suspend fun logout(): ApiResult<Unit>
}
