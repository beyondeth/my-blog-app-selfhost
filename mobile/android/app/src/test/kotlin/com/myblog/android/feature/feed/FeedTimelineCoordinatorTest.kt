package com.myblog.android.feature.feed

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.feed.model.FeedSort
import com.myblog.android.feature.feed.model.FeedItem
import com.myblog.android.feature.feed.model.FeedPage
import com.myblog.android.feature.feed.model.FeedState
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class FeedTimelineCoordinatorTest {
    @Test
    fun refreshLoadsReadyState() = runTest {
        val repository = FakeFeedRepository(
            refreshResult = ApiResult.Success(
                FeedPage(
                    items = listOf(sampleItem("1")),
                    nextCursor = "next-1",
                    hasMore = true,
                ),
            ),
            nextResult = ApiResult.Success(
                FeedPage(
                    items = listOf(sampleItem("2")),
                    nextCursor = null,
                    hasMore = false,
                ),
            ),
        )

        val coordinator = FeedTimelineCoordinator(repository)
        coordinator.refresh()

        val state = assertIs<FeedState.Ready>(coordinator.state.value)
        assertEquals(1, state.page.items.size)
    }

    @Test
    fun loadNextPageAppendsItems() = runTest {
        val repository = FakeFeedRepository(
            refreshResult = ApiResult.Success(
                FeedPage(
                    items = listOf(sampleItem("1")),
                    nextCursor = "next-1",
                    hasMore = true,
                ),
            ),
            nextResult = ApiResult.Success(
                FeedPage(
                    items = listOf(sampleItem("2")),
                    nextCursor = null,
                    hasMore = false,
                ),
            ),
        )

        val coordinator = FeedTimelineCoordinator(repository)
        coordinator.refresh()
        coordinator.loadNextPage()

        val ready = assertIs<FeedState.Ready>(coordinator.state.value)
        assertEquals(2, ready.page.items.size)
        assertEquals(false, ready.page.hasMore)
    }
}

private class FakeFeedRepository(
    private val refreshResult: ApiResult<FeedPage>,
    private val nextResult: ApiResult<FeedPage>,
) : FeedRepository {
    override suspend fun getFeed(
        cursor: String?,
        sort: FeedSort,
    ): ApiResult<FeedPage> = nextResult

    override suspend fun refreshFeed(sort: FeedSort): ApiResult<FeedPage> = refreshResult
}

private fun sampleItem(id: String): FeedItem {
    return FeedItem(
        postId = id,
        slug = "slug-$id",
        title = "t$id",
        excerpt = "e$id",
        authorName = "a$id",
        authorProfileImage = null,
        sourceType = "blog",
        communitySlug = null,
        likeCount = 0,
        commentCount = 0,
        viewCount = 0,
        upvoteCount = 0,
        downvoteCount = 0,
        score = 0,
        liked = false,
        userVote = null,
        thumbnail = null,
        images = emptyList(),
        createdAtEpochSeconds = 0L,
    )
}
