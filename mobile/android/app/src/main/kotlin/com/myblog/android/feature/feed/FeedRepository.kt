package com.myblog.android.feature.feed

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.feed.model.FeedPage

interface FeedRepository {
    suspend fun getFeed(cursor: String?): ApiResult<FeedPage>
    suspend fun refreshFeed(): ApiResult<FeedPage>
}
