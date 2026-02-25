package com.myblog.android.core.di

import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.network.HttpRequest
import com.myblog.android.core.network.HttpResponse
import com.myblog.android.core.network.HttpTransport
import com.myblog.android.feature.auth.model.UserSession
import com.myblog.android.feature.feed.model.FeedPage
import com.myblog.android.feature.settings.model.AppThemePreference
import com.myblog.android.feature.settings.model.SettingsSnapshot
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class AppDiFactoryTest {
    @Test
    fun createWithHttpAuthWiresTokenStoreIntoAuthApiAuthorizationHeader() = runTest {
        val transport = SequenceTransport(
            responses = listOf(
                ApiResult.Success(
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
            ),
        )

        val di = AppDiFactory.createWithHttpAuth(
            baseUrl = "https://api.myblog.app",
            transport = transport,
        )
        di.tokenStore().save("access-token", "refresh-token")

        val result = di.authRepository().me()

        val success = assertIs<ApiResult.Success<UserSession>>(result)
        assertEquals("user-1", success.data.userId)
        val request = transport.requests.single()
        assertEquals("Bearer access-token", request.headers["Authorization"])
    }

    @Test
    fun createWithHttpAuthProvidesHttpFeedRepositoryWithAuthorizedRequest() = runTest {
        val transport = SequenceTransport(
            responses = listOf(
                ApiResult.Success(
                    HttpResponse(
                        statusCode = 200,
                        body = """
                            {
                              "items": [],
                              "nextCursor": null,
                              "hasMore": false
                            }
                        """.trimIndent(),
                    ),
                ),
            ),
        )
        val di = AppDiFactory.createWithHttpAuth(
            baseUrl = "https://api.myblog.app",
            transport = transport,
        )
        di.tokenStore().save("access-token", "refresh-token")

        val result = di.feedRepository().refreshFeed()

        val success = assertIs<ApiResult.Success<FeedPage>>(result)
        assertEquals(false, success.data.hasMore)

        val request = transport.requests.single()
        assertEquals("https://api.myblog.app/api/v1/feed?sort=recent&limit=20", request.url)
        assertEquals("Bearer access-token", request.headers["Authorization"])
    }

    @Test
    fun createWithHttpAuthProvidesHttpSettingsRepositoryWithAuthorizedRequest() = runTest {
        val transport = SequenceTransport(
            responses = listOf(
                ApiResult.Success(
                    HttpResponse(
                        statusCode = 200,
                        body = """
                            {
                              "themePreference": "SYSTEM",
                              "notifications": {
                                "pushEnabled": true,
                                "marketingEnabled": false,
                                "communityReplyEnabled": true
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
        val di = AppDiFactory.createWithHttpAuth(
            baseUrl = "https://api.myblog.app",
            transport = transport,
        )
        di.tokenStore().save("access-token", "refresh-token")

        val result = di.settingsRepository().getSettings()

        val success = assertIs<ApiResult.Success<SettingsSnapshot>>(result)
        assertEquals(AppThemePreference.SYSTEM, success.data.themePreference)

        val request = transport.requests.single()
        assertEquals("https://api.myblog.app/api/v1/users/profile", request.url)
        assertEquals("Bearer access-token", request.headers["Authorization"])
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
