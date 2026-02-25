package com.myblog.android.feature.feed.model

sealed interface FeedEvent {
    data object StartLoading : FeedEvent
    data class LoadSucceeded(val page: FeedPage) : FeedEvent
    data class LoadFailed(val message: String) : FeedEvent
    data class EnterOffline(val message: String) : FeedEvent
}

object FeedStateMachine {
    fun reduce(event: FeedEvent): FeedState {
        return when (event) {
            FeedEvent.StartLoading -> FeedState.Loading
            is FeedEvent.LoadSucceeded -> toReadyOrEmpty(event.page)
            is FeedEvent.LoadFailed -> FeedState.Error(event.message)
            is FeedEvent.EnterOffline -> FeedState.Offline(event.message)
        }
    }

    private fun toReadyOrEmpty(page: FeedPage): FeedState {
        if (page.items.isEmpty()) {
            return FeedState.Empty
        }

        return FeedState.Ready(page)
    }
}
