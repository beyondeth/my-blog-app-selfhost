package com.myblog.android.feature.feed

import com.myblog.android.core.network.ApiResult

interface LikeActionHandler {
    suspend fun toggleLike(postId: String): ApiResult<Unit>
}

interface CommentActionHandler {
    suspend fun openComments(postId: String): ApiResult<Unit>
}

interface ShareActionHandler {
    suspend fun share(postId: String): ApiResult<Unit>
}
