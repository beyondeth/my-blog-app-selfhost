package com.myblog.android.feature.feed.model

data class FeedItem(
    val postId: String,
    val title: String,
    val excerpt: String,
    val authorName: String,
    val liked: Boolean,
    val likeCount: Int,
)

data class FeedPage(
    val items: List<FeedItem>,
    val nextCursor: String?,
    val hasMore: Boolean,
)

sealed interface FeedState {
    data object Loading : FeedState
    data class Ready(val page: FeedPage) : FeedState
    data object Empty : FeedState
    data class Error(val message: String) : FeedState
    data class Offline(val message: String) : FeedState
}
