package com.myblog.android.core.network

import com.myblog.android.core.auth.RefreshCoordinator
import com.myblog.android.core.auth.TokenStore

class AuthenticatedRequestExecutor(
    private val tokenStore: TokenStore,
    private val refreshCoordinator: RefreshCoordinator,
) {
    suspend fun <T> execute(
        request: suspend (accessToken: String?) -> ApiResult<T>,
    ): ApiResult<T> {
        val firstResponse = request(tokenStore.readAccessToken())
        if (firstResponse !is ApiResult.Failure || firstResponse.code != 401) {
            return firstResponse
        }

        val refreshToken = tokenStore.readRefreshToken()
            ?: return ApiResult.Failure(code = 401, message = "refresh token unavailable")

        return when (val refresh = refreshCoordinator.refreshIfNeeded(refreshToken)) {
            is ApiResult.Success -> request(refresh.data.accessToken)
            is ApiResult.Failure -> ApiResult.Failure(refresh.code, refresh.message)
        }
    }
}
