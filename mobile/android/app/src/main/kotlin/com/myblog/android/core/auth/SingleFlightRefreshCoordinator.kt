package com.myblog.android.core.auth

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthTokens
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class SingleFlightRefreshCoordinator(
    private val refreshAction: suspend (refreshToken: String) -> ApiResult<AuthTokens>,
) : RefreshCoordinator {
    private val inFlightMutex = Mutex()
    private var inFlight: Deferred<ApiResult<AuthTokens>>? = null

    override suspend fun refreshIfNeeded(refreshToken: String): ApiResult<AuthTokens> = coroutineScope {
        val currentRequest = inFlightMutex.withLock {
            val existing = inFlight
            if (existing != null && existing.isActive) {
                existing
            } else {
                async(start = CoroutineStart.LAZY) {
                    refreshAction(refreshToken)
                }.also { newRequest ->
                    inFlight = newRequest
                }
            }
        }

        if (!currentRequest.isActive) {
            currentRequest.start()
        }

        try {
            currentRequest.await()
        } finally {
            inFlightMutex.withLock {
                if (inFlight === currentRequest && currentRequest.isCompleted) {
                    inFlight = null
                }
            }
        }
    }
}
