package com.myblog.android.feature.auth.network

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.AuthRepository
import com.myblog.android.feature.auth.model.AuthTokens
import com.myblog.android.feature.auth.model.LoginRequest
import com.myblog.android.feature.auth.model.UserSession

class MobileContractAuthRepository(
    private val authApi: AuthApi,
) : AuthRepository {
    override suspend fun login(request: LoginRequest): ApiResult<AuthTokens> {
        return when (val result = authApi.login(LoginRequestDto(email = request.email, password = request.password))) {
            is ApiResult.Success -> ApiResult.Success(
                AuthTokens(
                    accessToken = result.data.accessToken,
                    refreshToken = result.data.refreshToken,
                ),
            )

            is ApiResult.Failure -> result
        }
    }

    override suspend fun refresh(refreshToken: String): ApiResult<AuthTokens> {
        return when (val result = authApi.refresh(RefreshRequestDto(refreshToken = refreshToken))) {
            is ApiResult.Success -> ApiResult.Success(
                AuthTokens(
                    accessToken = result.data.accessToken,
                    refreshToken = result.data.refreshToken,
                ),
            )

            is ApiResult.Failure -> result
        }
    }

    override suspend fun me(): ApiResult<UserSession> {
        return when (val result = authApi.me()) {
            is ApiResult.Success -> ApiResult.Success(
                UserSession(
                    userId = result.data.id,
                    email = result.data.email,
                    displayName = result.data.username,
                ),
            )

            is ApiResult.Failure -> result
        }
    }

    override suspend fun logout(): ApiResult<Unit> = authApi.logout()
}
