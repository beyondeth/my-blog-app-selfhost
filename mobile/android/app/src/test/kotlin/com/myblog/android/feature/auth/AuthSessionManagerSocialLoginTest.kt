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

class AuthSessionManagerSocialLoginTest {
    @Test
    fun loginWithOAuthCodeStoresTokensAndRestoresSession() = runTest {
        val tokenStore = TestTokenStore()
        val repository = SocialSuccessAuthRepository()
        val manager = AuthSessionManager(
            authRepository = repository,
            tokenStore = tokenStore,
        )

        manager.loginWithOAuthCode(
            code = "oauth-code",
            redirectUri = "codebase://auth/callback",
            provider = "google",
        )

        assertEquals("access-social", tokenStore.access)
        assertEquals("refresh-social", tokenStore.refresh)
        val loggedIn = assertIs<AuthState.LoggedIn>(manager.state.value)
        assertEquals("social-user", loggedIn.session.userId)
    }

    @Test
    fun loginWithOAuthCodeSetsExpiredStateOnFailure() = runTest {
        val tokenStore = TestTokenStore()
        val repository = SocialFailureAuthRepository()
        val manager = AuthSessionManager(
            authRepository = repository,
            tokenStore = tokenStore,
        )

        manager.loginWithOAuthCode(
            code = "oauth-code",
            redirectUri = "codebase://auth/callback",
            provider = "github",
        )

        val expired = assertIs<AuthState.Expired>(manager.state.value)
        assertEquals("invalid oauth code", expired.reason)
    }
}

private class SocialSuccessAuthRepository : AuthRepository {
    override suspend fun login(request: LoginRequest): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun refresh(refreshToken: String): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun oauthExchange(
        code: String,
        redirectUri: String,
        provider: String?,
    ): ApiResult<AuthTokens> {
        return ApiResult.Success(
            AuthTokens(
                accessToken = "access-social",
                refreshToken = "refresh-social",
            ),
        )
    }

    override suspend fun me(): ApiResult<UserSession> {
        return ApiResult.Success(
            UserSession(
                userId = "social-user",
                email = "social@codebase.blog",
                displayName = "social",
                username = "social",
                profileImageUrl = null,
            ),
        )
    }

    override suspend fun logout(): ApiResult<Unit> = ApiResult.Success(Unit)
}

private class SocialFailureAuthRepository : AuthRepository {
    override suspend fun login(request: LoginRequest): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun refresh(refreshToken: String): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun oauthExchange(
        code: String,
        redirectUri: String,
        provider: String?,
    ): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 401, message = "invalid oauth code")
    }

    override suspend fun me(): ApiResult<UserSession> {
        return ApiResult.Failure(code = 401, message = "unused")
    }

    override suspend fun logout(): ApiResult<Unit> = ApiResult.Success(Unit)
}

private class TestTokenStore : TokenStore {
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
