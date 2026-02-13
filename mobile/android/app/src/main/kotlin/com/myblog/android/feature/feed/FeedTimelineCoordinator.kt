package com.myblog.android.feature.feed

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.feed.model.FeedEvent
import com.myblog.android.feature.feed.model.FeedPage
import com.myblog.android.feature.feed.model.FeedState
import com.myblog.android.feature.feed.model.FeedStateMachine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class FeedTimelineCoordinator(
    private val feedRepository: FeedRepository,
) {
    private val mutableState = MutableStateFlow<FeedState>(FeedState.Loading)
    val state: StateFlow<FeedState> = mutableState.asStateFlow()

    private var currentPage: FeedPage? = null

    suspend fun refresh() {
        mutableState.value = FeedStateMachine.reduce(FeedEvent.StartLoading)

        when (val result = feedRepository.refreshFeed()) {
            is ApiResult.Success -> {
                currentPage = result.data
                mutableState.value = FeedStateMachine.reduce(FeedEvent.LoadSucceeded(result.data))
            }

            is ApiResult.Failure -> {
                mutableState.value = FeedStateMachine.reduce(FeedEvent.LoadFailed(result.message))
            }
        }
    }

    suspend fun loadNextPage() {
        val page = currentPage ?: return
        if (!PaginationPolicy.shouldLoadNext(page)) {
            return
        }

        when (val result = feedRepository.getFeed(page.nextCursor)) {
            is ApiResult.Success -> {
                val merged = PaginationPolicy.mergePages(page, result.data)
                currentPage = merged
                mutableState.value = FeedStateMachine.reduce(FeedEvent.LoadSucceeded(merged))
            }

            is ApiResult.Failure -> {
                mutableState.value = FeedStateMachine.reduce(FeedEvent.LoadFailed(result.message))
            }
        }
    }

    fun enterOffline(message: String) {
        mutableState.value = FeedStateMachine.reduce(FeedEvent.EnterOffline(message))
    }
}
