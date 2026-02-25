package com.myblog.android.feature.feed

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.feed.model.CommentPage
import com.myblog.android.feature.feed.model.CommentSort
import com.myblog.android.feature.feed.model.CommunityPage
import com.myblog.android.feature.feed.model.ComposeImageUpload
import com.myblog.android.feature.feed.model.ComposeRequest
import com.myblog.android.feature.feed.model.FeedActionResult
import com.myblog.android.feature.feed.model.PostComment
import com.myblog.android.feature.feed.model.PostDetail
import com.myblog.android.feature.feed.model.FeedSort
import com.myblog.android.feature.feed.model.FeedPage
import com.myblog.android.feature.feed.model.FeedItem
import com.myblog.android.feature.feed.model.UploadedComposeImage

interface FeedRepository {
    suspend fun getFeed(cursor: String?, sort: FeedSort = FeedSort.RECENT): ApiResult<FeedPage>
    suspend fun refreshFeed(sort: FeedSort = FeedSort.RECENT): ApiResult<FeedPage>

    suspend fun togglePostLike(
        postId: String,
        sourceType: String,
        communitySlug: String?,
    ): ApiResult<FeedActionResult> = ApiResult.Success(
        FeedActionResult(
            postId = postId,
            liked = false,
            likeCount = null,
            userVote = null,
        ),
    )

    suspend fun recordPostView(
        postId: String,
        sourceType: String,
        communitySlug: String?,
    ): ApiResult<Unit> = ApiResult.Success(Unit)

    suspend fun openPost(postId: String, sourceType: String, communitySlug: String?): ApiResult<FeedItem> =
        ApiResult.Failure(code = 500, message = "post detail not available")

    suspend fun fetchPostDetail(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        postSlug: String?,
    ): ApiResult<PostDetail> = ApiResult.Failure(code = 500, message = "post detail not available")

    suspend fun fetchComments(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        sort: CommentSort,
        cursor: String?,
        snapshotTimestamp: String?,
    ): ApiResult<CommentPage> = ApiResult.Success(
        CommentPage(
            comments = emptyList(),
            nextCursor = null,
            hasMore = false,
            snapshotTimestamp = null,
        ),
    )

    suspend fun fetchReplies(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        parentCommentId: String,
        cursor: String?,
    ): ApiResult<CommentPage> = ApiResult.Success(
        CommentPage(
            comments = emptyList(),
            nextCursor = null,
            hasMore = false,
            snapshotTimestamp = null,
        ),
    )

    suspend fun createComment(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        content: String,
        parentCommentId: String?,
    ): ApiResult<PostComment> = ApiResult.Failure(code = 500, message = "comment create unavailable")

    suspend fun toggleCommentLike(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        commentId: String,
    ): ApiResult<PostComment> = ApiResult.Failure(code = 500, message = "comment like unavailable")

    suspend fun fetchCommunities(
        cursor: String?,
        cursorId: String?,
        limit: Int = 20,
    ): ApiResult<CommunityPage> = ApiResult.Success(
        CommunityPage(
            items = emptyList(),
            nextCursor = null,
            hasMore = false,
            nextCursorId = null,
        ),
    )

    suspend fun fetchCommunityPosts(
        communitySlug: String,
        cursor: String?,
        cursorId: String?,
        limit: Int = 20,
        sortBy: String = "newest",
        search: String? = null,
    ): ApiResult<FeedPage> = ApiResult.Success(
        FeedPage(
            items = emptyList(),
            nextCursor = null,
            hasMore = false,
        ),
    )

    suspend fun toggleCommunityMembership(
        slug: String,
        currentlyJoined: Boolean,
    ): ApiResult<Boolean> = ApiResult.Failure(code = 500, message = "community membership update unavailable")

    suspend fun uploadComposeImages(
        images: List<ComposeImageUpload>,
    ): ApiResult<List<UploadedComposeImage>> = ApiResult.Success(emptyList())

    suspend fun uploadComposeImage(
        image: ComposeImageUpload,
    ): ApiResult<UploadedComposeImage> = ApiResult.Failure(
        code = 500,
        message = "compose image upload unavailable",
    )

    suspend fun createPost(request: ComposeRequest): ApiResult<PostDetail> =
        ApiResult.Failure(code = 500, message = "post create unavailable")
}
