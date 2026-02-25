package com.myblog.android.feature.feed

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.feed.model.FeedPage

interface LoadInitialFeedUseCase {
    suspend operator fun invoke(): ApiResult<FeedPage>
}

interface LoadNextFeedPageUseCase {
    suspend operator fun invoke(cursor: String?): ApiResult<FeedPage>
}
