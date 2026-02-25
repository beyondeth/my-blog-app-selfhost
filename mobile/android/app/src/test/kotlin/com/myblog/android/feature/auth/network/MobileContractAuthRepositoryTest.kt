package com.myblog.android.feature.auth.network

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthTokens
import com.myblog.android.feature.auth.model.LoginRequest
import com.myblog.android.feature.auth.model.UserSession
import com.myblog.android.feature.auth.network.OAuthExchangeRequestDto
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class MobileContractAuthRepositoryTest {
    @Test
    fun loginMapsDtoToDomainTokens() = runTest {
        val authApi = FakeAuthApi(
            loginResult = ApiResult.Success(
                LoginResponseDto(
                    accessToken = "a1",
                    refreshToken = "r1",
                    user = AuthUserDto(
                        id = "u1",
                        username = "tester",
                        email = "u@myblog.app",
                        profileImage = null,
                    ),
                ),
            ),
            refreshResult = ApiResult.Failure(code = 500, message = "unused"),
            meResult = ApiResult.Failure(code = 500, message = "unused"),
            logoutResult = ApiResult.Success(Unit),
        )
        val repository = MobileContractAuthRepository(authApi)

        val result = repository.login(LoginRequest(email = "u@myblog.app", password = "pw"))

        val success = assertIs<ApiResult.Success<AuthTokens>>(result)
        val tokens = success.data
        assertEquals("a1", tokens.accessToken)
        assertEquals("r1", tokens.refreshToken)
    }

    @Test
    fun meMapsDtoToUserSession() = runTest {
        val authApi = FakeAuthApi(
            loginResult = ApiResult.Failure(code = 500, message = "unused"),
            refreshResult = ApiResult.Failure(code = 500, message = "unused"),
            meResult = ApiResult.Success(
                MeResponseDto(
                    id = "u1",
                    username = "my-user",
                    email = "u@myblog.app",
                    profileImage = null,
                ),
            ),
            logoutResult = ApiResult.Success(Unit),
        )
        val repository = MobileContractAuthRepository(authApi)

        val result = repository.me()

        val success = assertIs<ApiResult.Success<UserSession>>(result)
        val session = success.data
        assertEquals("u1", session.userId)
        assertEquals("my-user", session.displayName)
        assertEquals("u@myblog.app", session.email)
    }

    @Test
    fun refreshFailurePropagatesApiFailure() = runTest {
        val authApi = FakeAuthApi(
            loginResult = ApiResult.Failure(code = 500, message = "unused"),
            refreshResult = ApiResult.Failure(code = 401, message = "expired"),
            meResult = ApiResult.Failure(code = 500, message = "unused"),
            logoutResult = ApiResult.Success(Unit),
        )
        val repository = MobileContractAuthRepository(authApi)

        val result = repository.refresh("r1")

        val failure = assertIs<ApiResult.Failure>(result)
        assertEquals(401, failure.code)
        assertEquals("expired", failure.message)
    }
}

private class FakeAuthApi(
    private val loginResult: ApiResult<LoginResponseDto>,
    private val refreshResult: ApiResult<RefreshResponseDto>,
    private val meResult: ApiResult<MeResponseDto>,
    private val logoutResult: ApiResult<Unit>,
) : AuthApi {
    override suspend fun login(request: LoginRequestDto): ApiResult<LoginResponseDto> = loginResult

    override suspend fun refresh(request: RefreshRequestDto): ApiResult<RefreshResponseDto> = refreshResult

    override suspend fun oauthExchange(request: OAuthExchangeRequestDto): ApiResult<LoginResponseDto> = loginResult

    override suspend fun me(): ApiResult<MeResponseDto> = meResult

    override suspend fun logout(): ApiResult<Unit> = logoutResult
}
