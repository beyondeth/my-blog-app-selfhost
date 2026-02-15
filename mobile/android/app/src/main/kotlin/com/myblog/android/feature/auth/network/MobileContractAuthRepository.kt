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
        val result = authApi.login(LoginRequestDto(email = request.email, password = request.password))
        return when (result) {
            is ApiResult.Success -> ApiResult.Success(
                AuthTokens(
                    accessToken = result.data.accessToken,
                    refreshToken = result.data.refreshToken,
                ),
            )

            is ApiResult.Failure -> ApiResult.Failure(result.code, result.message)
        }
    }

    override suspend fun refresh(refreshToken: String): ApiResult<AuthTokens> {
        val result = authApi.refresh(RefreshRequestDto(refreshToken = refreshToken))
        return when (result) {
            is ApiResult.Success -> ApiResult.Success(
                AuthTokens(
                    accessToken = result.data.accessToken,
                    refreshToken = result.data.refreshToken,
                ),
            )

            is ApiResult.Failure -> ApiResult.Failure(result.code, result.message)
        }
    }

    override suspend fun me(): ApiResult<UserSession> {
        val result = authApi.me()
        return when (result) {
            is ApiResult.Success -> ApiResult.Success(
                UserSession(
                    userId = result.data.id,
                    email = result.data.email,
                    displayName = result.data.username,
                    username = result.data.username,
                    profileImageUrl = result.data.profileImage,
                ),
            )

            is ApiResult.Failure -> ApiResult.Failure(result.code, result.message)
        }
    }

    override suspend fun logout(): ApiResult<Unit> = authApi.logout()
}
