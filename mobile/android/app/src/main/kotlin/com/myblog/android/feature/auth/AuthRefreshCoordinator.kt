package com.myblog.android.feature.auth

import com.myblog.android.core.auth.RefreshCoordinator
import com.myblog.android.core.auth.SingleFlightRefreshCoordinator
import com.myblog.android.core.auth.TokenStore
import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthTokens

class AuthRefreshCoordinator(
    private val authRepository: AuthRepository,
    private val tokenStore: TokenStore,
) : RefreshCoordinator {
    private val singleFlightCoordinator = SingleFlightRefreshCoordinator { refreshToken ->
        val result = authRepository.refresh(refreshToken)
        if (result is ApiResult.Success) {
            tokenStore.save(result.data.accessToken, result.data.refreshToken)
        }
        result
    }

    override suspend fun refreshIfNeeded(refreshToken: String): ApiResult<AuthTokens> {
        return singleFlightCoordinator.refreshIfNeeded(refreshToken)
    }

    suspend fun refreshFromStore(): ApiResult<AuthTokens> {
        val refreshToken = tokenStore.readRefreshToken()
            ?: return ApiResult.Failure(code = 401, message = "refresh token unavailable")

        return refreshIfNeeded(refreshToken)
    }
}
