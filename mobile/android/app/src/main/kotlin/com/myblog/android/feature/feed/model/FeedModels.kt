package com.myblog.android.feature.feed.model

enum class FeedSort(val value: String) {
    RECENT("recent"),
    HOT("hot"),
    TOP("top"),
}

enum class CommentSort(val value: String) {
    POPULAR("popular"),
    RECENT("recent"),
}

data class FeedItem(
    val postId: String,
    val slug: String,
    val title: String,
    val excerpt: String,
    val authorName: String,
    val authorProfileImage: String?,
    val sourceType: String,
    val blogSlug: String? = null,
    val blogAlias: String? = null,
    val communitySlug: String?,
    val likeCount: Int,
    val commentCount: Int,
    val viewCount: Int,
    val upvoteCount: Int,
    val downvoteCount: Int,
    val score: Int,
    val liked: Boolean,
    val userVote: String?,
    val thumbnail: String?,
    val images: List<String>,
    val createdAtEpochSeconds: Long,
)

data class PostDetail(
    val postId: String,
    val slug: String,
    val sourceType: String,
    val communitySlug: String? = null,
    val title: String,
    val contentText: String,
    val contentHtml: String?,
    val authorName: String,
    val authorProfileImage: String?,
    val likeCount: Int,
    val commentCount: Int,
    val viewCount: Int,
    val liked: Boolean,
    val images: List<String>,
    val createdAtEpochSeconds: Long,
)

data class PostComment(
    val commentId: String,
    val parentCommentId: String?,
    val content: String,
    val authorName: String,
    val authorProfileImage: String?,
    val likeCount: Int,
    val replyCount: Int,
    val liked: Boolean,
    val createdAtEpochSeconds: Long,
)

data class CommentPage(
    val comments: List<PostComment>,
    val nextCursor: String?,
    val hasMore: Boolean,
    val snapshotTimestamp: String?,
)

data class CommunityItem(
    val communityId: String,
    val name: String,
    val slug: String,
    val iconUrl: String?,
    val memberCount: Int,
    val joined: Boolean,
)

data class CommunityPage(
    val items: List<CommunityItem>,
    val nextCursor: String?,
    val hasMore: Boolean,
    val nextCursorId: String?,
)

data class ComposeRequest(
    val content: String,
    val category: String,
    val publishNow: Boolean,
    val attachedFileIds: List<String> = emptyList(),
    val imageUrls: List<String> = emptyList(),
)

data class ComposeImageUpload(
    val fileName: String,
    val mimeType: String,
    val bytes: ByteArray,
)

data class UploadedComposeImage(
    val fileId: String?,
    val url: String,
    val fileKey: String,
)

data class FeedPage(
    val items: List<FeedItem>,
    val nextCursor: String?,
    val hasMore: Boolean,
    val nextCursorId: String? = null,
)

sealed interface FeedState {
    data object Loading : FeedState
    data class Ready(val page: FeedPage) : FeedState
    data object Empty : FeedState
    data class Error(val message: String) : FeedState
    data class Offline(val message: String) : FeedState
}
