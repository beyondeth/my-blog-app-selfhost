package com.myblog.android.feature.auth

import com.myblog.android.core.auth.TokenStore
import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthState
import com.myblog.android.feature.auth.model.AuthTokens
import com.myblog.android.feature.auth.model.LoginRequest
import com.myblog.android.feature.auth.model.UserSession
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class AuthSessionManagerTest {
    @Test
    fun loginStoresTokenAndMovesToLoggedIn() = runTest {
        val repository = FakeAuthRepository(
            loginResult = ApiResult.Success(
                AuthTokens(
                    accessToken = "access-token",
                    refreshToken = "refresh-token",
                ),
            ),
            meResult = ApiResult.Success(sampleSession()),
            refreshResult = ApiResult.Failure(code = 500, message = "unused"),
            logoutResult = ApiResult.Success(Unit),
        )
        val tokenStore = InMemoryTokenStore()
        val manager = AuthSessionManager(repository, tokenStore)

        manager.login(LoginRequest(email = "user@myblog.app", password = "pw"))

        val loggedIn = assertIs<AuthState.LoggedIn>(manager.state.value)
        assertEquals("user-1", loggedIn.session.userId)
        assertEquals("access-token", tokenStore.access)
        assertEquals("refresh-token", tokenStore.refresh)
    }

    @Test
    fun loginFailureMovesToExpiredWithoutSavingToken() = runTest {
        val repository = FakeAuthRepository(
            loginResult = ApiResult.Failure(code = 401, message = "invalid credentials"),
            meResult = ApiResult.Success(sampleSession()),
            refreshResult = ApiResult.Failure(code = 500, message = "unused"),
            logoutResult = ApiResult.Success(Unit),
        )
        val tokenStore = InMemoryTokenStore()
        val manager = AuthSessionManager(repository, tokenStore)

        manager.login(LoginRequest(email = "user@myblog.app", password = "bad"))

        val expired = assertIs<AuthState.Expired>(manager.state.value)
        assertEquals("invalid credentials", expired.reason)
        assertNull(tokenStore.access)
        assertNull(tokenStore.refresh)
    }

    @Test
    fun restoreSuccessMovesToLoggedIn() = runTest {
        val repository = FakeAuthRepository(
            loginResult = ApiResult.Failure(code = 500, message = "unused"),
            meResult = ApiResult.Success(sampleSession()),
            refreshResult = ApiResult.Failure(code = 500, message = "unused"),
            logoutResult = ApiResult.Success(Unit),
        )
        val manager = AuthSessionManager(repository, InMemoryTokenStore())

        manager.startRestore()

        val loggedIn = assertIs<AuthState.LoggedIn>(manager.state.value)
        assertEquals("user-1", loggedIn.session.userId)
    }

    @Test
    fun restoreFailureMovesToExpired() = runTest {
        val repository = FakeAuthRepository(
            loginResult = ApiResult.Failure(code = 500, message = "unused"),
            meResult = ApiResult.Failure(code = 401, message = "session expired"),
            refreshResult = ApiResult.Failure(code = 500, message = "unused"),
            logoutResult = ApiResult.Success(Unit),
        )
        val manager = AuthSessionManager(repository, InMemoryTokenStore())

        manager.startRestore()

        val expired = assertIs<AuthState.Expired>(manager.state.value)
        assertEquals("session expired", expired.reason)
    }

    @Test
    fun logoutClearsTokenAndMovesToLoggedOut() = runTest {
        val repository = FakeAuthRepository(
            loginResult = ApiResult.Success(
                AuthTokens(
                    accessToken = "access-token",
                    refreshToken = "refresh-token",
                ),
            ),
            meResult = ApiResult.Success(sampleSession()),
            refreshResult = ApiResult.Failure(code = 500, message = "unused"),
            logoutResult = ApiResult.Success(Unit),
        )
        val tokenStore = InMemoryTokenStore()
        val manager = AuthSessionManager(repository, tokenStore)

        manager.login(LoginRequest(email = "user@myblog.app", password = "pw"))
        manager.logout()

        assertIs<AuthState.LoggedOut>(manager.state.value)
        assertNull(tokenStore.access)
        assertNull(tokenStore.refresh)
    }
}

private class FakeAuthRepository(
    private val loginResult: ApiResult<AuthTokens>,
    private val meResult: ApiResult<UserSession>,
    private val refreshResult: ApiResult<AuthTokens>,
    private val logoutResult: ApiResult<Unit>,
) : AuthRepository {

    var refreshCalls: Int = 0

    override suspend fun login(request: LoginRequest): ApiResult<AuthTokens> {
        return loginResult
    }

    override suspend fun refresh(refreshToken: String): ApiResult<AuthTokens> {
        refreshCalls += 1
        return refreshResult
    }

    override suspend fun me(): ApiResult<UserSession> = meResult

    override suspend fun logout(): ApiResult<Unit> = logoutResult
}

private class InMemoryTokenStore : TokenStore {
    var access: String? = null
    var refresh: String? = null

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

private fun sampleSession(): UserSession {
    return UserSession(
        userId = "user-1",
        email = "user@myblog.app",
        displayName = "MyBlog User",
    )
}
