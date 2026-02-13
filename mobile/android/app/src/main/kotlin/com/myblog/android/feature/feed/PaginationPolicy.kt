package com.myblog.android.feature.feed

import com.myblog.android.feature.feed.model.FeedPage

object PaginationPolicy {
    fun shouldLoadNext(page: FeedPage): Boolean {
        return page.hasMore && !page.nextCursor.isNullOrBlank()
    }

    fun mergePages(current: FeedPage, next: FeedPage): FeedPage {
        return FeedPage(
            items = current.items + next.items,
            nextCursor = next.nextCursor,
            hasMore = next.hasMore,
        )
    }
}
