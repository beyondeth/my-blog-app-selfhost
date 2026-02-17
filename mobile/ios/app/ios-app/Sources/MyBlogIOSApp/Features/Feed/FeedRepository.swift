import Foundation

struct CommentPage {
    let items: [PostComment]
    let nextCursor: String?
    let hasMore: Bool
    let snapshotTimestamp: String?

    init(
        items: [PostComment],
        nextCursor: String?,
        hasMore: Bool,
        snapshotTimestamp: String? = nil
    ) {
        self.items = items
        self.nextCursor = nextCursor
        self.hasMore = hasMore
        self.snapshotTimestamp = snapshotTimestamp
    }
}

actor FeedRepository {
    private let client: APIClient
    private let feedPath = "/feed"
    private let postsPath = "/posts"
    private let filesPath = "/files"
    private let communityPostsPath = "/community"
    private let commentsPath = "/posts"
    private let commentsLegacyPath = "/comments/post"
    private var detailCache: [String: MobilePost] = [:]
    private var detailInFlightTasks: [String: Task<MobilePost, Error>] = [:]

    init(client: APIClient) {
        self.client = client
    }

    func fetchFeed(cursor: String?, limit: Int = 20) async throws -> FeedResponse {
        var query = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor {
            query.append(URLQueryItem(name: "cursor", value: cursor))
        }
        let req = EndpointRequest(path: feedPath, method: .get, query: query)
        return try await client.request(req, as: FeedResponse.self)
    }

    func fetchPostDetail(id: String) async throws -> MobilePost {
        let key = "blog:\(id)"

        if let cached = detailCache[key] {
            return cached
        }

        if let inFlight = detailInFlightTasks[key] {
            return try await inFlight.value
        }

        let requestTask = Task<MobilePost, Error> {
            let req = EndpointRequest(path: "\(postsPath)/\(id)")
            return try await client.request(
                req,
                as: MobilePost.self,
                requiresAuthentication: false,
            )
        }

        detailInFlightTasks[key] = requestTask
        defer { detailInFlightTasks[key] = nil }

        let post = try await requestTask.value
        detailCache[key] = post
        return post
    }

    private func encodedPathComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }

    func prefetchPostDetail(id: String) async {
        _ = try? await fetchPostDetail(id: id)
    }

    func createPost(
        title: String,
        content: String,
        category: String,
        isPublished: Bool,
        contentMarkdown: String? = nil,
        attachedFileIds: [String] = [],
        thumbnailImageId: String? = nil,
    ) async throws -> MobilePost {
        let payload = MobilePostCreatePayload(
            title: title,
            content: content,
            content_markdown: contentMarkdown ?? content,
            category: category,
            isPublished: isPublished,
            attachedFileIds: attachedFileIds.isEmpty ? nil : attachedFileIds,
            thumbnailImageId: thumbnailImageId,
        )
        let req = EndpointRequest(
            path: postsPath,
            method: .post,
            body: try JSONEncoder().encode(payload),
        )
        return try await client.request(req, as: MobilePost.self)
    }

    func uploadPostImage(
        fileData: Data,
        fileName: String,
        mimeType: String,
    ) async throws -> MobileUploadedFile {
        let uploadUrlReq = EndpointRequest(
            path: "\(filesPath)/upload-url",
            method: .post,
            body: try JSONEncoder().encode(
                MobileCreateUploadUrlPayload(
                    fileName: fileName,
                    mimeType: mimeType,
                    fileSize: fileData.count,
                    fileType: "image",
                )
            ),
        )

        let uploadUrlResponse = try await client.request(uploadUrlReq, as: MobileCreateUploadUrlResponse.self)
        let resolvedFileKey = uploadUrlResponse.fileKey ?? uploadUrlResponse.s3Key
        guard let fileKey = resolvedFileKey, !fileKey.isEmpty else {
            throw APIError(
                code: "MISSING_FILE_KEY",
                message: "업로드 키를 받지 못했습니다.",
                status: 500,
                type: .server,
            )
        }

        try await uploadToPresignedURL(
            uploadUrl: uploadUrlResponse.uploadUrl,
            payload: fileData,
            mimeType: mimeType,
        )

        let completeReq = EndpointRequest(
            path: "\(filesPath)/upload-complete",
            method: .post,
            body: try JSONEncoder().encode(
                MobileUploadCompletePayload(
                    fileKey: fileKey,
                    fileUrl: makeFileURL(fileKey: fileKey, uploadUrl: uploadUrlResponse.uploadUrl),
                    fileName: fileName,
                    mimeType: mimeType,
                    fileSize: fileData.count,
                    fileType: "image",
                )
            ),
        )

        return try await client.request(completeReq, as: MobileUploadedFile.self)
    }

    func deleteUploadedFile(fileId: String) async throws {
        let safeFileId = encodedPathComponent(fileId)
        let req = EndpointRequest(path: "\(filesPath)/\(safeFileId)", method: .delete)
        try await client.requestVoid(req)
    }

    func votePost(postId: String, type: MobileVoteType) async throws -> MobilePostVoteResponse {
        let req = EndpointRequest(
            path: "\(postsPath)/\(postId)/vote",
            method: .post,
            body: try JSONEncoder().encode(MobilePostVotePayload(type: type)),
        )
        return try await client.request(req, as: MobilePostVoteResponse.self)
    }

    func deletePost(postId: String) async throws {
        let safePostId = encodedPathComponent(postId)
        let req = EndpointRequest(
            path: "\(postsPath)/\(safePostId)",
            method: .delete,
        )
        try await client.requestVoid(req)
    }

    func reportPost(
        postId: String,
        communityId: String? = nil,
        description: String? = nil,
    ) async throws {
        let payload = MobilePostReportPayload(
            type: "post",
            reason: "other",
            description: description,
            targetId: postId,
            communityId: communityId,
            metadata: ["source": "ios_feed_menu"],
        )
        let req = EndpointRequest(
            path: "/reports",
            method: .post,
            body: try JSONEncoder().encode(payload),
        )
        try await client.requestVoid(req)
    }

    func fetchPostComments(
        postId: String,
        limit: Int = 20,
        cursor: String? = nil,
    ) async throws -> [PostComment] {
        let page = try await fetchPostCommentsPage(
            postId: postId,
            limit: limit,
            cursor: cursor,
        )
        return page.items
    }

    func fetchPostCommentsPage(
        postId: String,
        limit: Int = 10,
        cursor: String? = nil,
    ) async throws -> CommentPage {
        let safePostId = encodedPathComponent(postId)
        var query = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor, !cursor.isEmpty {
            query.append(URLQueryItem(name: "cursor", value: cursor))
        }
        let req = EndpointRequest(path: "\(postsPath)/\(safePostId)/comments", query: query)
        do {
            let comments = try await client.request(
                req,
                as: [PostComment].self,
                requiresAuthentication: false,
            )
            return CommentPage(
                items: comments,
                nextCursor: nil,
                hasMore: comments.count >= limit,
                snapshotTimestamp: nil
            )
        } catch {
            var legacyQuery = [URLQueryItem(name: "limit", value: String(limit))]
            if let cursor, !cursor.isEmpty {
                legacyQuery.append(URLQueryItem(name: "cursor", value: cursor))
            }
            let legacyReq = EndpointRequest(
                path: "\(commentsLegacyPath)/\(safePostId)/paginated",
                query: legacyQuery,
            )
            let response = try await client.request(
                legacyReq,
                as: LegacyPostCommentsResponse.self,
                requiresAuthentication: false,
            )
            return CommentPage(
                items: response.allComments,
                nextCursor: response.nextCursor,
                hasMore: response.hasNextPage ?? (response.nextCursor != nil),
                snapshotTimestamp: response.snapshotTimestamp
            )
        }
    }

    func fetchBlogParentCommentsPage(
        postId: String,
        sort: CommentSort = .popular,
        limit: Int = 10,
        cursor: String? = nil,
        snapshotTimestamp: String? = nil,
    ) async throws -> CommentPage {
        let safePostId = encodedPathComponent(postId)
        var query = [
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "sort", value: sort.rawValue),
        ]
        if let cursor, !cursor.isEmpty {
            query.append(URLQueryItem(name: "cursor", value: cursor))
        }
        if sort == .popular, let snapshotTimestamp, !snapshotTimestamp.isEmpty {
            query.append(URLQueryItem(name: "snapshotTimestamp", value: snapshotTimestamp))
        }
        let req = EndpointRequest(
            path: "/comments/post/\(safePostId)/paginated",
            query: query,
        )
        let response = try await client.request(
            req,
            as: LegacyPostCommentsResponse.self,
            requiresAuthentication: false,
        )
        return CommentPage(
            items: response.allComments,
            nextCursor: response.nextCursor,
            hasMore: response.hasNextPage ?? (response.nextCursor != nil),
            snapshotTimestamp: response.snapshotTimestamp
        )
    }

    func fetchBlogRepliesPage(
        parentCommentId: String,
        limit: Int = 10,
        cursor: String? = nil,
    ) async throws -> CommentPage {
        let safeParentCommentId = encodedPathComponent(parentCommentId)
        var query = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor, !cursor.isEmpty {
            query.append(URLQueryItem(name: "cursor", value: cursor))
        }
        let req = EndpointRequest(
            path: "/comments/\(safeParentCommentId)/replies",
            query: query,
        )
        let response = try await client.request(
            req,
            as: LegacyPostCommentsResponse.self,
            requiresAuthentication: false,
        )
        return CommentPage(
            items: response.allComments,
            nextCursor: response.nextCursor,
            hasMore: response.hasNextPage ?? (response.nextCursor != nil),
            snapshotTimestamp: nil
        )
    }

    func fetchCommunityPost(
        communitySlug: String,
        postId: String,
        postSlug: String?,
    ) async throws -> MobilePost {
        let cacheKey = "community:\(communitySlug):\(postId):\(postSlug ?? "")"
        if let cached = detailCache[cacheKey] {
            return cached
        }
        let safeCommunitySlug = encodedPathComponent(communitySlug)
        let safePostId = encodedPathComponent(postId)
        let trimmedPostSlug = postSlug?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let requestPrefix = "community:\(communitySlug)/\(postId)"

        if !trimmedPostSlug.isEmpty {
            let safePostSlug = encodedPathComponent(trimmedPostSlug)
            let primaryReq = EndpointRequest(
                path: "\(communityPostsPath)/\(safeCommunitySlug)/posts/\(safePostSlug)",
            )
            IOSRunTrace.emit(
                "community_post.request",
                category: "feed",
                fields: [
                    "target": "primary_slug",
                    "context": requestPrefix,
                    "path": primaryReq.path,
                ],
            )
            do {
                let response = try await client.request(
                    primaryReq,
                    as: CommunityPostEnvelope.self,
                    requiresAuthentication: false,
                )
                guard let post = response.data else {
                    throw APIError(
                        code: "EMPTY_COMMUNITY_POST_RESPONSE",
                        message: "커뮤니티 게시물 응답이 비어있습니다.",
                        status: 500,
                        type: .badRequest,
                    )
                }
                IOSRunTrace.emit(
                    "community_post.success",
                    category: "feed",
                    fields: [
                        "target": "primary_slug",
                        "context": requestPrefix,
                    ],
                )
                let resolved = post.toMobilePost()
                detailCache[cacheKey] = resolved
                return resolved
            } catch {
                IOSRunTrace.emit(
                    "community_post.failed",
                    category: "feed",
                    fields: [
                        "target": "primary_slug",
                        "context": requestPrefix,
                        "error": "\(error)",
                    ],
                )
                let fallbackReq = EndpointRequest(
                    path: "\(communityPostsPath)/\(safeCommunitySlug)/comments/\(safePostSlug)",
                )
                IOSRunTrace.emit(
                    "community_post.request",
                    category: "feed",
                    fields: [
                        "target": "comment_slug_fallback",
                        "context": requestPrefix,
                        "path": fallbackReq.path,
                    ],
                )
                if let response = try? await client.request(
                    fallbackReq,
                    as: CommunityPostEnvelope.self,
                    requiresAuthentication: false,
                ), let post = response.data {
                    IOSRunTrace.emit(
                        "community_post.success",
                        category: "feed",
                        fields: [
                            "target": "comment_slug_fallback",
                            "context": requestPrefix,
                        ],
                    )
                    let resolved = post.toMobilePost()
                    detailCache[cacheKey] = resolved
                    return resolved
                }
                IOSRunTrace.emit(
                    "community_post.failed",
                    category: "feed",
                    fields: [
                        "target": "comment_slug_fallback",
                        "context": requestPrefix,
                    ],
                )
            }
        }

        let fallbackReq = EndpointRequest(
            path: "\(communityPostsPath)/\(safeCommunitySlug)/posts/id/\(safePostId)",
        )
        IOSRunTrace.emit(
            "community_post.request",
            category: "feed",
            fields: [
                "target": "fallback_id",
                "context": requestPrefix,
                "path": fallbackReq.path,
            ],
        )
        let response = try await client.request(
            fallbackReq,
            as: CommunityPostEnvelope.self,
            requiresAuthentication: false,
        )
        guard let post = response.data else {
            throw APIError(
                code: "EMPTY_COMMUNITY_POST_RESPONSE",
                message: "커뮤니티 게시물 응답이 비어있습니다.",
                status: 500,
                type: .badRequest,
            )
        }
        IOSRunTrace.emit(
            "community_post.success",
            category: "feed",
            fields: [
                "target": "fallback_id",
                "context": requestPrefix,
            ],
        )
        let resolved = post.toMobilePost()
        detailCache[cacheKey] = resolved
        return resolved
    }

    func prefetchCommunityPost(
        communitySlug: String,
        postId: String,
        postSlug: String?,
    ) async {
        _ = try? await fetchCommunityPost(
            communitySlug: communitySlug,
            postId: postId,
            postSlug: postSlug,
        )
    }

    private func uploadToPresignedURL(
        uploadUrl: String,
        payload: Data,
        mimeType: String,
    ) async throws {
        guard let url = URL(string: uploadUrl) else {
            throw APIError(
                code: "INVALID_UPLOAD_URL",
                message: "유효하지 않은 업로드 URL 입니다.",
                status: -1,
                type: .badRequest,
            )
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        request.httpBody = payload

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError(
                code: "UPLOAD_FAILED",
                message: "이미지 업로드에 실패했습니다.",
                status: (response as? HTTPURLResponse)?.statusCode ?? -1,
                type: .network,
            )
        }
    }

    private func makeFileURL(fileKey: String, uploadUrl: String) -> String {
        guard let url = URL(string: uploadUrl),
              let scheme = url.scheme,
              let host = url.host
        else {
            return fileKey
        }

        let basePath = url.path
        let path = basePath.isEmpty ? "/\(fileKey)" : basePath
        return "\(scheme)://\(host)\(path)"
    }

    func fetchCommunityPostComments(
        communitySlug: String,
        postId: String,
        limit: Int = 20,
        cursor: String? = nil,
    ) async throws -> [PostComment] {
        let page = try await fetchCommunityPostCommentsPage(
            communitySlug: communitySlug,
            postId: postId,
            limit: limit,
            cursor: cursor,
        )
        return page.items
    }

    func fetchCommunityPostCommentsPage(
        communitySlug: String,
        postId: String,
        sort: CommentSort = .popular,
        limit: Int = 10,
        cursor: String? = nil,
        snapshotTimestamp: String? = nil,
    ) async throws -> CommentPage {
        let safeCommunitySlug = encodedPathComponent(communitySlug)
        let safePostId = encodedPathComponent(postId)
        let postPath = "\(communityPostsPath)/\(safeCommunitySlug)/posts/\(safePostId)/comments/paginated"
        let commentPath = "\(communityPostsPath)/\(safeCommunitySlug)/comments/\(safePostId)/comments/paginated"

        let requestTargets = [postPath, commentPath]

        for targetPath in requestTargets {
            IOSRunTrace.emit(
                "community_comments.request",
                category: "feed",
                fields: [
                    "path": targetPath,
                    "community": communitySlug,
                    "postId": postId,
                ],
            )
            let req = EndpointRequest(
                path: targetPath,
                query: {
                    var query = [URLQueryItem(name: "limit", value: String(limit))]
                    query.append(URLQueryItem(name: "sort", value: sort.rawValue))
                    if let cursor, !cursor.isEmpty {
                        query.append(URLQueryItem(name: "cursor", value: cursor))
                    }
                    if sort == .popular, let snapshotTimestamp, !snapshotTimestamp.isEmpty {
                        query.append(URLQueryItem(name: "snapshotTimestamp", value: snapshotTimestamp))
                    }
                    return query
                }(),
            )
            do {
                let response = try await client.request(
                    req,
                    as: CommunityCommentsEnvelope.self,
                    requiresAuthentication: false,
                )
                if let comments = response.data?.allComments {
                    IOSRunTrace.emit(
                        "community_comments.success",
                        category: "feed",
                        fields: [
                            "path": targetPath,
                            "community": communitySlug,
                            "count": "\(comments.count)",
                        ],
                    )
                    return CommentPage(
                        items: comments,
                        nextCursor: response.data?.nextCursor,
                        hasMore: response.data?.hasNextPage ?? (response.data?.nextCursor != nil),
                        snapshotTimestamp: response.data?.snapshotTimestamp
                    )
                }
            } catch {
                IOSRunTrace.emit(
                    "community_comments.failed",
                    category: "feed",
                    fields: ["path": targetPath, "community": communitySlug, "error": "\(error)"],
                )
                continue
            }
        }

        return CommentPage(items: [], nextCursor: nil, hasMore: false, snapshotTimestamp: nil)
    }

    func fetchCommunityRepliesPage(
        communitySlug: String,
        postId: String,
        parentCommentId: String,
        limit: Int = 10,
        cursor: String? = nil,
    ) async throws -> CommentPage {
        let safeCommunitySlug = encodedPathComponent(communitySlug)
        let safePostId = encodedPathComponent(postId)
        let safeParentCommentId = encodedPathComponent(parentCommentId)
        var query = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor, !cursor.isEmpty {
            query.append(URLQueryItem(name: "cursor", value: cursor))
        }

        let req = EndpointRequest(
            path: "\(communityPostsPath)/\(safeCommunitySlug)/posts/\(safePostId)/comments/\(safeParentCommentId)/replies",
            query: query,
        )
        let response = try await client.request(
            req,
            as: CommunityCommentsEnvelope.self,
            requiresAuthentication: false,
        )
        return CommentPage(
            items: response.data?.allComments ?? [],
            nextCursor: response.data?.nextCursor,
            hasMore: response.data?.hasNextPage ?? (response.data?.nextCursor != nil),
            snapshotTimestamp: nil
        )
    }

    func createPostComment(
        postId: String,
        content: String,
        parentCommentId: String? = nil,
    ) async throws -> PostComment {
        let payload = MobilePostCommentCreatePayload(
            content: content,
            parentCommentId: parentCommentId,
        )
        let req = EndpointRequest(
            path: "\(commentsPath)/\(postId)/comments",
            method: .post,
            body: try JSONEncoder().encode(payload),
        )
        return try await client.request(req, as: PostComment.self)
    }

    func createCommunityPostComment(
        communitySlug: String,
        postId: String,
        content: String,
        parentCommentId: String? = nil,
    ) async throws -> PostComment {
        let payload = MobilePostCommentCreatePayload(
            content: content,
            parentCommentId: parentCommentId,
        )
        let safeCommunitySlug = encodedPathComponent(communitySlug)
        let safePostId = encodedPathComponent(postId)
        let req = EndpointRequest(
            path: "\(communityPostsPath)/\(safeCommunitySlug)/posts/\(safePostId)/comments",
            method: .post,
            body: try JSONEncoder().encode(payload),
        )
        let response = try await client.request(req, as: CommunityCommentEnvelope.self)
        guard let comment = response.data else {
            throw APIError(
                code: "EMPTY_COMMUNITY_COMMENT_RESPONSE",
                message: "댓글 작성 응답이 비어있습니다.",
                status: 500,
                type: .badRequest,
            )
        }
        return comment
    }

    func toggleBlogCommentLike(commentId: String) async throws -> CommentReactionResult {
        let safeCommentId = encodedPathComponent(commentId)
        let req = EndpointRequest(path: "/comments/\(safeCommentId)/like", method: .post)
        return try await client.request(req, as: CommentReactionResult.self)
    }

    func toggleCommunityCommentLike(
        communitySlug: String,
        postId: String,
        commentId: String,
    ) async throws -> CommentReactionResult {
        let safeCommunitySlug = encodedPathComponent(communitySlug)
        let safePostId = encodedPathComponent(postId)
        let safeCommentId = encodedPathComponent(commentId)
        let req = EndpointRequest(
            path: "\(communityPostsPath)/\(safeCommunitySlug)/posts/\(safePostId)/comments/\(safeCommentId)/like",
            method: .post,
        )
        let envelope = try await client.request(req, as: CommunityCommentReactionEnvelope.self)
        return envelope.data ?? CommentReactionResult(liked: nil, likesCount: nil, dislikesCount: nil)
    }

    func toggleBlogCommentDislike(commentId: String) async throws -> CommentReactionResult {
        let safeCommentId = encodedPathComponent(commentId)
        let req = EndpointRequest(path: "/comments/\(safeCommentId)/dislike", method: .post)
        return try await client.request(req, as: CommentReactionResult.self)
    }

    func toggleCommunityCommentDislike(
        communitySlug: String,
        postId: String,
        commentId: String,
    ) async throws -> CommentReactionResult {
        let safeCommunitySlug = encodedPathComponent(communitySlug)
        let safePostId = encodedPathComponent(postId)
        let safeCommentId = encodedPathComponent(commentId)
        let req = EndpointRequest(
            path: "\(communityPostsPath)/\(safeCommunitySlug)/posts/\(safePostId)/comments/\(safeCommentId)/dislike",
            method: .post,
        )
        let envelope = try await client.request(req, as: CommunityCommentReactionEnvelope.self)
        return envelope.data ?? CommentReactionResult(liked: nil, likesCount: nil, dislikesCount: nil)
    }

    func voteCommunityPost(
        communitySlug: String,
        postId: String,
        type: MobileVoteType,
    ) async throws -> MobilePostVoteResponse {
        let safeCommunitySlug = encodedPathComponent(communitySlug)
        let safePostId = encodedPathComponent(postId)
        let req = EndpointRequest(
            path: "\(communityPostsPath)/\(safeCommunitySlug)/posts/\(safePostId)/vote",
            method: .post,
            body: try JSONEncoder().encode(MobilePostVotePayload(type: type)),
        )
        return try await client.request(req, as: MobilePostVoteResponse.self)
    }

    func deleteCommunityPost(
        communitySlug: String,
        postId: String,
    ) async throws {
        let safeCommunitySlug = encodedPathComponent(communitySlug)
        let safePostId = encodedPathComponent(postId)
        let req = EndpointRequest(
            path: "\(communityPostsPath)/\(safeCommunitySlug)/posts/\(safePostId)",
            method: .delete,
        )
        try await client.requestVoid(req)
    }

    func incrementPostViewCount(postId: String) async throws -> VoidResponse {
        let req = EndpointRequest(path: "\(postsPath)/\(postId)/view", method: .post)
        return try await client.request(req, as: VoidResponse.self)
    }
}

struct MobilePostVotePayload: Encodable {
    let type: MobileVoteType
}

private struct MobilePostReportPayload: Encodable {
    let type: String
    let reason: String
    let description: String?
    let targetId: String
    let communityId: String?
    let metadata: [String: String]?
}
