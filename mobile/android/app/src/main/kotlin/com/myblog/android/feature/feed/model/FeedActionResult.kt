package com.myblog.android.feature.feed.model

data class FeedActionResult(
    val postId: String,
    val liked: Boolean,
    val likeCount: Int?,
    val userVote: String?,
)
