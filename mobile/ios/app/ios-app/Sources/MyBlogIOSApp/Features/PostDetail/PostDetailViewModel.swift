import Foundation

@MainActor
final class PostDetailViewModel: ObservableObject {
    struct ReplyTarget: Equatable {
        let commentId: String
        let rootCommentId: String
        let username: String?
    }

    enum ReplyDraftMode: Equatable {
        case comment
        case reply
    }

    @Published var post: MobilePost?
    @Published var comments: [PostComment] = []
    @Published var isLoading = false
    @Published var isCommentsLoading = false
    @Published var isLoadingMoreComments = false
    @Published var canLoadMoreComments = false
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    @Published var selectedCommentSort: CommentSort = .popular
    @Published var activeReplyTarget: ReplyTarget?
    @Published var replyDraftMode: ReplyDraftMode = .comment
    @Published var isComposerExpanded = false
    @Published var expandedCommentIDs: Set<String> = []
    @Published var replyLoadingIDs: Set<String> = []
    @Published var replyHasMoreByCommentID: [String: Bool] = [:]
    @Published var commentReactionInFlightIDs: Set<String> = []

    private var repository: FeedRepository?
    private var target: PostDetailTarget?
    private var hasSentViewCount = false
    private var commentsCursor: String?
    private var commentsSnapshotTimestamp: String?
    private var replyCursorByCommentID: [String: String?] = [:]
    private var replyFlatByCommentID: [String: [PostComment]] = [:]

    func configure(target: PostDetailTarget, repository: FeedRepository) {
        self.target = target
        self.repository = repository
    }

    func load() async {
        guard let repository else { return }
        guard let target else {
            errorMessage = "상세 대상이 지정되지 않았습니다."
            return
        }

        isLoading = true
        errorMessage = nil
        post = nil
        comments = []
        commentsCursor = nil
        commentsSnapshotTimestamp = nil
        canLoadMoreComments = false
        isCommentsLoading = false
        isLoadingMoreComments = false
        expandedCommentIDs = []
        replyLoadingIDs = []
        replyHasMoreByCommentID = [:]
        replyCursorByCommentID = [:]
        replyFlatByCommentID = [:]
        commentReactionInFlightIDs = []
        hasSentViewCount = false
        activeReplyTarget = nil
        replyDraftMode = .comment
        isComposerExpanded = false
        defer { isLoading = false }

        do {
            switch target {
            case let .blog(postId):
                do {
                    IOSRunTrace.emit(
                        "post_detail.blog.load",
                        category: "post",
                        fields: ["postId": postId, "strategy": "mobile_post_detail"],
                    )
                    post = try await repository.fetchPostDetail(id: postId)
                } catch {
                    IOSRunTrace.emit(
                        "post_detail.blog.fail",
                        category: "post",
                        fields: ["postId": postId, "error": "\(error)"],
                    )
                    throw enrichDetailError(error, context: "blog:\(postId)")
                }

            case let .community(communitySlug, postId, postSlug):
                do {
                    IOSRunTrace.emit(
                        "post_detail.community.load",
                        category: "post",
                        fields: [
                            "postId": postId,
                            "community": communitySlug,
                            "postSlug": postSlug ?? "",
                            "strategy": "community_route",
                        ],
                    )
                    post = try await repository.fetchCommunityPost(
                        communitySlug: communitySlug,
                        postId: postId,
                        postSlug: postSlug,
                    )
                } catch {
                    IOSRunTrace.emit(
                        "post_detail.community.fail",
                        category: "post",
                        fields: [
                            "postId": postId,
                            "community": communitySlug,
                            "postSlug": postSlug ?? "",
                            "error": "\(error)",
                        ],
                    )
                    do {
                        IOSRunTrace.emit(
                            "post_detail.community.blog_fallback",
                            category: "post",
                            fields: ["postId": postId, "community": communitySlug],
                        )
                        post = try await repository.fetchPostDetail(id: postId)
                    } catch {
                        IOSRunTrace.emit(
                            "post_detail.community.blog_fallback_fail",
                            category: "post",
                            fields: [
                                "postId": postId,
                                "community": communitySlug,
                                "error": "\(error)",
                            ],
                        )
                        throw enrichDetailError(error, context: "community:\(communitySlug)/\(postId)")
                    }
                }

            case let .unsupported(reason, postId):
                throw APIError(
                    code: "UNSUPPORTED_DETAIL_TARGET",
                    message: reason.isEmpty ? "지원되지 않는 글 형식입니다." : reason,
                    status: 400,
                    target: postId,
                    type: .badRequest,
                )
            }

            Task { [weak self] in
                await self?.loadParentComments(reset: true)
            }
        } catch {
            errorMessage = detailErrorMessage(from: error)
        }
    }

    func trackView(force: Bool = false) async {
        guard let repository, let target else { return }
        guard post != nil else { return }
        if hasSentViewCount && !force { return }

        switch target {
        case let .blog(postId):
            hasSentViewCount = true
            do {
                _ = try await repository.incrementPostViewCount(postId: postId)
            } catch {
                return
            }

        case let .community(communitySlug, postId, _):
            hasSentViewCount = true
            do {
                _ = try await repository.incrementCommunityPostViewCount(
                    communitySlug: communitySlug,
                    postId: postId,
                )
            } catch {
                return
            }

        case .unsupported:
            return
        }
    }

    func vote(type: MobileVoteType) async {
        guard let repository, let currentPost = post else { return }
        guard let target else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            let response: MobilePostVoteResponse = try await {
                switch target {
                case let .blog(postId):
                    try await repository.votePost(postId: postId, type: type)
                case let .community(communitySlug, postId, _):
                    try await repository.voteCommunityPost(
                        communitySlug: communitySlug,
                        postId: postId,
                        type: type,
                    )
                case .unsupported:
                    throw APIError(
                        code: "UNSUPPORTED_VOTE_TARGET",
                        message: "지원되지 않는 글 형식입니다.",
                        status: 400,
                        type: .badRequest,
                    )
                }
            }()

            var updated = currentPost.withVoted(response.userVote)
            if let score = response.score {
                updated = MobilePost(
                    id: updated.id,
                    title: updated.title,
                    slug: updated.slug,
                    excerpt: updated.excerpt,
                    content: updated.content,
                    contentMarkdown: updated.contentMarkdown,
                    contentType: updated.contentType,
                    sourceType: updated.sourceType,
                    thumbnail: updated.thumbnail,
                    images: updated.images,
                    isPublished: updated.isPublished,
                    author: updated.author,
                    blog: updated.blog,
                    likeCount: response.likeCount ?? updated.likeCount,
                    commentCount: updated.commentCount,
                    viewCount: updated.viewCount,
                    upvoteCount: response.upvoteCount ?? updated.upvoteCount,
                    downvoteCount: response.downvoteCount ?? updated.downvoteCount,
                    score: score,
                    createdAt: updated.createdAt,
                    updatedAt: updated.updatedAt,
                    userVote: response.userVote,
                    liked: response.liked ?? updated.liked,
                    message: updated.message
                )
            }
            post = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func prepareCommentDraft() {
        replyDraftMode = .comment
        activeReplyTarget = nil
        isComposerExpanded = true
    }

    func startReplyDraft(for comment: PostComment) {
        let rootCommentId = resolveRootParentId(for: comment.id)
        activeReplyTarget = ReplyTarget(
            commentId: comment.id,
            rootCommentId: rootCommentId,
            username: comment.author?.username
        )
        replyDraftMode = .reply
        isComposerExpanded = true
    }

    func cancelReplyDraft() {
        activeReplyTarget = nil
        replyDraftMode = .comment
    }

    @discardableResult
    func createComment(content: String) async -> Bool {
        guard let repository else { return false }
        guard let target else { return false }
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }

        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let parentCommentId = replyDraftMode == .reply ? activeReplyTarget?.rootCommentId : nil
            let comment = try await {
                switch target {
                case let .blog(postId):
                    try await repository.createPostComment(
                        postId: postId,
                        content: trimmed,
                        parentCommentId: parentCommentId,
                    )
                case let .community(communitySlug, postId, _):
                    try await repository.createCommunityPostComment(
                        communitySlug: communitySlug,
                        postId: postId,
                        content: trimmed,
                        parentCommentId: parentCommentId,
                    )
                case .unsupported:
                    throw APIError(
                        code: "UNSUPPORTED_COMMENT_TARGET",
                        message: "지원되지 않는 글 형식입니다.",
                        status: 400,
                        type: .badRequest,
                    )
                }
            }()

            if let parentCommentId {
                attachReply(comment, to: parentCommentId)
                expandedCommentIDs.insert(parentCommentId)
            } else {
                comments.insert(comment, at: 0)
                configureReplyState(for: [comment], reset: true)
            }

            if let current = post {
                let nextCount = (current.commentCount ?? 0) + 1
                post = current.withCommentCount(nextCount)
            }
            errorMessage = nil
            cancelReplyDraft()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func changeCommentSort(to nextSort: CommentSort) async {
        guard selectedCommentSort != nextSort else { return }
        selectedCommentSort = nextSort
        await loadParentComments(reset: true)
    }

    func loadMoreComments() async {
        await loadParentComments(reset: false)
    }

    func toggleReplies(for comment: PostComment) async {
        let rootCommentId = resolveRootParentId(for: comment.id)
        if expandedCommentIDs.contains(rootCommentId) {
            expandedCommentIDs.remove(rootCommentId)
            return
        }

        expandedCommentIDs.insert(rootCommentId)
        let hasLoadedReplies = !(commentById(rootCommentId)?.replies ?? []).isEmpty
        let hasMore = replyHasMoreByCommentID[rootCommentId] ?? false
        if !hasLoadedReplies || hasMore {
            await loadReplies(for: rootCommentId, reset: !hasLoadedReplies)
        }
    }

    func loadMoreReplies(for comment: PostComment) async {
        let rootCommentId = resolveRootParentId(for: comment.id)
        guard replyHasMoreByCommentID[rootCommentId] == true else { return }
        await loadReplies(for: rootCommentId, reset: false)
    }

    func toggleCommentLike(_ comment: PostComment) async {
        guard let repository, let target else { return }
        guard !commentReactionInFlightIDs.contains(comment.id) else { return }
        commentReactionInFlightIDs.insert(comment.id)
        defer { commentReactionInFlightIDs.remove(comment.id) }
        do {
            let result: CommentReactionResult = try await {
                switch target {
                case .blog:
                    try await repository.toggleBlogCommentLike(commentId: comment.id)
                case let .community(communitySlug, postId, _):
                    try await repository.toggleCommunityCommentLike(
                        communitySlug: communitySlug,
                        postId: postId,
                        commentId: comment.id,
                    )
                case .unsupported:
                    throw APIError(
                        code: "UNSUPPORTED_COMMENT_REACTION_TARGET",
                        message: "지원되지 않는 댓글 형식입니다.",
                        status: 400,
                        type: .badRequest
                    )
                }
            }()

            comments = updateCommentTree(comments, commentId: comment.id) { current in
                current.withReaction(
                    liked: result.liked,
                    likesCount: result.likesCount,
                    dislikesCount: result.dislikesCount
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadParentComments(reset: Bool) async {
        guard let repository, let target else { return }
        if reset {
            isCommentsLoading = true
            comments = []
            commentsCursor = nil
            commentsSnapshotTimestamp = nil
            canLoadMoreComments = false
            expandedCommentIDs = []
            replyLoadingIDs = []
            replyHasMoreByCommentID = [:]
            replyCursorByCommentID = [:]
            replyFlatByCommentID = [:]
        } else {
            guard !isCommentsLoading, !isLoadingMoreComments else { return }
            guard canLoadMoreComments else { return }
            isLoadingMoreComments = true
        }
        defer {
            if reset {
                isCommentsLoading = false
            } else {
                isLoadingMoreComments = false
            }
        }

        do {
            let page: CommentPage
            switch target {
            case let .blog(postId):
                page = try await repository.fetchBlogParentCommentsPage(
                    postId: postId,
                    sort: selectedCommentSort,
                    limit: 10,
                    cursor: reset ? nil : commentsCursor,
                    snapshotTimestamp: selectedCommentSort == .popular ? commentsSnapshotTimestamp : nil,
                )
            case let .community(communitySlug, postId, _):
                page = try await repository.fetchCommunityPostCommentsPage(
                    communitySlug: communitySlug,
                    postId: postId,
                    sort: selectedCommentSort,
                    limit: 10,
                    cursor: reset ? nil : commentsCursor,
                    snapshotTimestamp: selectedCommentSort == .popular ? commentsSnapshotTimestamp : nil,
                )
            case .unsupported:
                canLoadMoreComments = false
                return
            }

            if reset {
                comments = page.items
                if selectedCommentSort == .popular {
                    commentsSnapshotTimestamp = page.snapshotTimestamp
                }
            } else {
                mergeComments(page.items)
            }

            commentsCursor = page.nextCursor
            canLoadMoreComments = page.hasMore || (page.nextCursor != nil)
            configureReplyState(for: comments, reset: false)
        } catch {
            if errorMessage == nil {
                errorMessage = "댓글을 불러오지 못했습니다."
            }
            if reset {
                comments = []
                canLoadMoreComments = false
                commentsCursor = nil
            }
        }
    }

    private func loadReplies(for rootCommentId: String, reset: Bool) async {
        guard let repository, let target else { return }
        guard !replyLoadingIDs.contains(rootCommentId) else { return }
        if !reset, replyHasMoreByCommentID[rootCommentId] != true { return }

        replyLoadingIDs.insert(rootCommentId)
        defer { replyLoadingIDs.remove(rootCommentId) }

        do {
            let page: CommentPage
            switch target {
            case .blog:
                page = try await repository.fetchBlogRepliesPage(
                    parentCommentId: rootCommentId,
                    limit: 10,
                    cursor: reset ? nil : (replyCursorByCommentID[rootCommentId] ?? nil),
                )
            case let .community(communitySlug, postId, _):
                page = try await repository.fetchCommunityRepliesPage(
                    communitySlug: communitySlug,
                    postId: postId,
                    parentCommentId: rootCommentId,
                    limit: 10,
                    cursor: reset ? nil : (replyCursorByCommentID[rootCommentId] ?? nil),
                )
            case .unsupported:
                return
            }

            let mergedFlat: [PostComment]
            if reset {
                mergedFlat = page.items
            } else {
                let previous = replyFlatByCommentID[rootCommentId] ?? []
                mergedFlat = mergeUnique(previous: previous, incoming: page.items)
            }
            replyFlatByCommentID[rootCommentId] = mergedFlat

            let threadedReplies = buildReplyTree(from: mergedFlat, rootParentId: rootCommentId)
            comments = updateCommentTree(comments, commentId: rootCommentId) { current in
                current.withReplies(threadedReplies)
            }

            replyCursorByCommentID[rootCommentId] = page.nextCursor
            replyHasMoreByCommentID[rootCommentId] = page.hasMore || (page.nextCursor != nil)
            expandedCommentIDs.insert(rootCommentId)
        } catch {
            if errorMessage == nil {
                errorMessage = "답글을 불러오지 못했습니다."
            }
        }
    }

    private func mergeComments(_ incoming: [PostComment]) {
        guard !incoming.isEmpty else { return }
        comments = mergeUnique(previous: comments, incoming: incoming)
        configureReplyState(for: incoming, reset: false)
    }

    private func configureReplyState(for sourceComments: [PostComment], reset: Bool) {
        for comment in sourceComments {
            if reset {
                replyCursorByCommentID[comment.id] = nil
                replyFlatByCommentID[comment.id] = []
            }
            let loaded = countReplies(in: comment.replies)
            let total = comment.repliesCount ?? loaded
            replyHasMoreByCommentID[comment.id] = total > loaded
        }
    }

    private func attachReply(_ reply: PostComment, to rootCommentId: String) {
        let existingFlat = replyFlatByCommentID[rootCommentId] ?? flattenComments(commentById(rootCommentId)?.replies ?? [])
        let mergedFlat = mergeUnique(previous: existingFlat, incoming: [reply])
        replyFlatByCommentID[rootCommentId] = mergedFlat

        let tree = buildReplyTree(from: mergedFlat, rootParentId: rootCommentId)
        comments = updateCommentTree(comments, commentId: rootCommentId) { current in
            current.withReplies(tree)
        }

        let total = commentById(rootCommentId)?.repliesCount ?? tree.count
        replyHasMoreByCommentID[rootCommentId] = total > countReplies(in: tree)
    }

    private func resolveRootParentId(for commentId: String) -> String {
        let parentMap = buildParentMap(from: comments)
        var current = commentId
        var visited: Set<String> = []

        while let parentId = parentMap[current] ?? nil,
              !parentId.isEmpty,
              !visited.contains(parentId)
        {
            visited.insert(parentId)
            current = parentId
        }
        return current
    }

    private func buildParentMap(from sourceComments: [PostComment]) -> [String: String?] {
        var map: [String: String?] = [:]
        for comment in flattenComments(sourceComments) {
            map[comment.id] = comment.parentCommentId
        }
        return map
    }

    private func flattenComments(_ sourceComments: [PostComment]) -> [PostComment] {
        var output: [PostComment] = []
        for comment in sourceComments {
            output.append(comment)
            if let replies = comment.replies, !replies.isEmpty {
                output.append(contentsOf: flattenComments(replies))
            }
        }
        return output
    }

    private func countReplies(in replies: [PostComment]?) -> Int {
        guard let replies else { return 0 }
        return replies.reduce(0) { partial, comment in
            partial + 1 + countReplies(in: comment.replies)
        }
    }

    private func commentById(_ commentId: String) -> PostComment? {
        for comment in comments {
            if let found = findComment(comment, commentId: commentId) {
                return found
            }
        }
        return nil
    }

    private func findComment(_ source: PostComment, commentId: String) -> PostComment? {
        if source.id == commentId { return source }
        guard let replies = source.replies else { return nil }
        for reply in replies {
            if let found = findComment(reply, commentId: commentId) {
                return found
            }
        }
        return nil
    }

    private func buildReplyTree(from flatComments: [PostComment], rootParentId: String) -> [PostComment] {
        let grouped = Dictionary(grouping: flatComments) { $0.parentCommentId ?? "" }

        func attachChildren(_ comment: PostComment) -> PostComment {
            let children = (grouped[comment.id] ?? []).map(attachChildren)
            return comment.withReplies(children.isEmpty ? nil : children)
        }

        return (grouped[rootParentId] ?? []).map(attachChildren)
    }

    private func updateCommentTree(
        _ source: [PostComment],
        commentId: String,
        transform: (PostComment) -> PostComment
    ) -> [PostComment] {
        source.map { comment in
            if comment.id == commentId {
                return transform(comment)
            }
            guard let replies = comment.replies, !replies.isEmpty else {
                return comment
            }
            let updatedReplies = updateCommentTree(replies, commentId: commentId, transform: transform)
            return updatedReplies == replies ? comment : comment.withReplies(updatedReplies)
        }
    }

    private func mergeUnique(previous: [PostComment], incoming: [PostComment]) -> [PostComment] {
        guard !incoming.isEmpty else { return previous }
        var ids = Set(previous.map(\.id))
        var merged = previous
        for item in incoming where !ids.contains(item.id) {
            merged.append(item)
            ids.insert(item.id)
        }
        return merged
    }

    private func enrichDetailError(_ error: Error, context: String) -> APIError {
        if let apiError = error as? APIError {
            return APIError(
                code: apiError.code,
                message: apiError.message,
                status: apiError.status,
                target: apiError.target ?? context,
                type: apiError.type,
            )
        }

        return APIError(
            code: "DETAIL_FETCH_FAILED",
            message: error.localizedDescription,
            status: -1,
            target: context,
            type: .unknown,
        )
    }

    private func detailErrorMessage(from error: Error) -> String {
        guard let apiError = error as? APIError else {
            return error.localizedDescription
        }

        switch apiError.type {
        case .unauthorized:
            return "로그인이 만료되었습니다. 다시 로그인 후 시도해 주세요."
        case .decoding:
            return "상세 응답 파싱에 실패했습니다. (\(apiError.target ?? "unknown"))"
        case .network:
            return "네트워크 오류로 상세를 불러오지 못했습니다. (\(apiError.target ?? "unknown"))"
        default:
            if apiError.status == 404 {
                return "삭제되었거나 존재하지 않는 글입니다."
            }
            if let target = apiError.target {
                return "\(apiError.message) [\(target)]"
            }
            return apiError.message
        }
    }
}
