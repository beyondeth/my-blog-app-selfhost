package com.myblog.android.feature.auth

import com.myblog.android.core.auth.TokenStore
import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthTokens
import com.myblog.android.feature.auth.model.LoginRequest
import com.myblog.android.feature.auth.model.UserSession
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class AuthRefreshCoordinatorTest {
    @Test
    fun refreshFromStoreReturnsFailureWhenTokenMissing() = runTest {
        val repository = FakeRefreshAuthRepository()
        val tokenStore = InMemoryRefreshTokenStore()
        val coordinator = AuthRefreshCoordinator(repository, tokenStore)

        val result = coordinator.refreshFromStore()

        val failure = assertIs<ApiResult.Failure>(result)
        assertEquals(401, failure.code)
    }

    @Test
    fun successfulRefreshPersistsLatestTokens() = runTest {
        val repository = FakeRefreshAuthRepository()
        val tokenStore = InMemoryRefreshTokenStore(refresh = "r1")
        val coordinator = AuthRefreshCoordinator(repository, tokenStore)

        val result = coordinator.refreshFromStore()

        val success = assertIs<ApiResult.Success<AuthTokens>>(result)
        assertEquals("access-r1", success.data.accessToken)
        assertEquals("refresh-r1", success.data.refreshToken)
        assertEquals("access-r1", tokenStore.access)
        assertEquals("refresh-r1", tokenStore.refresh)
    }

    @Test
    fun concurrentRefreshFromStoreUsesSingleInFlightRefresh() = runTest {
        val repository = FakeRefreshAuthRepository()
        val tokenStore = InMemoryRefreshTokenStore(refresh = "r1")
        val coordinator = AuthRefreshCoordinator(repository, tokenStore)

        val results = coroutineScope {
            List(10) {
                async { coordinator.refreshFromStore() }
            }.awaitAll()
        }

        assertEquals(1, repository.refreshCalls)
        assertEquals(10, results.size)
        assertEquals(10, results.count { it is ApiResult.Success })
    }
}

private class FakeRefreshAuthRepository : AuthRepository {
    var refreshCalls: Int = 0

    override suspend fun login(request: LoginRequest): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun refresh(refreshToken: String): ApiResult<AuthTokens> {
        refreshCalls += 1
        delay(25)
        return ApiResult.Success(
            AuthTokens(
                accessToken = "access-$refreshToken",
                refreshToken = "refresh-$refreshToken",
            ),
        )
    }

    override suspend fun oauthExchange(
        code: String,
        redirectUri: String,
        provider: String?,
    ): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 401, message = "unused")
    }

    override suspend fun me(): ApiResult<UserSession> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun logout(): ApiResult<Unit> = ApiResult.Success(Unit)
}

private class InMemoryRefreshTokenStore(
    var access: String? = null,
    var refresh: String? = null,
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
