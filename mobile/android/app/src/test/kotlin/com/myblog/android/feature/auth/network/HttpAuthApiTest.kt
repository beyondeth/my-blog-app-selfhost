package com.myblog.android.feature.auth.network

import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.network.HttpRequest
import com.myblog.android.core.network.HttpResponse
import com.myblog.android.core.network.HttpTransport
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class HttpAuthApiTest {
    @Test
    fun loginSendsContractPathAndMapsResponse() = runTest {
        val transport = RecordingTransport(
            result = ApiResult.Success(
                HttpResponse(
                    statusCode = 200,
                    body = """
                        {
                          "accessToken": "access-token",
                          "refreshToken": "refresh-token",
                          "user": {
                            "id": "user-1",
                            "username": "MyBlog",
                            "email": "user@myblog.app",
                            "role": "user"
                          }
                        }
                    """.trimIndent(),
                ),
            ),
        )
        val authApi = HttpAuthApi(
            transport = transport,
            baseUrl = "https://api.myblog.app",
        )

        val result = authApi.login(
            LoginRequestDto(
                email = "user@myblog.app",
                password = "password-1",
            ),
        )

        val success = assertIs<ApiResult.Success<LoginResponseDto>>(result)
        assertEquals("access-token", success.data.accessToken)
        assertEquals("refresh-token", success.data.refreshToken)
        assertEquals("user-1", success.data.user.id)

        val request = transport.requests.single()
        assertEquals("POST", request.method)
        assertEquals("https://api.myblog.app/api/v1/mobile/auth/login", request.url)
        assertEquals("application/json", request.headers["Content-Type"])
        assertNull(request.headers["Authorization"])

        val body = request.body
        assertNotNull(body)
        assertEquals(true, body.contains("\"email\":\"user@myblog.app\""))
        assertEquals(true, body.contains("\"password\":\"password-1\""))
    }

    @Test
    fun loginParsesTokenFromHeadersAndNestedPayload() = runTest {
        val transport = RecordingTransport(
            result = ApiResult.Success(
                HttpResponse(
                    statusCode = 200,
                    body = """
                        {
                          "data": {
                            "user": {
                              "id": "user-2",
                              "username": "NestedUser",
                              "email": "nested@myblog.app"
                            },
                            "tokens": {
                              "not_used_access": "ignore"
                            }
                          }
                        }
                    """.trimIndent(),
                    headers = mapOf(
                        "Set-Cookie" to listOf(
                            "access_token=nested-access; Path=/; HttpOnly",
                            "refresh_token=nested-refresh; Path=/; HttpOnly",
                        ),
                    ),
                ),
            ),
        )
        val authApi = HttpAuthApi(
            transport = transport,
            baseUrl = "https://api.myblog.app",
        )

        val result = authApi.login(
            LoginRequestDto(
                email = "nested@myblog.app",
                password = "password-2",
            ),
        )

        val success = assertIs<ApiResult.Success<LoginResponseDto>>(result)
        assertEquals("nested-access", success.data.accessToken)
        assertEquals("nested-refresh", success.data.refreshToken)
        assertEquals("user-2", success.data.user.id)
        assertEquals("NestedUser", success.data.user.username)
        assertEquals("nested@myblog.app", success.data.user.email)
    }

    @Test
    fun meAddsBearerHeaderFromTokenProvider() = runTest {
        val transport = RecordingTransport(
            result = ApiResult.Success(
                HttpResponse(
                    statusCode = 200,
                    body = """
                        {
                          "id": "user-1",
                          "username": "MyBlog",
                          "email": "user@myblog.app"
                        }
                    """.trimIndent(),
                ),
            ),
        )
        val authApi = HttpAuthApi(
            transport = transport,
            baseUrl = "https://api.myblog.app/api/v1",
            accessTokenProvider = { "access-from-store" },
        )

        val result = authApi.me()

        val success = assertIs<ApiResult.Success<MeResponseDto>>(result)
        assertEquals("MyBlog", success.data.username)

        val request = transport.requests.single()
        assertEquals("GET", request.method)
        assertEquals("https://api.myblog.app/api/v1/mobile/auth/me", request.url)
        assertEquals("Bearer access-from-store", request.headers["Authorization"])
    }

    @Test
    fun refreshMapsErrorResponseToFailureMessage() = runTest {
        val transport = RecordingTransport(
            result = ApiResult.Success(
                HttpResponse(
                    statusCode = 401,
                    body = """
                        {
                          "message": "refresh expired"
                        }
                    """.trimIndent(),
                ),
            ),
        )
        val authApi = HttpAuthApi(
            transport = transport,
            baseUrl = "https://api.myblog.app",
        )

        val result = authApi.refresh(RefreshRequestDto(refreshToken = "stale-refresh"))

        val failure = assertIs<ApiResult.Failure>(result)
        assertEquals(401, failure.code)
        assertEquals("refresh expired", failure.message)
    }

    @Test
    fun oauthExchangeIncludesProviderAsValidJsonProperty() = runTest {
        val transport = RecordingTransport(
            result = ApiResult.Success(
                HttpResponse(
                    statusCode = 200,
                    body = """
                        {
                          "accessToken": "oauth-access",
                          "refreshToken": "oauth-refresh",
                          "user": {
                            "id": "user-oauth",
                            "username": "OAuthUser",
                            "email": "oauth@myblog.app"
                          }
                        }
                    """.trimIndent(),
                ),
            ),
        )
        val authApi = HttpAuthApi(
            transport = transport,
            baseUrl = "https://api.myblog.app",
        )

        val result = authApi.oauthExchange(
            OAuthExchangeRequestDto(
                code = "oauth-code-1",
                redirectUri = "myblogapp://oauth/callback",
                provider = "google",
            ),
        )

        val success = assertIs<ApiResult.Success<LoginResponseDto>>(result)
        assertEquals("oauth-access", success.data.accessToken)
        assertEquals("oauth-refresh", success.data.refreshToken)

        val request = transport.requests.single()
        assertEquals(
            """{"code":"oauth-code-1","redirectUri":"myblogapp://oauth/callback","provider":"google"}""",
            request.body,
        )
    }

    @Test
    fun logoutUsesAuthHeaderAndSucceedsOn2xx() = runTest {
        val transport = RecordingTransport(
            result = ApiResult.Success(
                HttpResponse(
                    statusCode = 200,
                    body = "",
                ),
            ),
        )
        val authApi = HttpAuthApi(
            transport = transport,
            baseUrl = "https://api.myblog.app",
            accessTokenProvider = { "access-1" },
        )

        val result = authApi.logout()

        assertIs<ApiResult.Success<Unit>>(result)
        val request = transport.requests.single()
        assertEquals("POST", request.method)
        assertEquals("https://api.myblog.app/api/v1/mobile/auth/logout", request.url)
        assertEquals("Bearer access-1", request.headers["Authorization"])
    }
}

private class RecordingTransport(
    private val result: ApiResult<HttpResponse>,
) : HttpTransport {
    val requests = mutableListOf<HttpRequest>()

    override suspend fun execute(request: HttpRequest): ApiResult<HttpResponse> {
        requests += request
        return result
    }
}
