package com.myblog.android.core.di

import com.myblog.android.app.AppEntry
import com.myblog.android.app.model.AppShellState
import com.myblog.android.core.navigation.AppDestination
import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.network.AuthApi
import com.myblog.android.feature.auth.network.AuthUserDto
import com.myblog.android.feature.auth.network.LoginRequestDto
import com.myblog.android.feature.auth.network.LoginResponseDto
import com.myblog.android.feature.auth.network.MeResponseDto
import com.myblog.android.feature.auth.network.RefreshRequestDto
import com.myblog.android.feature.auth.network.RefreshResponseDto
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertSame

class DefaultAppDiTest {
    @Test
    fun providesStableSingletonInstances() {
        val di = DefaultAppDi(
            authApi = SuccessfulAuthApi(),
            initialDestination = AppDestination.Feed,
        )

        assertSame(di.authRepository(), di.authRepository())
        assertSame(di.tokenStore(), di.tokenStore())
        assertSame(di.refreshCoordinator(), di.refreshCoordinator())
        assertSame(di.feedRepository(), di.feedRepository())
        assertSame(di.settingsRepository(), di.settingsRepository())
        assertEquals(AppDestination.Feed, di.startDestination())
    }

    @Test
    fun appEntryBootstrapCoordinatorRestoresSessionToMain() = runTest {
        val di = DefaultAppDi(authApi = SuccessfulAuthApi())
        val bootstrapCoordinator = AppEntry.bootstrapCoordinator(di)

        bootstrapCoordinator.bootstrap()

        val main = assertIs<AppShellState.Main>(bootstrapCoordinator.shellState())
        assertEquals(AppDestination.Feed, main.selectedTab)
        assertEquals("user-1", main.authState.session.userId)
    }
}

private class SuccessfulAuthApi : AuthApi {
    override suspend fun login(request: LoginRequestDto): ApiResult<LoginResponseDto> {
        return ApiResult.Success(
            LoginResponseDto(
                accessToken = "access-token",
                refreshToken = "refresh-token",
                user = AuthUserDto(
                    id = "user-1",
                    username = "MyBlog User",
                    email = "user@myblog.app",
                ),
            ),
        )
    }

    override suspend fun refresh(request: RefreshRequestDto): ApiResult<RefreshResponseDto> {
        return ApiResult.Success(
            RefreshResponseDto(
                accessToken = "access-token-2",
                refreshToken = "refresh-token-2",
            ),
        )
    }

    override suspend fun me(): ApiResult<MeResponseDto> {
        return ApiResult.Success(
            MeResponseDto(
                id = "user-1",
                username = "MyBlog User",
                email = "user@myblog.app",
            ),
        )
    }

    override suspend fun logout(): ApiResult<Unit> = ApiResult.Success(Unit)
}
