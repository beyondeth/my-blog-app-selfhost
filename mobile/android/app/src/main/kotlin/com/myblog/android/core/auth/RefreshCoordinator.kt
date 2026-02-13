package com.myblog.android.core.auth

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthTokens

interface RefreshCoordinator {
    suspend fun refreshIfNeeded(refreshToken: String): ApiResult<AuthTokens>
}
