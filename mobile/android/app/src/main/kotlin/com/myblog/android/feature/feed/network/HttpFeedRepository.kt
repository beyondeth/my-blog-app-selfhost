package com.myblog.android.feature.feed.network

import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.network.AuthenticatedRequestExecutor
import com.myblog.android.core.network.HttpRequest
import com.myblog.android.core.network.HttpResponse
import com.myblog.android.core.network.HttpTransport
import com.myblog.android.feature.feed.FeedRepository
import com.myblog.android.feature.feed.model.CommentPage
import com.myblog.android.feature.feed.model.CommentSort
import com.myblog.android.feature.feed.model.CommunityItem
import com.myblog.android.feature.feed.model.CommunityPage
import com.myblog.android.feature.feed.model.ComposeImageUpload
import com.myblog.android.feature.feed.model.ComposeRequest
import com.myblog.android.feature.feed.model.FeedActionResult
import com.myblog.android.feature.feed.model.FeedItem
import com.myblog.android.feature.feed.model.FeedPage
import com.myblog.android.feature.feed.model.FeedSort
import com.myblog.android.feature.feed.model.PostComment
import com.myblog.android.feature.feed.model.PostDetail
import com.myblog.android.feature.feed.model.UploadedComposeImage
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Instant

class HttpFeedRepository(
    private val transport: HttpTransport,
    private val requestExecutor: AuthenticatedRequestExecutor,
    baseUrl: String,
) : FeedRepository {
    private val normalizedBaseUrl = baseUrl
        .trimEnd('/')
        .let { candidate -> if (candidate.endsWith("/api/v1")) candidate else "$candidate/api/v1" }
    private val backendRoot = normalizedBaseUrl.removeSuffix("/api/v1")
    private val cdnRoot = "https://cdn.codebase.blog"

    override suspend fun getFeed(cursor: String?, sort: FeedSort): ApiResult<FeedPage> {
        return requestExecutor.execute { accessToken ->
            decodeFeedResponse(
                transport.execute(
                    HttpRequest(
                        method = "GET",
                        url = feedEndpoint(cursor, sort),
                        headers = requestHeaders(accessToken),
                    ),
                ),
            )
        }
    }

    override suspend fun refreshFeed(sort: FeedSort): ApiResult<FeedPage> = getFeed(cursor = null, sort = sort)

    override suspend fun togglePostLike(
        postId: String,
        sourceType: String,
        communitySlug: String?,
    ): ApiResult<FeedActionResult> {
        val normalizedType = sourceType.lowercase()
        val endpoint = if (normalizedType == "community" && !communitySlug.isNullOrBlank()) {
            "$normalizedBaseUrl/community/${encodePath(communitySlug)}/posts/${encodePath(postId)}/vote"
        } else {
            "$normalizedBaseUrl/posts/${encodePath(postId)}/vote"
        }

        return requestExecutor.execute { accessToken ->
            decodeFeedActionResponse(
                request = transport.execute(
                    HttpRequest(
                        method = "POST",
                        url = endpoint,
                        headers = requestHeaders(accessToken) + ("Content-Type" to "application/json"),
                        body = """{"type":"upvote"}""",
                    ),
                ),
                postId = postId,
            )
        }
    }

    override suspend fun recordPostView(
        postId: String,
        sourceType: String,
        communitySlug: String?,
    ): ApiResult<Unit> {
        val normalizedType = sourceType.lowercase()
        val endpoint = if (normalizedType == "community") {
            val slug = communitySlug?.takeIf { it.isNotBlank() }
                ?: return ApiResult.Failure(code = 400, message = "community slug is missing")
            "$normalizedBaseUrl/community/${encodePath(slug)}/posts/${encodePath(postId)}/view"
        } else {
            "$normalizedBaseUrl/posts/${encodePath(postId)}/view"
        }

        return requestExecutor.execute { accessToken ->
            when (val response = transport.execute(
                HttpRequest(
                    method = "POST",
                    url = endpoint,
                    headers = requestHeaders(accessToken),
                ),
            )) {
                is ApiResult.Failure -> response
                is ApiResult.Success -> {
                    if (response.data.statusCode in 200..299) {
                        ApiResult.Success(Unit)
                    } else {
                        ApiResult.Failure(
                            code = response.data.statusCode,
                            message = extractFailureMessage(response.data),
                        )
                    }
                }
            }
        }
    }

    override suspend fun openPost(
        postId: String,
        sourceType: String,
        communitySlug: String?,
    ): ApiResult<FeedItem> {
        return when (val detail = fetchPostDetail(postId, sourceType, communitySlug, postSlug = null)) {
            is ApiResult.Failure -> ApiResult.Failure(detail.code, detail.message)
            is ApiResult.Success -> {
                val item = detail.data
                ApiResult.Success(
                    FeedItem(
                        postId = item.postId,
                        slug = item.slug,
                        title = item.title,
                        excerpt = item.contentText.take(220),
                        authorName = item.authorName,
                        authorProfileImage = item.authorProfileImage,
                        sourceType = item.sourceType,
                        blogSlug = null,
                        blogAlias = null,
                        communitySlug = item.communitySlug,
                        likeCount = item.likeCount,
                        commentCount = item.commentCount,
                        viewCount = item.viewCount,
                        upvoteCount = item.likeCount,
                        downvoteCount = 0,
                        score = item.likeCount,
                        liked = item.liked,
                        userVote = if (item.liked) "upvote" else null,
                        thumbnail = item.images.firstOrNull(),
                        images = item.images,
                        createdAtEpochSeconds = item.createdAtEpochSeconds,
                    ),
                )
            }
        }
    }

    override suspend fun fetchPostDetail(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        postSlug: String?,
    ): ApiResult<PostDetail> {
        val normalizedType = sourceType.lowercase()
        return requestExecutor.execute { accessToken ->
            when (normalizedType) {
                "community" -> fetchCommunityPostDetail(postId, communitySlug, postSlug, accessToken)
                else -> fetchBlogPostDetail(postId, accessToken)
            }
        }
    }

    override suspend fun fetchComments(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        sort: CommentSort,
        cursor: String?,
        snapshotTimestamp: String?,
    ): ApiResult<CommentPage> {
        return requestExecutor.execute { accessToken ->
            val endpoint = when (sourceType.lowercase()) {
                "community" -> {
                    val slug = communitySlug?.takeIf { it.isNotBlank() }
                        ?: return@execute ApiResult.Failure(code = 400, message = "community slug is missing")
                    val base = "$normalizedBaseUrl/community/${encodePath(slug)}/posts/${encodePath(postId)}/comments/paginated"
                    buildCommentsPageUrl(base, sort, cursor, snapshotTimestamp)
                }

                else -> {
                    val base = "$normalizedBaseUrl/comments/post/${encodePath(postId)}/paginated"
                    buildCommentsPageUrl(base, sort, cursor, snapshotTimestamp)
                }
            }

            decodeCommentPageResponse(
                transport.execute(
                    HttpRequest(
                        method = "GET",
                        url = endpoint,
                        headers = requestHeaders(accessToken),
                    ),
                ),
            )
        }
    }

    override suspend fun fetchReplies(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        parentCommentId: String,
        cursor: String?,
    ): ApiResult<CommentPage> {
        return requestExecutor.execute { accessToken ->
            val endpoint = when (sourceType.lowercase()) {
                "community" -> {
                    val slug = communitySlug?.takeIf { it.isNotBlank() }
                        ?: return@execute ApiResult.Failure(code = 400, message = "community slug is missing")
                    buildRepliesUrl(
                        "$normalizedBaseUrl/community/${encodePath(slug)}/posts/${encodePath(postId)}/comments/${encodePath(parentCommentId)}/replies",
                        cursor,
                    )
                }

                else -> {
                    buildRepliesUrl(
                        "$normalizedBaseUrl/comments/${encodePath(parentCommentId)}/replies",
                        cursor,
                    )
                }
            }

            decodeCommentPageResponse(
                transport.execute(
                    HttpRequest(
                        method = "GET",
                        url = endpoint,
                        headers = requestHeaders(accessToken),
                    ),
                ),
            )
        }
    }

    override suspend fun createComment(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        content: String,
        parentCommentId: String?,
    ): ApiResult<PostComment> {
        val normalizedContent = content.trim()
        if (normalizedContent.isBlank()) {
            return ApiResult.Failure(code = 400, message = "comment content is empty")
        }

        val body = if (parentCommentId.isNullOrBlank()) {
            """{"content":"${escapeJson(normalizedContent)}"}"""
        } else {
            """{"content":"${escapeJson(normalizedContent)}","parentCommentId":"${escapeJson(parentCommentId)}"}"""
        }

        return requestExecutor.execute { accessToken ->
            val endpoint = when (sourceType.lowercase()) {
                "community" -> {
                    val slug = communitySlug?.takeIf { it.isNotBlank() }
                        ?: return@execute ApiResult.Failure(code = 400, message = "community slug is missing")
                    "$normalizedBaseUrl/community/${encodePath(slug)}/posts/${encodePath(postId)}/comments"
                }

                else -> "$normalizedBaseUrl/comments"
            }

            val normalizedBody = if (sourceType.lowercase() == "community") {
                body
            } else if (parentCommentId.isNullOrBlank()) {
                """{"postId":"${escapeJson(postId)}","content":"${escapeJson(normalizedContent)}"}"""
            } else {
                """{"postId":"${escapeJson(postId)}","content":"${escapeJson(normalizedContent)}","parentCommentId":"${escapeJson(parentCommentId)}"}"""
            }

            decodeSingleCommentResponse(
                transport.execute(
                    HttpRequest(
                        method = "POST",
                        url = endpoint,
                        headers = requestHeaders(accessToken) + ("Content-Type" to "application/json"),
                        body = normalizedBody,
                    ),
                ),
                fallbackContent = normalizedContent,
                fallbackCommentId = parentCommentId ?: "",
            )
        }
    }

    override suspend fun toggleCommentLike(
        postId: String,
        sourceType: String,
        communitySlug: String?,
        commentId: String,
    ): ApiResult<PostComment> {
        return requestExecutor.execute { accessToken ->
            val endpoint = when (sourceType.lowercase()) {
                "community" -> {
                    val slug = communitySlug?.takeIf { it.isNotBlank() }
                        ?: return@execute ApiResult.Failure(code = 400, message = "community slug is missing")
                    "$normalizedBaseUrl/community/${encodePath(slug)}/posts/${encodePath(postId)}/comments/${encodePath(commentId)}/like"
                }

                else -> "$normalizedBaseUrl/comments/${encodePath(commentId)}/like"
            }
            decodeCommentLikeResponse(
                transport.execute(
                    HttpRequest(
                        method = "POST",
                        url = endpoint,
                        headers = requestHeaders(accessToken),
                    ),
                ),
                commentId = commentId,
            )
        }
    }

    override suspend fun fetchCommunities(
        cursor: String?,
        cursorId: String?,
        limit: Int,
    ): ApiResult<CommunityPage> {
        return requestExecutor.execute { accessToken ->
            val endpoint = buildCommunitiesUrl(cursor, cursorId, limit)
            decodeCommunitiesResponse(
                transport.execute(
                    HttpRequest(
                        method = "GET",
                        url = endpoint,
                        headers = requestHeaders(accessToken),
                    ),
                ),
            )
        }
    }

    override suspend fun fetchCommunityPosts(
        communitySlug: String,
        cursor: String?,
        cursorId: String?,
        limit: Int,
        sortBy: String,
        search: String?,
    ): ApiResult<FeedPage> {
        return requestExecutor.execute { accessToken ->
            val endpoint = buildCommunityPostsUrl(
                communitySlug = communitySlug,
                cursor = cursor,
                cursorId = cursorId,
                limit = limit,
                sortBy = sortBy,
                search = search,
            )
            decodeCommunityPostsResponse(
                transport.execute(
                    HttpRequest(
                        method = "GET",
                        url = endpoint,
                        headers = requestHeaders(accessToken),
                    ),
                ),
                communitySlug = communitySlug,
            )
        }
    }

    override suspend fun toggleCommunityMembership(
        slug: String,
        currentlyJoined: Boolean,
    ): ApiResult<Boolean> {
        return requestExecutor.execute { accessToken ->
            val endpoint = if (currentlyJoined) {
                "$normalizedBaseUrl/community/${encodePath(slug)}/leave"
            } else {
                "$normalizedBaseUrl/community/${encodePath(slug)}/join"
            }
            when (val response = transport.execute(
                HttpRequest(
                    method = "POST",
                    url = endpoint,
                    headers = requestHeaders(accessToken),
                    body = """{}""",
                ),
            )) {
                is ApiResult.Failure -> response
                is ApiResult.Success -> {
                    if (response.data.statusCode in 200..299) {
                        ApiResult.Success(!currentlyJoined)
                    } else {
                        ApiResult.Failure(
                            code = response.data.statusCode,
                            message = extractFailureMessage(response.data),
                        )
                    }
                }
            }
        }
    }

    override suspend fun createPost(request: ComposeRequest): ApiResult<PostDetail> {
        val content = request.content.trim()
        if (content.isBlank()) {
            return ApiResult.Failure(code = 400, message = "post content is empty")
        }
        val title = content.lineSequence()
            .map { it.trim() }
            .firstOrNull { it.isNotBlank() }
            ?.take(90)
            ?: "새 글"
        val imageMarkdown = request.imageUrls
            .filter { it.isNotBlank() }
            .joinToString("\n\n") { url -> "![](${url.trim()})" }
        val finalContent = listOf(content, imageMarkdown)
            .filter { it.isNotBlank() }
            .joinToString("\n\n")
        val attachedIdsJson = request.attachedFileIds
            .filter { it.isNotBlank() }
            .joinToString(prefix = "[", postfix = "]") { id -> "\"${escapeJson(id)}\"" }
        val body = """
            {
              "title":"${escapeJson(title)}",
              "content":"${escapeJson(finalContent)}",
              "content_markdown":"${escapeJson(finalContent)}",
              "category":"${escapeJson(request.category.ifBlank { "general" })}",
              "attachedFileIds":$attachedIdsJson,
              "isPublished":${request.publishNow}
            }
        """.trimIndent()

        return requestExecutor.execute { accessToken ->
            decodePostDetailResponse(
                transport.execute(
                    HttpRequest(
                        method = "POST",
                        url = "$normalizedBaseUrl/posts",
                        headers = requestHeaders(accessToken) + ("Content-Type" to "application/json"),
                        body = body,
                    ),
                ),
                sourceType = "blog",
                fallbackPostId = "",
                fallbackSlug = "",
                fallbackCommunitySlug = null,
            )
        }
    }

    override suspend fun uploadComposeImages(
        images: List<ComposeImageUpload>,
    ): ApiResult<List<UploadedComposeImage>> {
        if (images.isEmpty()) {
            return ApiResult.Success(emptyList())
        }

        val uploaded = mutableListOf<UploadedComposeImage>()
        val failures = mutableListOf<String>()
        images.forEach { image ->
            when (val result = uploadComposeImage(image)) {
                is ApiResult.Success -> uploaded += result.data
                is ApiResult.Failure -> failures += "${image.fileName}: ${result.message}"
            }
        }

        if (uploaded.isNotEmpty()) {
            return ApiResult.Success(uploaded)
        }
        return ApiResult.Failure(
            code = 500,
            message = failures.firstOrNull() ?: "image upload failed",
        )
    }

    override suspend fun uploadComposeImage(
        image: ComposeImageUpload,
    ): ApiResult<UploadedComposeImage> {
        return requestExecutor.execute { accessToken ->
            val uploadInit = transport.execute(
                HttpRequest(
                    method = "POST",
                    url = "$normalizedBaseUrl/files/upload-url",
                    headers = requestHeaders(accessToken) + ("Content-Type" to "application/json"),
                    body = """
                        {
                          "fileName":"${escapeJson(image.fileName)}",
                          "mimeType":"${escapeJson(image.mimeType)}",
                          "fileSize":${image.bytes.size},
                          "fileType":"image"
                        }
                    """.trimIndent(),
                ),
            )

            val uploadInitResponse = when (uploadInit) {
                is ApiResult.Failure -> return@execute uploadInit
                is ApiResult.Success -> uploadInit.data
            }
            if (uploadInitResponse.statusCode !in 200..299) {
                return@execute ApiResult.Failure(
                    code = uploadInitResponse.statusCode,
                    message = extractFailureMessage(uploadInitResponse),
                )
            }

            val uploadInitPayload = unwrapDataObject(uploadInitResponse.body)
            val uploadUrl = firstJsonString(uploadInitPayload, "uploadUrl")
                ?: firstJsonString(uploadInitResponse.body, "uploadUrl")
                ?: return@execute ApiResult.Failure(
                    code = uploadInitResponse.statusCode,
                    message = "upload URL is missing",
                )
            val fileKey = firstJsonString(uploadInitPayload, "fileKey", "s3Key")
                ?: firstJsonString(uploadInitResponse.body, "fileKey", "s3Key")
                ?: return@execute ApiResult.Failure(
                    code = uploadInitResponse.statusCode,
                    message = "fileKey is missing",
                )

            val uploadBinary = transport.execute(
                HttpRequest(
                    method = "PUT",
                    url = uploadUrl,
                    headers = mapOf("Content-Type" to image.mimeType),
                    bodyBytes = image.bytes,
                ),
            )
            val uploadBinaryResponse = when (uploadBinary) {
                is ApiResult.Failure -> return@execute uploadBinary
                is ApiResult.Success -> uploadBinary.data
            }
            if (uploadBinaryResponse.statusCode !in 200..299) {
                return@execute ApiResult.Failure(
                    code = uploadBinaryResponse.statusCode,
                    message = "image upload failed",
                )
            }

            val uploadComplete = transport.execute(
                HttpRequest(
                    method = "POST",
                    url = "$normalizedBaseUrl/files/upload-complete",
                    headers = requestHeaders(accessToken) + ("Content-Type" to "application/json"),
                    body = """
                        {
                          "fileKey":"${escapeJson(fileKey)}",
                          "fileUrl":"${escapeJson(fileKey)}",
                          "fileName":"${escapeJson(image.fileName)}",
                          "mimeType":"${escapeJson(image.mimeType)}",
                          "fileSize":${image.bytes.size},
                          "fileType":"image"
                        }
                    """.trimIndent(),
                ),
            )
            val uploadCompleteResponse = when (uploadComplete) {
                is ApiResult.Failure -> return@execute uploadComplete
                is ApiResult.Success -> uploadComplete.data
            }
            if (uploadCompleteResponse.statusCode !in 200..299) {
                return@execute ApiResult.Failure(
                    code = uploadCompleteResponse.statusCode,
                    message = extractFailureMessage(uploadCompleteResponse),
                )
            }

            val uploadCompletePayload = unwrapDataObject(uploadCompleteResponse.body)
            val fileId = firstJsonString(uploadCompletePayload, "id", "fileId")
                ?: firstJsonString(uploadCompleteResponse.body, "id", "fileId")
            val resolvedUrl = resolveMediaUrl(
                firstJsonString(uploadCompletePayload, "accessUrl", "fileUrl", "url")
                    ?: firstJsonString(uploadCompleteResponse.body, "accessUrl", "fileUrl", "url")
                    ?: fileKey,
            ) ?: "$cdnRoot/${fileKey.removePrefix("/")}"

            ApiResult.Success(
                UploadedComposeImage(
                    fileId = fileId,
                    url = resolvedUrl,
                    fileKey = fileKey,
                ),
            )
        }
    }

    private fun feedEndpoint(cursor: String?, sort: FeedSort): String {
        val base = "$normalizedBaseUrl/feed?sort=${sort.value}&limit=20"
        val value = cursor?.takeIf { it.isNotBlank() } ?: return base
        val encoded = URLEncoder.encode(value, StandardCharsets.UTF_8)
        return "$base&cursor=$encoded"
    }

    private fun buildCommentsPageUrl(
        base: String,
        sort: CommentSort,
        cursor: String?,
        snapshotTimestamp: String?,
    ): String {
        val builder = StringBuilder("$base?sort=${sort.value}&limit=20")
        if (!cursor.isNullOrBlank()) {
            builder.append("&cursor=${encodeQuery(cursor)}")
        }
        if (sort == CommentSort.POPULAR && !snapshotTimestamp.isNullOrBlank()) {
            builder.append("&snapshotTimestamp=${encodeQuery(snapshotTimestamp)}")
        }
        return builder.toString()
    }

    private fun buildRepliesUrl(base: String, cursor: String?): String {
        val builder = StringBuilder("$base?limit=20")
        if (!cursor.isNullOrBlank()) {
            builder.append("&cursor=${encodeQuery(cursor)}")
        }
        return builder.toString()
    }

    private fun buildCommunitiesUrl(cursor: String?, cursorId: String?, limit: Int): String {
        val builder = StringBuilder("$normalizedBaseUrl/community?limit=$limit")
        if (!cursor.isNullOrBlank()) {
            builder.append("&cursor=${encodeQuery(cursor)}")
        }
        if (!cursorId.isNullOrBlank()) {
            builder.append("&cursorId=${encodeQuery(cursorId)}")
        }
        return builder.toString()
    }

    private fun buildCommunityPostsUrl(
        communitySlug: String,
        cursor: String?,
        cursorId: String?,
        limit: Int,
        sortBy: String,
        search: String?,
    ): String {
        val builder = StringBuilder(
            "$normalizedBaseUrl/community/${encodePath(communitySlug)}/posts?limit=$limit&sortBy=${encodeQuery(sortBy)}",
        )
        if (!cursor.isNullOrBlank()) {
            builder.append("&cursor=${encodeQuery(cursor)}")
        }
        if (!cursorId.isNullOrBlank()) {
            builder.append("&cursorId=${encodeQuery(cursorId)}")
        }
        if (!search.isNullOrBlank()) {
            builder.append("&search=${encodeQuery(search)}")
        }
        return builder.toString()
    }

    private suspend fun fetchBlogPostDetail(
        postId: String,
        accessToken: String?,
    ): ApiResult<PostDetail> {
        val primary = transport.execute(
            HttpRequest(
                method = "GET",
                url = "$normalizedBaseUrl/posts/${encodePath(postId)}",
                headers = requestHeaders(accessToken),
            ),
        )
        val decodedPrimary = decodePostDetailResponse(
            primary,
            sourceType = "blog",
            fallbackPostId = postId,
            fallbackSlug = postId,
            fallbackCommunitySlug = null,
        )
        if (decodedPrimary is ApiResult.Success) {
            return decodedPrimary
        }

        val fallback = transport.execute(
            HttpRequest(
                method = "GET",
                url = "$normalizedBaseUrl/mobile/posts/${encodePath(postId)}",
                headers = requestHeaders(accessToken),
            ),
        )
        return decodePostDetailResponse(
            fallback,
            sourceType = "blog",
            fallbackPostId = postId,
            fallbackSlug = postId,
            fallbackCommunitySlug = null,
        )
    }

    private suspend fun fetchCommunityPostDetail(
        postId: String,
        communitySlug: String?,
        postSlug: String?,
        accessToken: String?,
    ): ApiResult<PostDetail> {
        val slug = communitySlug?.takeIf { it.isNotBlank() }
            ?: return ApiResult.Failure(code = 400, message = "community slug is missing")

        val candidates = buildList {
            if (!postSlug.isNullOrBlank()) {
                add("$normalizedBaseUrl/community/${encodePath(slug)}/posts/${encodePath(postSlug)}")
                add("$normalizedBaseUrl/community/${encodePath(slug)}/comments/${encodePath(postSlug)}")
            }
            add("$normalizedBaseUrl/community/${encodePath(slug)}/posts/id/${encodePath(postId)}")
        }

        var lastFailure: ApiResult.Failure? = null
        for (endpoint in candidates) {
            val result = decodePostDetailResponse(
                transport.execute(
                    HttpRequest(
                        method = "GET",
                        url = endpoint,
                        headers = requestHeaders(accessToken),
                    ),
                ),
                sourceType = "community",
                fallbackPostId = postId,
                fallbackSlug = postSlug ?: postId,
                fallbackCommunitySlug = slug,
            )
            when (result) {
                is ApiResult.Success -> return result
                is ApiResult.Failure -> lastFailure = result
            }
        }
        return lastFailure ?: ApiResult.Failure(code = 404, message = "community post detail not found")
    }

    private fun requestHeaders(accessToken: String?): Map<String, String> {
        val base = mapOf("Accept" to "application/json")
        return if (accessToken.isNullOrBlank()) base else base + ("Authorization" to "Bearer $accessToken")
    }

    private fun decodeFeedResponse(response: ApiResult<HttpResponse>): ApiResult<FeedPage> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    runCatching { parseFeedPage(response.data.body) }
                        .fold(
                            onSuccess = { ApiResult.Success(it) },
                            onFailure = { throwable ->
                                ApiResult.Failure(
                                    code = response.data.statusCode,
                                    message = throwable.message ?: "feed response decoding failed",
                                )
                            },
                        )
                }
            }
        }
    }

    private fun decodeFeedActionResponse(
        request: ApiResult<HttpResponse>,
        postId: String,
    ): ApiResult<FeedActionResult> {
        return when (request) {
            is ApiResult.Failure -> request
            is ApiResult.Success -> {
                if (request.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = request.data.statusCode,
                        message = extractFailureMessage(request.data),
                    )
                } else {
                    runCatching {
                        val body = unwrapDataObject(request.data.body)
                        val likeCount = firstJsonInt(body, "likeCount", "upvoteCount")
                        val userVote = firstJsonString(body, "userVote", "user_vote")
                        val liked = firstJsonBoolean(body, "liked")
                            ?: (userVote == "upvote")
                        FeedActionResult(
                            postId = postId,
                            liked = liked,
                            likeCount = likeCount,
                            userVote = userVote,
                        )
                    }.fold(
                        onSuccess = { ApiResult.Success(it) },
                        onFailure = { throwable ->
                            ApiResult.Failure(
                                code = request.data.statusCode,
                                message = throwable.message ?: "post vote response decoding failed",
                            )
                        },
                    )
                }
            }
        }
    }

    private fun decodePostDetailResponse(
        response: ApiResult<HttpResponse>,
        sourceType: String,
        fallbackPostId: String,
        fallbackSlug: String,
        fallbackCommunitySlug: String?,
    ): ApiResult<PostDetail> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    runCatching {
                        parsePostDetail(
                            body = response.data.body,
                            sourceType = sourceType,
                            fallbackPostId = fallbackPostId,
                            fallbackSlug = fallbackSlug,
                            fallbackCommunitySlug = fallbackCommunitySlug,
                        )
                    }.fold(
                        onSuccess = { ApiResult.Success(it) },
                        onFailure = { throwable ->
                            ApiResult.Failure(
                                code = response.data.statusCode,
                                message = throwable.message ?: "post detail response decoding failed",
                            )
                        },
                    )
                }
            }
        }
    }

    private fun decodeCommentPageResponse(response: ApiResult<HttpResponse>): ApiResult<CommentPage> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    runCatching { parseCommentPage(response.data.body) }
                        .fold(
                            onSuccess = { ApiResult.Success(it) },
                            onFailure = { throwable ->
                                ApiResult.Failure(
                                    code = response.data.statusCode,
                                    message = throwable.message ?: "comment page response decoding failed",
                                )
                            },
                        )
                }
            }
        }
    }

    private fun decodeSingleCommentResponse(
        response: ApiResult<HttpResponse>,
        fallbackContent: String,
        fallbackCommentId: String,
    ): ApiResult<PostComment> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    runCatching {
                        parseSingleComment(response.data.body, fallbackContent, fallbackCommentId)
                    }.fold(
                        onSuccess = { ApiResult.Success(it) },
                        onFailure = { throwable ->
                            ApiResult.Failure(
                                code = response.data.statusCode,
                                message = throwable.message ?: "comment response decoding failed",
                            )
                        },
                    )
                }
            }
        }
    }

    private fun decodeCommentLikeResponse(
        response: ApiResult<HttpResponse>,
        commentId: String,
    ): ApiResult<PostComment> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    val body = unwrapDataObject(response.data.body)
                    ApiResult.Success(
                        PostComment(
                            commentId = commentId,
                            parentCommentId = jsonNullableString(body, "parentCommentId"),
                            content = firstJsonString(body, "content", "message").orEmpty(),
                            authorName = firstJsonString(body, "authorName", "username").orEmpty(),
                            authorProfileImage = resolveMediaUrl(firstJsonString(body, "profileImage", "avatarUrl")),
                            likeCount = firstJsonInt(body, "likesCount", "likeCount") ?: 0,
                            replyCount = firstJsonInt(body, "repliesCount", "replyCount") ?: 0,
                            liked = firstJsonBoolean(body, "liked", "userLiked") ?: false,
                            createdAtEpochSeconds = parseEpochSeconds(firstJsonString(body, "createdAt")) ?: 0L,
                        ),
                    )
                }
            }
        }
    }

    private fun decodeCommunitiesResponse(response: ApiResult<HttpResponse>): ApiResult<CommunityPage> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    runCatching { parseCommunityPage(response.data.body) }
                        .fold(
                            onSuccess = { ApiResult.Success(it) },
                            onFailure = { throwable ->
                                ApiResult.Failure(
                                    code = response.data.statusCode,
                                    message = throwable.message ?: "community response decoding failed",
                                )
                            },
                        )
                }
            }
        }
    }

    private fun decodeCommunityPostsResponse(
        response: ApiResult<HttpResponse>,
        communitySlug: String,
    ): ApiResult<FeedPage> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    runCatching { parseCommunityFeedPage(response.data.body, communitySlug) }
                        .fold(
                            onSuccess = { ApiResult.Success(it) },
                            onFailure = { throwable ->
                                ApiResult.Failure(
                                    code = response.data.statusCode,
                                    message = throwable.message ?: "community posts response decoding failed",
                                )
                            },
                        )
                }
            }
        }
    }

    private fun parseFeedPage(body: String): FeedPage {
        val itemsArray = requireJsonArray(body, "items")
        val items = splitObjects(itemsArray).map { itemBody ->
            val sourceType = firstJsonString(itemBody, "sourceType", "source_type")?.lowercase() ?: "unknown"
            val authorObject = jsonObject(itemBody, "author") ?: "{}"
            val communityObject = if (sourceType == "community") {
                jsonObject(itemBody, "community")
            } else {
                null
            }
            val blogObject = if (sourceType == "blog") {
                jsonObject(itemBody, "blog")
            } else {
                null
            }
            val createdAtIso = firstJsonString(itemBody, "createdAt", "created_at")
            val createdAtEpoch = parseEpochSeconds(createdAtIso) ?: 0L
            val contentMarkdown = firstJsonString(itemBody, "content_markdown", "contentMarkdown")
            val contentHtml = firstJsonString(itemBody, "content")
            val normalizedMarkdown = contentMarkdown?.let(::stripMarkdownPreview).orEmpty()
            val normalizedHtml = contentHtml?.let(::stripHtml).orEmpty()
            val rawExcerpt = firstJsonString(itemBody, "excerpt", "summary")
                ?.trim()
                .orEmpty()
            val resolvedExcerpt = when {
                rawExcerpt.isNotBlank() -> stripMarkdownPreview(rawExcerpt)
                normalizedMarkdown.isNotBlank() -> normalizedMarkdown
                normalizedHtml.isNotBlank() -> normalizedHtml
                else -> ""
            }
            val rawTitle = firstJsonString(itemBody, "title")
                ?.trim()
                .orEmpty()
            val resolvedTitle = rawTitle.ifBlank {
                resolvedExcerpt
                    .lineSequence()
                    .map { it.trim() }
                    .firstOrNull { it.isNotBlank() }
                    ?.take(90)
                    .orEmpty()
            }.ifBlank { "제목 없음" }

            val attachedFiles = jsonArray(itemBody, "attachedFiles")
                ?.let(::splitObjects)
                ?.mapNotNull { entry -> firstJsonString(entry, "fileUrl", "url", "fileKey") }
                .orEmpty()
            val parsedImages = jsonStringArray(itemBody, "images")
            val markdownImages = extractMarkdownImageUrls(contentMarkdown)
            val htmlImages = extractHtmlImageUrls(contentHtml)
            val imageCandidates = (parsedImages + attachedFiles)
                .plus(markdownImages)
                .plus(htmlImages)
                .mapNotNull(::resolveMediaUrl)
                .distinct()
            val resolvedThumbnail = resolveMediaUrl(firstJsonString(itemBody, "thumbnail", "thumbnailUrl"))
                ?: imageCandidates.firstOrNull()

            FeedItem(
                postId = requireJsonString(itemBody, "id"),
                slug = firstJsonString(itemBody, "slug") ?: "",
                title = resolvedTitle,
                excerpt = resolvedExcerpt,
                authorName = firstJsonString(authorObject, "username", "name", "displayName")
                    ?: "Unknown",
                authorProfileImage = resolveMediaUrl(
                    firstJsonString(authorObject, "profileImage", "profileImageUrl", "avatarUrl"),
                ),
                sourceType = sourceType,
                blogSlug = firstJsonString(blogObject ?: "", "slug"),
                blogAlias = firstJsonString(blogObject ?: "", "alias"),
                communitySlug = if (sourceType == "community") {
                    firstJsonString(communityObject ?: "", "slug")
                } else {
                    null
                },
                likeCount = jsonInt(itemBody, "likeCount") ?: jsonInt(itemBody, "upvoteCount") ?: 0,
                commentCount = firstJsonInt(itemBody, "commentCount", "comment_count") ?: 0,
                viewCount = firstJsonInt(itemBody, "viewCount", "view_count") ?: 0,
                upvoteCount = jsonInt(itemBody, "upvoteCount") ?: jsonInt(itemBody, "likeCount") ?: 0,
                downvoteCount = jsonInt(itemBody, "downvoteCount") ?: 0,
                score = jsonInt(itemBody, "score") ?: jsonInt(itemBody, "voteScore") ?: 0,
                liked = firstJsonBoolean(itemBody, "liked") ?: false,
                userVote = firstJsonString(itemBody, "userVote", "user_vote"),
                thumbnail = resolvedThumbnail,
                images = imageCandidates,
                createdAtEpochSeconds = createdAtEpoch,
            )
        }

        return FeedPage(
            items = items,
            nextCursor = jsonNullableString(body, "nextCursor"),
            hasMore = jsonBoolean(body, "hasMore") ?: false,
            nextCursorId = jsonNullableString(body, "nextCursorId"),
        )
    }

    private fun parseCommunityFeedPage(body: String, communitySlug: String): FeedPage {
        val payload = unwrapDataObject(body)
        val itemsArray = requireJsonArray(payload, "items")
        val items = splitObjects(itemsArray).map { itemBody ->
            val authorObject = jsonObject(itemBody, "author")
                ?: jsonObject(itemBody, "user")
                ?: "{}"
            val contentMarkdown = firstJsonString(itemBody, "content_markdown", "contentMarkdown")
            val contentHtml = firstJsonString(itemBody, "content")
            val normalizedMarkdown = contentMarkdown?.let(::stripMarkdownPreview).orEmpty()
            val normalizedHtml = contentHtml?.let(::stripHtml).orEmpty()
            val rawTitle = firstJsonString(itemBody, "title")
                ?.trim()
                .orEmpty()
            val excerpt = when {
                normalizedMarkdown.isNotBlank() -> normalizedMarkdown
                normalizedHtml.isNotBlank() -> normalizedHtml
                else -> firstJsonString(itemBody, "excerpt", "summary").orEmpty()
            }
            val title = rawTitle.ifBlank {
                excerpt.lineSequence().map { it.trim() }.firstOrNull { it.isNotBlank() }?.take(90).orEmpty()
            }.ifBlank { "제목 없음" }

            val attachedFiles = jsonArray(itemBody, "attachedFiles")
                ?.let(::splitObjects)
                ?.mapNotNull { entry -> firstJsonString(entry, "fileUrl", "url", "fileKey") }
                .orEmpty()
            val parsedImages = jsonStringArray(itemBody, "images")
            val markdownImages = extractMarkdownImageUrls(contentMarkdown)
            val htmlImages = extractHtmlImageUrls(contentHtml)
            val imageCandidates = (parsedImages + attachedFiles + markdownImages + htmlImages)
                .mapNotNull(::resolveMediaUrl)
                .distinct()

            FeedItem(
                postId = firstJsonString(itemBody, "id") ?: "",
                slug = firstJsonString(itemBody, "slug") ?: "",
                title = title,
                excerpt = excerpt,
                authorName = firstJsonString(authorObject, "username", "name", "displayName") ?: "Unknown",
                authorProfileImage = resolveMediaUrl(
                    firstJsonString(authorObject, "profileImage", "profileImageUrl", "avatarUrl"),
                ),
                sourceType = "community",
                blogSlug = null,
                blogAlias = null,
                communitySlug = communitySlug,
                likeCount = firstJsonInt(itemBody, "upvoteCount", "likeCount", "score") ?: 0,
                commentCount = firstJsonInt(itemBody, "commentCount", "commentsCount", "repliesCount") ?: 0,
                viewCount = firstJsonInt(itemBody, "viewCount", "viewsCount") ?: 0,
                upvoteCount = firstJsonInt(itemBody, "upvoteCount", "likeCount", "score") ?: 0,
                downvoteCount = firstJsonInt(itemBody, "downvoteCount") ?: 0,
                score = firstJsonInt(itemBody, "score", "upvoteCount", "likeCount") ?: 0,
                liked = firstJsonBoolean(itemBody, "liked", "userLiked") ?: (firstJsonString(itemBody, "userVote") == "upvote"),
                userVote = firstJsonString(itemBody, "userVote"),
                thumbnail = resolveMediaUrl(firstJsonString(itemBody, "thumbnail", "thumbnailUrl"))
                    ?: imageCandidates.firstOrNull(),
                images = imageCandidates,
                createdAtEpochSeconds = parseEpochSeconds(firstJsonString(itemBody, "createdAt")) ?: 0L,
            )
        }.filter { it.postId.isNotBlank() }

        val nextCursor = jsonNullableString(payload, "nextCursor")
        return FeedPage(
            items = items,
            nextCursor = nextCursor,
            hasMore = firstJsonBoolean(payload, "hasNext", "hasMore") ?: !nextCursor.isNullOrBlank(),
            nextCursorId = jsonNullableString(payload, "nextCursorId"),
        )
    }

    private fun parsePostDetail(
        body: String,
        sourceType: String,
        fallbackPostId: String,
        fallbackSlug: String,
        fallbackCommunitySlug: String?,
    ): PostDetail {
        val payload = unwrapDataObject(body)
        val authorObject = jsonObject(payload, "author") ?: "{}"
        val authorProfileObject = jsonObject(authorObject, "profile") ?: "{}"
        val contentMarkdown = firstJsonString(payload, "content_markdown", "contentMarkdown")
        val contentHtml = firstJsonString(payload, "content")
        val normalizedMarkdown = contentMarkdown?.let(::stripMarkdownPreview).orEmpty()
        val normalizedHtml = contentHtml?.let(::stripHtml).orEmpty()
        val contentText = when {
            normalizedMarkdown.isNotBlank() -> normalizedMarkdown
            normalizedHtml.isNotBlank() -> normalizedHtml
            else -> ""
        }

        val attachedFiles = jsonArray(payload, "attachedFiles")
            ?.let(::splitObjects)
            ?.mapNotNull { entry -> firstJsonString(entry, "fileUrl", "url", "fileKey") }
            .orEmpty()
        val parsedImages = jsonStringArray(payload, "images")
        val markdownImages = extractMarkdownImageUrls(contentMarkdown)
        val htmlImages = extractHtmlImageUrls(contentHtml)
        val imageCandidates = (parsedImages + attachedFiles + listOfNotNull(firstJsonString(payload, "thumbnail")))
            .plus(markdownImages)
            .plus(htmlImages)
            .mapNotNull(::resolveMediaUrl)
            .distinct()

        val createdAtEpoch = parseEpochSeconds(firstJsonString(payload, "createdAt")) ?: 0L
        return PostDetail(
            postId = firstJsonString(payload, "id") ?: fallbackPostId,
            slug = firstJsonString(payload, "slug") ?: fallbackSlug,
            sourceType = sourceType,
            communitySlug = fallbackCommunitySlug
                ?: firstJsonString(jsonObject(payload, "community") ?: "", "slug"),
            title = firstJsonString(payload, "title") ?: "",
            contentText = contentText,
            contentHtml = contentHtml,
            authorName = firstJsonString(authorObject, "username", "name", "displayName") ?: "Unknown",
            authorProfileImage = resolveMediaUrl(
                firstJsonString(authorObject, "profileImage", "avatarUrl")
                    ?: firstJsonString(authorProfileObject, "profileImage", "avatarUrl"),
            ),
            likeCount = firstJsonInt(payload, "likeCount", "upvoteCount") ?: 0,
            commentCount = firstJsonInt(payload, "commentCount") ?: 0,
            viewCount = firstJsonInt(payload, "viewCount") ?: 0,
            liked = firstJsonBoolean(payload, "liked") ?: (firstJsonString(payload, "userVote") == "upvote"),
            images = imageCandidates,
            createdAtEpochSeconds = createdAtEpoch,
        )
    }

    private fun parseCommentPage(body: String): CommentPage {
        val payload = unwrapDataObject(body)
        val commentsArray = jsonArray(payload, "comments")
            ?: jsonArray(payload, "allComments")
            ?: "[]"
        val comments = splitObjects(commentsArray)
            .map { parseComment(it) }

        val nextCursor = jsonNullableString(payload, "nextCursor")
        val hasMore = firstJsonBoolean(payload, "hasNextPage", "hasMore") ?: (nextCursor != null)
        val snapshotTimestamp = firstJsonString(payload, "snapshotTimestamp")
        return CommentPage(
            comments = comments,
            nextCursor = nextCursor,
            hasMore = hasMore,
            snapshotTimestamp = snapshotTimestamp,
        )
    }

    private fun parseSingleComment(
        body: String,
        fallbackContent: String,
        fallbackCommentId: String,
    ): PostComment {
        val payload = unwrapDataObject(body)
        return parseComment(payload, fallbackContent, fallbackCommentId)
    }

    private fun parseComment(
        body: String,
        fallbackContent: String = "",
        fallbackCommentId: String = "",
    ): PostComment {
        val payload = unwrapDataObject(body)
        val authorObject = jsonObject(payload, "author") ?: "{}"
        val profileObject = jsonObject(authorObject, "profile") ?: "{}"
        return PostComment(
            commentId = firstJsonString(payload, "id") ?: fallbackCommentId,
            parentCommentId = jsonNullableString(payload, "parentCommentId"),
            content = firstJsonString(payload, "content") ?: fallbackContent,
            authorName = firstJsonString(authorObject, "username", "name", "displayName") ?: "Unknown",
            authorProfileImage = resolveMediaUrl(
                firstJsonString(authorObject, "profileImage", "avatarUrl")
                    ?: firstJsonString(profileObject, "profileImage", "avatarUrl"),
            ),
            likeCount = firstJsonInt(payload, "likesCount", "likeCount") ?: 0,
            replyCount = firstJsonInt(payload, "repliesCount", "replyCount") ?: 0,
            liked = firstJsonBoolean(payload, "userLiked", "liked") ?: false,
            createdAtEpochSeconds = parseEpochSeconds(firstJsonString(payload, "createdAt")) ?: 0L,
        )
    }

    private fun parseCommunityPage(body: String): CommunityPage {
        val payload = unwrapDataObject(body)
        val itemsArray = requireJsonArray(payload, "items")
        val items = splitObjects(itemsArray).map { itemBody ->
            CommunityItem(
                communityId = requireJsonString(itemBody, "id"),
                name = requireJsonString(itemBody, "name"),
                slug = requireJsonString(itemBody, "slug"),
                iconUrl = resolveMediaUrl(firstJsonString(itemBody, "iconUrl", "icon")),
                memberCount = firstJsonInt(itemBody, "memberCount", "membersCount") ?: 0,
                joined = firstJsonBoolean(itemBody, "isJoined", "joined") ?: false,
            )
        }
        return CommunityPage(
            items = items,
            nextCursor = jsonNullableString(payload, "nextCursor"),
            hasMore = firstJsonBoolean(payload, "hasNext", "hasMore") ?: false,
            nextCursorId = jsonNullableString(payload, "nextCursorId"),
        )
    }

    private fun extractFailureMessage(response: HttpResponse): String {
        val fallback = if (response.body.isBlank()) "request failed" else response.body
        val body = response.body.takeIf { it.isNotBlank() } ?: return fallback
        return jsonString(body, "message")
            ?: jsonString(body, "error")
            ?: fallback
    }

    private fun unwrapDataObject(body: String): String {
        return jsonObject(body, "data") ?: body
    }

    private fun resolveMediaUrl(raw: String?): String? {
        val value = raw?.trim().orEmpty()
        if (value.isBlank()) return null
        if (value.startsWith("http://") || value.startsWith("https://")) return value

        val path = value.removePrefix("/")
        return when {
            path.startsWith("uploads/") -> "$cdnRoot/$path"
            path.startsWith("character/") -> "$cdnRoot/$path"
            path.startsWith("v2/") -> "$cdnRoot/$path"
            value.startsWith("/api/v1/") -> "$backendRoot$value"
            value.startsWith("/files/") -> "$backendRoot$value"
            else -> "$cdnRoot/$path"
        }
    }

    private fun stripHtml(html: String): String {
        return html
            .replace(Regex("<br\\s*/?>", RegexOption.IGNORE_CASE), "\n")
            .replace(Regex("</p>", RegexOption.IGNORE_CASE), "\n")
            .replace(Regex("<[^>]+>"), "")
            .replace(Regex("&nbsp;"), " ")
            .replace(Regex("&amp;"), "&")
            .replace(Regex("&lt;"), "<")
            .replace(Regex("&gt;"), ">")
            .replace(Regex("\\n{3,}"), "\n\n")
            .trim()
    }

    private fun stripMarkdownPreview(markdown: String): String {
        return markdown
            .replace(Regex("!\\[[^\\]]*\\]\\(([^\\)]+)\\)"), "")
            .replace(Regex("\\[([^\\]]+)\\]\\(([^\\)]+)\\)"), "$1")
            .replace(Regex("https?://\\S+"), "")
            .replace(Regex("\\s{2,}"), " ")
            .trim()
    }

    private fun extractMarkdownImageUrls(markdown: String?): List<String> {
        if (markdown.isNullOrBlank()) return emptyList()
        return Regex("!\\[[^\\]]*\\]\\(([^\\)]+)\\)")
            .findAll(markdown)
            .mapNotNull { it.groupValues.getOrNull(1)?.trim() }
            .filter { it.isNotBlank() }
            .toList()
    }

    private fun extractHtmlImageUrls(html: String?): List<String> {
        if (html.isNullOrBlank()) return emptyList()
        return Regex("<img[^>]+src\\s*=\\s*\"([^\"]+)\"", RegexOption.IGNORE_CASE)
            .findAll(html)
            .mapNotNull { it.groupValues.getOrNull(1)?.trim() }
            .filter { it.isNotBlank() }
            .toList()
    }

    private fun parseEpochSeconds(isoTime: String?): Long? {
        if (isoTime.isNullOrBlank()) return null
        return runCatching { Instant.parse(isoTime).epochSecond }.getOrNull()
    }

    private fun requireJsonString(body: String, key: String): String {
        return jsonString(body, key)
            ?: throw IllegalStateException("missing '$key' in response body")
    }

    private fun firstJsonString(body: String, vararg keys: String): String? {
        for (key in keys) {
            jsonString(body, key)?.let { return it }
        }
        return null
    }

    private fun firstJsonBoolean(body: String, vararg keys: String): Boolean? {
        for (key in keys) {
            jsonBoolean(body, key)?.let { return it }
        }
        return null
    }

    private fun firstJsonInt(body: String, vararg keys: String): Int? {
        for (key in keys) {
            jsonInt(body, key)?.let { return it }
        }
        return null
    }

    private fun requireJsonArray(body: String, key: String): String {
        return jsonArray(body, key)
            ?: throw IllegalStateException("missing '$key' array in response body")
    }

    private fun jsonString(body: String, key: String): String? {
        val pattern = Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"")
        return pattern.find(body)?.groupValues?.get(1)
    }

    private fun jsonStringArray(body: String, key: String): List<String> {
        val arrayBody = jsonArray(body, key) ?: return emptyList()
        return Regex("\"([^\"]+)\"")
            .findAll(arrayBody)
            .map { it.groupValues[1] }
            .toList()
    }

    private fun jsonNullableString(body: String, key: String): String? {
        val nullPattern = Regex("\"$key\"\\s*:\\s*null")
        if (nullPattern.containsMatchIn(body)) {
            return null
        }
        return jsonString(body, key)
    }

    private fun jsonBoolean(body: String, key: String): Boolean? {
        val pattern = Regex("\"$key\"\\s*:\\s*(true|false)")
        return pattern.find(body)?.groupValues?.get(1)?.toBoolean()
    }

    private fun jsonInt(body: String, key: String): Int? {
        val pattern = Regex("\"$key\"\\s*:\\s*(-?\\d+)")
        return pattern.find(body)?.groupValues?.get(1)?.toIntOrNull()
    }

    private fun jsonObject(body: String, key: String): String? {
        val startMatch = Regex("\"$key\"\\s*:\\s*\\{").find(body) ?: return null
        var index = startMatch.range.last + 1
        var depth = 1
        while (index < body.length && depth > 0) {
            val current = body[index]
            if (current == '{') depth += 1
            if (current == '}') depth -= 1
            index += 1
        }
        if (depth != 0) return null
        return body.substring(startMatch.range.last + 1, index)
    }

    private fun jsonArray(body: String, key: String): String? {
        val startMatch = Regex("\"$key\"\\s*:\\s*\\[").find(body) ?: return null
        var index = startMatch.range.last + 1
        var depth = 1
        while (index < body.length && depth > 0) {
            val current = body[index]
            if (current == '[') depth += 1
            if (current == ']') depth -= 1
            index += 1
        }
        if (depth != 0) return null
        return body.substring(startMatch.range.last + 1, index - 1)
    }

    private fun splitObjects(arrayBody: String): List<String> {
        val objects = mutableListOf<String>()
        var objectStart = -1
        var depth = 0
        arrayBody.forEachIndexed { index, ch ->
            if (ch == '{') {
                if (depth == 0) {
                    objectStart = index
                }
                depth += 1
            } else if (ch == '}') {
                depth -= 1
                if (depth == 0 && objectStart >= 0) {
                    objects += arrayBody.substring(objectStart, index + 1)
                    objectStart = -1
                }
            }
        }
        return objects
    }

    private fun escapeJson(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
    }

    private fun encodePath(value: String): String {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20")
    }

    private fun encodeQuery(value: String): String {
        return URLEncoder.encode(value, StandardCharsets.UTF_8)
    }
}
