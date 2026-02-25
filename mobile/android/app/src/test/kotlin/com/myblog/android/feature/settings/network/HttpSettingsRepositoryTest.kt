package com.myblog.android.feature.settings.network

import com.myblog.android.core.auth.TokenStore
import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.network.AuthenticatedRequestExecutor
import com.myblog.android.core.network.HttpRequest
import com.myblog.android.core.network.HttpResponse
import com.myblog.android.core.network.HttpTransport
import com.myblog.android.feature.auth.AuthRefreshCoordinator
import com.myblog.android.feature.auth.AuthRepository
import com.myblog.android.feature.auth.model.AuthTokens
import com.myblog.android.feature.auth.model.LoginRequest
import com.myblog.android.feature.auth.model.UserSession
import com.myblog.android.feature.settings.model.AppThemePreference
import com.myblog.android.feature.settings.model.SettingsSnapshot
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class HttpSettingsRepositoryTest {
    @Test
    fun getSettingsMapsSnapshotAndSendsAuthHeader() = runTest {
        val transport = SequenceTransport(
            responses = listOf(
                ApiResult.Success(
                    HttpResponse(
                        statusCode = 200,
                        body = """
                            {
                              "themePreference": "DARK",
                              "notifications": {
                                "pushEnabled": true,
                                "marketingEnabled": false,
                                "communityReplyEnabled": true
                              },
                              "privacy": {
                                "profileVisible": false,
                                "activityVisible": true
                              }
                            }
                        """.trimIndent(),
                    ),
                ),
            ),
        )
        val tokenStore = TestTokenStore(access = "access-1", refresh = "refresh-1")
        val repository = HttpSettingsRepository(
            transport = transport,
            requestExecutor = AuthenticatedRequestExecutor(
                tokenStore = tokenStore,
                refreshCoordinator = AuthRefreshCoordinator(NoopAuthRepository(), tokenStore),
            ),
            baseUrl = "https://api.myblog.app",
        )

        val result = repository.getSettings()

        val success = assertIs<ApiResult.Success<SettingsSnapshot>>(result)
        assertEquals(AppThemePreference.DARK, success.data.themePreference)
        assertEquals(false, success.data.notifications.marketingEnabled)
        assertEquals(true, success.data.privacy.profileVisible)

        val request = transport.requests.single()
        assertEquals("GET", request.method)
        assertEquals("https://api.myblog.app/api/v1/users/profile", request.url)
        assertEquals("Bearer access-1", request.headers["Authorization"])
    }

    @Test
    fun updateThemeRetriesAfter401AndUsesRefreshedToken() = runTest {
        val transport = SequenceTransport(
            responses = listOf(
                ApiResult.Success(HttpResponse(statusCode = 401, body = "{\"message\":\"expired\"}")),
                ApiResult.Success(
                    HttpResponse(
                        statusCode = 200,
                        body = """
                            {
                              "themePreference": "LIGHT",
                              "notifications": {
                                "pushEnabled": true,
                                "marketingEnabled": true,
                                "communityReplyEnabled": false
                              },
                              "privacy": {
                                "profileVisible": true,
                                "activityVisible": true
                              }
                            }
                        """.trimIndent(),
                    ),
                ),
            ),
        )
        val tokenStore = TestTokenStore(access = "expired-access", refresh = "r1")
        val refreshRepository = RefreshOnlyAuthRepository()
        val repository = HttpSettingsRepository(
            transport = transport,
            requestExecutor = AuthenticatedRequestExecutor(
                tokenStore = tokenStore,
                refreshCoordinator = AuthRefreshCoordinator(refreshRepository, tokenStore),
            ),
            baseUrl = "https://api.myblog.app",
        )

        val result = repository.updateThemePreference(AppThemePreference.LIGHT)

        val success = assertIs<ApiResult.Success<SettingsSnapshot>>(result)
        assertEquals(AppThemePreference.LIGHT, success.data.themePreference)
        assertEquals(1, refreshRepository.refreshCalls)
        assertEquals("access-r1", tokenStore.access)
        assertEquals(2, transport.requests.size)
        assertEquals("Bearer expired-access", transport.requests[0].headers["Authorization"])
        assertEquals("Bearer access-r1", transport.requests[1].headers["Authorization"])
        assertEquals("GET", transport.requests[0].method)
        assertNull(transport.requests[0].body)
    }
}

private class SequenceTransport(
    private val responses: List<ApiResult<HttpResponse>>,
) : HttpTransport {
    val requests = mutableListOf<HttpRequest>()
    private var index = 0

    override suspend fun execute(request: HttpRequest): ApiResult<HttpResponse> {
        requests += request
        val response = responses.getOrElse(index) {
            ApiResult.Failure(code = null, message = "missing response for index=$index")
        }
        index += 1
        return response
    }
}

private class TestTokenStore(
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

private class NoopAuthRepository : AuthRepository {
    override suspend fun login(request: LoginRequest): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 500, message = "unused")
    }

    override suspend fun refresh(refreshToken: String): ApiResult<AuthTokens> {
        return ApiResult.Failure(code = 401, message = "unused")
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

private class RefreshOnlyAuthRepository : AuthRepository {
    var refreshCalls = 0

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
