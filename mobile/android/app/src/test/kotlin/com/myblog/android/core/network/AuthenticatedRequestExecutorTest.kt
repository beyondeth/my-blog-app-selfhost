package com.myblog.android.core.network

import com.myblog.android.core.auth.TokenStore
import com.myblog.android.feature.auth.AuthRefreshCoordinator
import com.myblog.android.feature.auth.AuthRepository
import com.myblog.android.feature.auth.model.AuthTokens
import com.myblog.android.feature.auth.model.LoginRequest
import com.myblog.android.feature.auth.model.UserSession
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class AuthenticatedRequestExecutorTest {
    @Test
    fun retriesRequestAfter401WithRefreshedToken() = runTest {
        val tokenStore = ExecutorTokenStore(access = "expired-access", refresh = "r1")
        val repository = RefreshOnlyAuthRepository()
        val refreshCoordinator = AuthRefreshCoordinator(repository, tokenStore)
        val executor = AuthenticatedRequestExecutor(tokenStore, refreshCoordinator)
        var requestCalls = 0

        val result = executor.execute { accessToken ->
            requestCalls += 1
            if (accessToken == "expired-access") {
                ApiResult.Failure(code = 401, message = "expired")
            } else {
                ApiResult.Success("ok")
            }
        }

        val success = assertIs<ApiResult.Success<String>>(result)
        assertEquals("ok", success.data)
        assertEquals(2, requestCalls)
        assertEquals(1, repository.refreshCalls)
        assertEquals("access-r1", tokenStore.access)
    }

    @Test
    fun returnsRefreshFailureWhenRetryCannotRefresh() = runTest {
        val tokenStore = ExecutorTokenStore(access = "expired-access", refresh = null)
        val repository = RefreshOnlyAuthRepository()
        val refreshCoordinator = AuthRefreshCoordinator(repository, tokenStore)
        val executor = AuthenticatedRequestExecutor(tokenStore, refreshCoordinator)

        val result = executor.execute {
            ApiResult.Failure(code = 401, message = "expired")
        }

        val failure = assertIs<ApiResult.Failure>(result)
        assertEquals(401, failure.code)
        assertEquals("refresh token unavailable", failure.message)
        assertEquals(0, repository.refreshCalls)
    }
}

private class RefreshOnlyAuthRepository : AuthRepository {
    var refreshCalls: Int = 0

    override suspend fun login(request: LoginRequest): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun refresh(refreshToken: String): ApiResult<AuthTokens> {
        refreshCalls += 1
        return ApiResult.Success(
            AuthTokens(
                accessToken = "access-$refreshToken",
                refreshToken = "refresh-$refreshToken",
            ),
        )
    }

    override suspend fun me(): ApiResult<UserSession> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun logout(): ApiResult<Unit> = ApiResult.Success(Unit)
}

private class ExecutorTokenStore(
    var access: String?,
    var refresh: String?,
) : TokenStore {
    override suspend fun save(accessToken: String, refreshToken: String) {
        access = accessToken
        refresh = refreshToken
    }

    override suspend fun readAccessToken(): String? = access

    override suspend fun readRefreshToken(): String? = refresh

    override suspend fun clear() {
        access = null
        refresh = null
    }
}
