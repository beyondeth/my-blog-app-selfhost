import Foundation

@MainActor
final class FeedViewModel: ObservableObject {
    @Published var posts: [FeedPost] = []
    @Published var isLoading = false
    @Published var isRefreshing = false
    @Published var hasMore = true
    @Published var isLoadingMore = false
    @Published var cursor: String? = nil
    @Published var errorMessage: String?

    private var repository: FeedRepository?
    private var prefetchedTargets: Set<String> = []
    private enum LoadMode {
        case initial
        case refresh
        case loadMore(cursor: String)
    }

    init(repository: FeedRepository? = nil) {
        self.repository = repository
    }

    func loadInitial() async {
        await load(.initial)
    }

    func loadMore() async {
        guard hasMore, let cursor else { return }
        await load(.loadMore(cursor: cursor))
    }

    func refresh() async {
        await load(.refresh)
    }

    func reset() {
        posts = []
        cursor = nil
        errorMessage = nil
        hasMore = true
        isLoading = false
        isRefreshing = false
        isLoadingMore = false
    }

    func configure(repository: FeedRepository) {
        self.repository = repository
        if posts.isEmpty {
            hasMore = true
        }
    }

    func prefetchDetail(for target: PostDetailTarget) async {
        guard let repository else { return }
        let key = prefetchKey(target)
        guard prefetchedTargets.insert(key).inserted else { return }

        switch target {
        case let .blog(postId):
            await repository.prefetchPostDetail(id: postId)
        case let .community(communitySlug, postId, postSlug):
            await repository.prefetchCommunityPost(
                communitySlug: communitySlug,
                postId: postId,
                postSlug: postSlug,
            )
        case .unsupported:
            return
        }
    }

    func vote(postId: String, target: PostDetailTarget, type: MobileVoteType) async throws {
        guard let repository else { return }
        let response: MobilePostVoteResponse

        switch target {
        case .blog:
            response = try await repository.votePost(postId: postId, type: type)
        case let .community(communitySlug, communityPostId, _):
            response = try await repository.voteCommunityPost(
                communitySlug: communitySlug,
                postId: communityPostId,
                type: type,
            )
        case .unsupported:
            throw APIError(
                code: "UNSUPPORTED_VOTE_TARGET",
                message: "지원되지 않는 글 형식입니다.",
                status: 400,
                target: postId,
                type: .badRequest,
            )
        }

        replacePost(postId: postId) { current in
            current.withVote(response: response, requestedVote: type)
        }
    }

    func incrementView(postId: String, target: PostDetailTarget) async throws {
        guard let repository else { return }

        if case let .blog(blogPostId) = target {
            _ = try await repository.incrementPostViewCount(postId: blogPostId)
        }

        replacePost(postId: postId) { current in
            current.withIncrementedViewCount()
        }
    }

    func deletePost(postId: String, target: PostDetailTarget) async throws {
        guard let repository else { return }

        switch target {
        case let .blog(blogPostId):
            try await repository.deletePost(postId: blogPostId)
        case let .community(communitySlug, communityPostId, _):
            try await repository.deleteCommunityPost(
                communitySlug: communitySlug,
                postId: communityPostId,
            )
        case .unsupported:
            throw APIError(
                code: "UNSUPPORTED_DELETE_TARGET",
                message: "지원되지 않는 글 형식입니다.",
                status: 400,
                target: postId,
                type: .badRequest,
            )
        }

        posts.removeAll { $0.id == postId }
    }

    func reportPost(post: FeedPost) async throws {
        guard let repository else { return }
        try await repository.reportPost(
            postId: post.id,
            communityId: post.community?.id,
            description: post.title,
        )
    }

    private func load(_ mode: LoadMode) async {
        guard let repository else { return }
        guard canStart(mode: mode) else { return }

        beginLoading(mode: mode)
        errorMessage = nil
        defer { endLoading(mode: mode) }

        do {
            let response = try await repository.fetchFeed(cursor: requestCursor(for: mode))
            cursor = response.cursor
            hasMore = response.hasMore && !response.items.isEmpty

            switch mode {
            case .loadMore:
                posts = appendUnique(posts, with: response.items)
            case .initial, .refresh:
                posts = response.items
            }
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func requestCursor(for mode: LoadMode) -> String? {
        if case let .loadMore(cursor) = mode {
            return cursor
        }
        return nil
    }

    private func canStart(mode: LoadMode) -> Bool {
        switch mode {
        case .loadMore:
            return !isLoadingMore && !isRefreshing && !isLoading
        case .initial, .refresh:
            return !isLoading && !isRefreshing && !isLoadingMore
        }
    }

    private func beginLoading(mode: LoadMode) {
        switch mode {
        case .loadMore:
            isLoadingMore = true
        case .refresh:
            isRefreshing = true
            isLoading = true
        case .initial:
            isLoading = true
        }
    }

    private func endLoading(mode: LoadMode) {
        switch mode {
        case .loadMore:
            isLoadingMore = false
        case .refresh:
            isRefreshing = false
            isLoading = false
        case .initial:
            isLoading = false
        }
    }

    private func appendUnique(_ current: [FeedPost], with incoming: [FeedPost]) -> [FeedPost] {
        guard !incoming.isEmpty else { return current }
        var ids = Set(current.map(\.id))
        var merged = current
        for post in incoming where !ids.contains(post.id) {
            merged.append(post)
            ids.insert(post.id)
        }
        return merged
    }

    private func replacePost(postId: String, transform: (FeedPost) -> FeedPost) {
        guard let index = posts.firstIndex(where: { $0.id == postId }) else { return }
        posts[index] = transform(posts[index])
    }

    private func prefetchKey(_ target: PostDetailTarget) -> String {
        switch target {
        case let .blog(postId):
            return "blog:\(postId)"
        case let .community(communitySlug, postId, postSlug):
            return "community:\(communitySlug):\(postId):\(postSlug ?? "")"
        case let .unsupported(_, postId):
            return "unsupported:\(postId ?? "none")"
        }
    }
}
