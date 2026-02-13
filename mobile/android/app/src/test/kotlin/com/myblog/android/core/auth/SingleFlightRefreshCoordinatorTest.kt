package com.myblog.android.core.auth

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthTokens
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SingleFlightRefreshCoordinatorTest {
    @Test
    fun concurrentCallsShareSingleRefreshRequest() = runTest {
        var refreshCalls = 0
        val coordinator = SingleFlightRefreshCoordinator { refreshToken ->
            refreshCalls += 1
            delay(50)
            ApiResult.Success(
                AuthTokens(
                    accessToken = "access-$refreshToken",
                    refreshToken = "refresh-$refreshToken",
                ),
            )
        }

        val results = coroutineScope {
            List(12) {
                async { coordinator.refreshIfNeeded("r1") }
            }.awaitAll()
        }

        assertEquals(1, refreshCalls)
        assertTrue(results.all { it is ApiResult.Success })
    }

    @Test
    fun failedRefreshAllowsNextAttempt() = runTest {
        var refreshCalls = 0
        val coordinator = SingleFlightRefreshCoordinator {
            refreshCalls += 1
            if (refreshCalls == 1) {
                ApiResult.Failure(code = 401, message = "expired")
            } else {
                ApiResult.Success(
                    AuthTokens(
                        accessToken = "access-2",
                        refreshToken = "refresh-2",
                    ),
                )
            }
        }

        val first = coordinator.refreshIfNeeded("r1")
        val second = coordinator.refreshIfNeeded("r1")

        assertTrue(first is ApiResult.Failure)
        assertTrue(second is ApiResult.Success)
        assertEquals(2, refreshCalls)
    }
}
