import SwiftUI
#if canImport(UIKit)
import UIKit
private typealias HomeHeaderPlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
private typealias HomeHeaderPlatformImage = NSImage
#endif

struct FeedView: View {
    @StateObject private var vm = FeedViewModel()
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var searchText = ""
    @State private var selectedFilter: FeedFilter = .recommended
    @State private var repository: FeedRepository?
    @State private var prefetchedRowIDs: Set<String> = []
    @State private var showQuickComposer = false
    @State private var navigationPath = NavigationPath()
    @State private var deleteCandidate: FeedActionCandidate?
    @State private var feedbackAlert: FeedFeedbackAlert?
    @State private var repostedPostIDs: Set<String> = []

    private var filteredPosts: [FeedPost] {
        let base = vm.posts
        let keyword = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if keyword.isEmpty {
            return base
        }

        return base.filter { post in
            let primary = feedPrimaryText(for: post).lowercased()
            let secondary = (feedSecondaryText(for: post) ?? "").lowercased()
            let author = (post.author?.username ?? "").lowercased()
            return primary.contains(keyword) || secondary.contains(keyword) || author.contains(keyword)
        }
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ScrollView {
                LazyVStack(spacing: 0) {
                    headerBar
                    filterBar
                    contentSection
                }
            }
            .background(backgroundColor)
            .navigationBarHidden(true)
            .refreshable {
                await vm.refresh()
                await appStore.refreshCurrentUserProfile()
            }
            .task(id: appStore.isAuthenticated) {
                await syncFeedSessionState()
                if appStore.isAuthenticated {
                    await appStore.refreshCurrentUserProfile()
                }
            }
            .onChange(of: vm.posts.map(\.id)) { _, _ in
                preheatVisibleFeedImages()
            }
            .navigationDestination(for: PostDetailTarget.self) { target in
                if let repository = repository ?? appStore.makeFeedRepository() {
                    PostDetailView(target: target, repository: repository)
                        .environmentObject(appStore)
                } else {
                    VStack(spacing: 8) {
                        Text("세션이 유효하지 않습니다.")
                            .font(.headline)
                            .foregroundStyle(primaryText)
                        Text("다시 로그인해 주세요.")
                            .font(.subheadline)
                            .foregroundStyle(secondaryText)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(backgroundColor)
                }
            }
            .sheet(isPresented: $showQuickComposer) {
                FeedQuickComposeSheet {
                    Task { await vm.refresh() }
                }
                .environmentObject(appStore)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
            .alert(
                "게시글 삭제",
                isPresented: Binding(
                    get: { deleteCandidate != nil },
                    set: { isPresented in
                        if !isPresented {
                            deleteCandidate = nil
                        }
                    }
                ),
                presenting: deleteCandidate
            ) { candidate in
                Button("삭제", role: .destructive) {
                    Task { await handleDelete(candidate) }
                }
                Button("취소", role: .cancel) {}
            } message: { _ in
                Text("삭제한 게시글은 복구하기 어렵습니다.")
            }
            .alert(item: $feedbackAlert) { alert in
                Alert(
                    title: Text(alert.title),
                    message: Text(alert.message),
                    dismissButton: .default(Text("확인"))
                )
            }
        }
    }

    @MainActor
    private func configureRepository(_ nextRepository: FeedRepository?) async {
        repository = nextRepository
        if let nextRepository {
            vm.configure(repository: nextRepository)
        }
    }

    @MainActor
    private func syncFeedSessionState() async {
        let nextRepository = appStore.makeFeedRepository()
        await configureRepository(nextRepository)

        guard appStore.isAuthenticated, nextRepository != nil else {
            vm.reset()
            return
        }

        await vm.loadInitial()
    }

    private var headerBar: some View {
        VStack(spacing: 12) {
            HStack {
                Button {} label: {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(primaryText.opacity(0.9))
                }
                .buttonStyle(.plain)

                Spacer()

                HomeHeaderLogoView()

                Spacer()

                Button {} label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(primaryText.opacity(0.9))
                }
                .buttonStyle(.plain)
            }

            composePromptRow
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 14)
    }

    private var composePromptRow: some View {
        Button {
            showQuickComposer = true
        } label: {
            HStack(spacing: 10) {
                if let profile = appStore.user {
                    ProfileAvatarImage(
                        imageURL: resolveImageURL(
                            profile.profileImage,
                            apiBaseURL: appStore.apiBaseURL,
                            frontendBaseURL: appStore.frontendBaseURL,
                            cacheBuster: appStore.profileImageCacheBuster,
                        ),
                        fallbackText: initial(profile.username),
                        size: 36,
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(profile.username)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(primaryText)
                            .lineLimit(1)

                        Text("새로운 소식이 있나요?")
                            .font(.subheadline)
                            .foregroundStyle(secondaryText)
                            .lineLimit(1)
                    }
                } else {
                    Circle()
                        .fill(chipBackground)
                        .frame(width: 36, height: 36)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("게스트")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(primaryText)
                        Text("로그인 후 글을 작성할 수 있어요")
                            .font(.footnote)
                            .foregroundStyle(secondaryText)
                    }
                }

                Spacer()

                if vm.isLoading {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(primaryText.opacity(0.85))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(surfaceBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(strokeColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var filterBar: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                ForEach(FeedFilter.allCases) { filter in
                    Button {
                        selectedFilter = filter
                    } label: {
                        Text(filter.title)
                            .font(.footnote.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(selectedFilter == filter ? selectedChipFill : chipBackground)
                            )
                            .foregroundStyle(selectedFilter == filter ? selectedChipText : primaryText.opacity(0.84))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }

            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.gray)
                    .frame(width: 16)

                TextField("검색", text: $searchText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .foregroundStyle(primaryText)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(chipBackground)
            )
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 14)
    }

    @ViewBuilder
    private var contentSection: some View {
        if vm.posts.isEmpty && vm.isLoading {
            ProgressView("피드 로딩 중")
                .foregroundStyle(primaryText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
        } else if let errorMessage = vm.errorMessage {
            VStack(alignment: .leading, spacing: 8) {
                Text(errorMessage)
                    .foregroundStyle(.red.opacity(0.95))
                Button("재시도") {
                    Task { await vm.refresh() }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if filteredPosts.isEmpty {
            Text("표시할 게시글이 없습니다.")
                .foregroundStyle(.gray)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 40)
        } else {
            ForEach(Array(filteredPosts.enumerated()), id: \.element.id) { index, post in
                let target = detailTarget(for: post)
                let isLast = post.id == filteredPosts.last?.id

                feedRow(
                    post,
                    target: target,
                    onOpenDetail: {
                        openDetail(post: post, target: target)
                    },
                    onLike: {
                        Task { await handleLikeTap(post: post, target: target) }
                    },
                    onComment: {
                        openDetail(post: post, target: target)
                    },
                    onView: {
                        Task { await handleViewTap(post: post, target: target) }
                    },
                    onRepost: {
                        handleRepostTap(post: post)
                    },
                    onEdit: {
                        handleEditTap(post: post)
                    },
                    onDelete: {
                        deleteCandidate = FeedActionCandidate(post: post, target: target)
                    },
                    onReport: {
                        Task { await handleReportTap(post: post) }
                    }
                )
                .onAppear {
                    guard index < 6 else { return }
                    guard prefetchedRowIDs.insert(post.id).inserted else { return }
                    preheatAssets(for: post)
                    Task { await vm.prefetchDetail(for: target) }
                }

                if !isLast {
                    Divider()
                        .overlay(strokeColor.opacity(0.7))
                        .padding(.leading, feedContentLeadingInset)
                }

                if isLast {
                    Color.clear
                        .frame(height: 1)
                        .onAppear {
                            Task { await vm.loadMore() }
                        }
                }
            }

            if vm.isLoadingMore {
                ProgressView("다음 글 불러오는 중")
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 16)
                    .foregroundStyle(primaryText)
            }
        }
    }

    private func detailTarget(for post: FeedPost) -> PostDetailTarget {
        let sourceType = normalizedSourceType(post.sourceType)
        let communitySlug = post.community?.slug?.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedPostSlug = post.slug?.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasCommunitySlug = communitySlug != nil && !(communitySlug?.isEmpty ?? true)
        let isCommunitySource =
            sourceType == "community" || hasCommunitySlug

        if isCommunitySource {
            if let communitySlug, let normalizedPostSlug, !normalizedPostSlug.isEmpty {
                return .community(
                    communitySlug: communitySlug,
                    postId: post.id,
                    postSlug: normalizedPostSlug,
                )
            }
            if let communitySlug {
                return .community(
                    communitySlug: communitySlug,
                    postId: post.id,
                    postSlug: nil,
                )
            }
            return .unsupported(
                reason: "커뮤니티 글 식별 정보가 누락되어 상세 이동을 할 수 없습니다.",
                postId: post.id,
            )
        }

        return .blog(postId: post.id)
    }

    private func logDetailNavigation(post: FeedPost, target: PostDetailTarget) {
        let sourceType = normalizedSourceType(post.sourceType)
        let communitySlug = post.community?.slug?.trimmingCharacters(in: .whitespacesAndNewlines)
        let postSlug = post.slug?.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasCommunity = communitySlug != nil && !(communitySlug?.isEmpty ?? true)
        let decision: String

        switch target {
        case .community:
            decision = "community"
        case .blog:
            decision = "blog"
        case .unsupported:
            decision = "unsupported"
        }

        IOSRunTrace.emit(
            "feed_detail_navigation",
            category: "navigation",
            fields: [
                "postId": post.id,
                "sourceType": sourceType ?? "",
                "hasCommunity": hasCommunity ? "true" : "false",
                "postSlug": postSlug ?? "",
                "decision": decision,
            ],
        )
    }

    private func normalizedSourceType(_ sourceType: String?) -> String? {
        sourceType?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private func resolveImageCacheBuster(for authorId: String?) -> String? {
        guard
            let authorId,
            let currentUserId = appStore.user?.id,
            authorId == currentUserId
        else {
            return nil
        }
        return appStore.profileImageCacheBuster
    }

    private func feedRow(
        _ post: FeedPost,
        target: PostDetailTarget,
        onOpenDetail: @escaping () -> Void,
        onLike: @escaping () -> Void,
        onComment: @escaping () -> Void,
        onView: @escaping () -> Void,
        onRepost: @escaping () -> Void,
        onEdit: @escaping () -> Void,
        onDelete: @escaping () -> Void,
        onReport: @escaping () -> Void
    ) -> some View {
        let currentUserId = appStore.user?.id
        let isAdmin = (appStore.user?.role ?? "").lowercased() == "admin"
        let isOwner = currentUserId != nil && currentUserId == post.author?.id
        let canEdit = isOwner || isAdmin
        let canDelete = isOwner || isAdmin
        let canReport = appStore.isAuthenticated && !isOwner
        let repostCount = repostedPostIDs.contains(post.id) ? 1 : 0

        return VStack(alignment: .leading, spacing: 11) {
            HStack(alignment: .top, spacing: 10) {
                if let author = post.author {
                    ProfileAvatarImage(
                        imageURL: resolveImageURL(
                            author.profileImage ?? author.avatarUrl,
                            apiBaseURL: appStore.apiBaseURL,
                            frontendBaseURL: appStore.frontendBaseURL,
                            cacheBuster: resolveImageCacheBuster(for: author.id),
                        ),
                        fallbackText: initial(author.username),
                        size: 38
                    )
                } else {
                    Circle()
                        .fill(chipBackground)
                        .frame(width: 38, height: 38)
                }

                VStack(alignment: .leading, spacing: 4) {
                    let primaryLine = feedPrimaryText(for: post)
                    let secondaryLine = feedSecondaryText(for: post)

                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(post.author?.username ?? "Unknown")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(primaryText)
                            .lineLimit(1)

                        if let communityName = post.community?.name {
                            Text("· \(communityName)")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.blue.opacity(0.95))
                                .lineLimit(1)
                        }

                        Text(shortTimestamp(post.createdAt))
                            .font(.caption)
                            .foregroundStyle(secondaryText)

                        Spacer()

                        if canEdit || canDelete || canReport {
                            Menu {
                                if canEdit {
                                    Button("수정", systemImage: "square.and.pencil") {
                                        onEdit()
                                    }
                                }
                                if canDelete {
                                    Button("삭제", systemImage: "trash", role: .destructive) {
                                        onDelete()
                                    }
                                }
                                if canReport {
                                    Button("신고", systemImage: "exclamationmark.bubble") {
                                        onReport()
                                    }
                                }
                            } label: {
                                Image(systemName: "ellipsis")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(secondaryText.opacity(0.9))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 4)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Button(action: onOpenDetail) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(primaryLine)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(primaryText)
                                .multilineTextAlignment(.leading)

                            if let secondaryLine, !secondaryLine.isEmpty {
                                Text(secondaryLine)
                                    .font(.callout)
                                    .foregroundStyle(bodyText)
                                    .lineLimit(5)
                                    .multilineTextAlignment(.leading)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                }
            }

            let youtubeVideoID = YouTubeMediaResolver.firstVideoID(
                in: [post.thumbnail] + (post.images ?? []).map(Optional.some) + [post.excerpt, post.title]
            )
            let feedImagePath = post.thumbnail ?? post.images?.first
            if let youtubeVideoID {
                HStack {
                    Spacer(minLength: 0)
                    YouTubeInlinePlayerView(videoID: youtubeVideoID)
                        .frame(width: feedThumbnailWidth, height: feedThumbnailHeight)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(strokeColor, lineWidth: 1)
                        )
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.leading, feedImageLeadingInset)
            } else if let imagePath = feedImagePath {
                let imageURL = resolveImageURL(
                    imagePath,
                    apiBaseURL: appStore.apiBaseURL,
                    frontendBaseURL: appStore.frontendBaseURL
                )
                HStack {
                    Spacer(minLength: 0)
                    RemoteImageView(
                        imageURL: imageURL,
                        contentMode: .fill,
                        downsampleWidth: feedThumbnailWidth
                    ) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(surfaceBackground)
                            ProgressView()
                        }
                    } failure: {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(surfaceBackground)
                            .overlay(Image(systemName: "photo").foregroundStyle(.gray))
                    }
                    .frame(width: feedThumbnailWidth, height: feedThumbnailHeight)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(strokeColor, lineWidth: 1)
                    )
                    .onTapGesture(perform: onOpenDetail)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.leading, feedImageLeadingInset)
            }

            HStack(spacing: 18) {
                actionMetricButton(
                    icon: post.userVote == .upvote ? "heart.fill" : "heart",
                    value: post.likeCount ?? 0,
                    tint: post.userVote == .upvote ? .red : secondaryText,
                    action: onLike
                )

                actionMetricButton(
                    icon: "bubble.left",
                    value: post.commentCount ?? 0,
                    tint: secondaryText,
                    action: onComment
                )

                actionMetricButton(
                    icon: "eye",
                    value: post.viewCount ?? 0,
                    tint: secondaryText,
                    action: onView
                )

                actionMetricButton(
                    icon: "arrow.2.squarepath",
                    value: repostCount,
                    tint: repostedPostIDs.contains(post.id) ? .green : secondaryText,
                    action: onRepost
                )

                if let shareURL = shareURL(for: post, target: target) {
                    ShareLink(item: shareURL) {
                        HStack(spacing: 6) {
                            Image(systemName: "paperplane")
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(secondaryText.opacity(0.95))
                    }
                    .buttonStyle(.plain)
                } else {
                    Image(systemName: "paperplane")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(secondaryText.opacity(0.65))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, feedContentLeadingInset)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(rowBackground)
    }

    private func actionMetricButton(
        icon: String,
        value: Int,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text("\(value)")
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(tint)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func shortTimestamp(_ source: String?) -> String {
        RelativeTimeFormatter.string(from: source)
    }

    private func feedPrimaryText(for post: FeedPost) -> String {
        let title = normalizedText(post.title) ?? "제목 없음"
        guard let excerpt = cleanedExcerptText(post.excerpt) else {
            return title
        }

        let titleKey = normalizedComparisonKey(title)
        let excerptKey = normalizedComparisonKey(excerpt)
        let placeholderTitleKeys: Set<String> = [
            normalizedComparisonKey("새 글"),
            normalizedComparisonKey("새글"),
            normalizedComparisonKey("untitled"),
            normalizedComparisonKey("제목 없음"),
        ]

        if placeholderTitleKeys.contains(titleKey) {
            return excerpt
        }

        if excerptKey == titleKey || excerptKey.hasPrefix("\(titleKey) ") {
            return excerpt
        }

        return title
    }

    private func feedSecondaryText(for post: FeedPost) -> String? {
        guard let excerpt = cleanedExcerptText(post.excerpt) else {
            return nil
        }

        let primary = feedPrimaryText(for: post)
        let excerptKey = normalizedComparisonKey(excerpt)
        let primaryKey = normalizedComparisonKey(primary)
        if excerptKey == primaryKey {
            return nil
        }

        if let title = normalizedText(post.title) {
            let titleKey = normalizedComparisonKey(title)
            if primaryKey == titleKey, excerptKey.hasPrefix("\(titleKey) ") {
                return nil
            }
        }

        return excerpt
    }

    private func cleanedExcerptText(_ value: String?) -> String? {
        guard let raw = normalizedText(value) else { return nil }

        var cleaned = raw
        cleaned = cleaned.replacingOccurrences(
            of: "\\{#.*?\\}",
            with: "",
            options: .regularExpression
        )
        cleaned = cleaned.replacingOccurrences(
            of: "!\\[[^\\]]*\\]\\([^\\)]*\\)",
            with: "",
            options: .regularExpression
        )
        cleaned = cleaned.replacingOccurrences(
            of: "https?://\\S+",
            with: "",
            options: .regularExpression
        )
        cleaned = cleaned.replacingOccurrences(
            of: "\\s+",
            with: " ",
            options: .regularExpression
        )
        cleaned = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? nil : cleaned
    }

    private func normalizedText(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func normalizedComparisonKey(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(
                of: "\\s+",
                with: " ",
                options: .regularExpression
            )
    }

    private func initial(_ source: String?) -> String {
        guard let source else { return "?" }
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "?" : String(trimmed.prefix(1)).uppercased()
    }

    private func preheatVisibleFeedImages() {
        let candidates = Array(filteredPosts.prefix(12))
        var urls: [URL] = []
        for post in candidates {
            let feedImagePath = post.thumbnail ?? post.images?.first
            if let thumbnailURL = resolveImageURL(
                feedImagePath,
                apiBaseURL: appStore.apiBaseURL,
                frontendBaseURL: appStore.frontendBaseURL
            ) {
                urls.append(thumbnailURL)
            }

            if let avatarURL = resolveImageURL(
                post.author?.profileImage ?? post.author?.avatarUrl,
                apiBaseURL: appStore.apiBaseURL,
                frontendBaseURL: appStore.frontendBaseURL,
                cacheBuster: resolveImageCacheBuster(for: post.author?.id),
            ) {
                urls.append(avatarURL)
            }
        }
        ImagePreheater.shared.preheat(urls: urls, maxCount: 16)
    }

    private func preheatAssets(for post: FeedPost) {
        var urls: [URL] = []
        let feedImagePath = post.thumbnail ?? post.images?.first
        if let thumbnailURL = resolveImageURL(
            feedImagePath,
            apiBaseURL: appStore.apiBaseURL,
            frontendBaseURL: appStore.frontendBaseURL
        ) {
            urls.append(thumbnailURL)
        }

        if let avatarURL = resolveImageURL(
            post.author?.profileImage ?? post.author?.avatarUrl,
            apiBaseURL: appStore.apiBaseURL,
            frontendBaseURL: appStore.frontendBaseURL,
            cacheBuster: resolveImageCacheBuster(for: post.author?.id),
        ) {
            urls.append(avatarURL)
        }

        guard !urls.isEmpty else { return }
        ImagePreheater.shared.preheat(urls: urls, maxCount: 8)
    }

    private func openDetail(post: FeedPost, target: PostDetailTarget) {
        preheatAssets(for: post)
        Task { await vm.prefetchDetail(for: target) }
        logDetailNavigation(post: post, target: target)
        navigationPath.append(target)
    }

    private func handleLikeTap(post: FeedPost, target: PostDetailTarget) async {
        do {
            await vm.prefetchDetail(for: target)
            try await vm.vote(postId: post.id, target: target, type: .upvote)
        } catch {
            feedbackAlert = FeedFeedbackAlert(
                title: "좋아요 처리 실패",
                message: error.localizedDescription
            )
        }
    }

    private func handleViewTap(post: FeedPost, target: PostDetailTarget) async {
        do {
            try await vm.incrementView(postId: post.id, target: target)
        } catch {
            feedbackAlert = FeedFeedbackAlert(
                title: "조회 처리 실패",
                message: error.localizedDescription
            )
        }
    }

    private func handleRepostTap(post: FeedPost) {
        if repostedPostIDs.contains(post.id) {
            repostedPostIDs.remove(post.id)
            return
        }
        repostedPostIDs.insert(post.id)
    }

    private func handleReportTap(post: FeedPost) async {
        do {
            try await vm.reportPost(post: post)
            feedbackAlert = FeedFeedbackAlert(
                title: "신고 완료",
                message: "신고가 접수되었습니다."
            )
        } catch {
            feedbackAlert = FeedFeedbackAlert(
                title: "신고 실패",
                message: error.localizedDescription
            )
        }
    }

    private func handleDelete(_ candidate: FeedActionCandidate) async {
        do {
            try await vm.deletePost(postId: candidate.post.id, target: candidate.target)
        } catch {
            feedbackAlert = FeedFeedbackAlert(
                title: "삭제 실패",
                message: error.localizedDescription
            )
        }
        deleteCandidate = nil
    }

    private func handleEditTap(post: FeedPost) {
        guard let url = editURL(for: post) else {
            feedbackAlert = FeedFeedbackAlert(
                title: "수정 이동 실패",
                message: "편집 URL을 만들 수 없습니다."
            )
            return
        }
        openExternalURL(url)
    }

    private func shareURL(for post: FeedPost, target _: PostDetailTarget) -> URL? {
        guard let frontendBaseURL = appStore.frontendBaseURL else { return nil }
        return frontendBaseURL
            .appendingPathComponent("p")
            .appendingPathComponent(post.id)
    }

    private func editURL(for post: FeedPost) -> URL? {
        guard let frontendBaseURL = appStore.frontendBaseURL else { return nil }
        return frontendBaseURL
            .appendingPathComponent("p")
            .appendingPathComponent(post.id)
            .appendingPathComponent("edit")
    }

    private func openExternalURL(_ url: URL) {
        #if canImport(UIKit)
        UIApplication.shared.open(url)
        #elseif canImport(AppKit)
        NSWorkspace.shared.open(url)
        #endif
    }

    private var backgroundColor: Color {
        colorScheme == .dark ? .black : Color(.systemBackground)
    }

    private var rowBackground: Color {
        colorScheme == .dark ? .black : .white
    }

    private var surfaceBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.05)
    }

    private var chipBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.1) : Color.black.opacity(0.06)
    }

    private var selectedChipFill: Color {
        colorScheme == .dark ? Color.white : Color.black
    }

    private var selectedChipText: Color {
        colorScheme == .dark ? .black : .white
    }

    private var strokeColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.1) : Color.black.opacity(0.14)
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : Color.black.opacity(0.96)
    }

    private var bodyText: Color {
        colorScheme == .dark ? Color.white.opacity(0.9) : Color.black.opacity(0.9)
    }

    private var secondaryText: Color {
        colorScheme == .dark ? Color.gray.opacity(0.95) : Color.black.opacity(0.62)
    }

    private var feedThumbnailWidth: CGFloat {
        let screenWidth = UIScreen.main.bounds.width
        let availableWidth = screenWidth - (32 + feedImageLeadingInset)
        return min(max(availableWidth, 260), 340)
    }

    private var feedThumbnailHeight: CGFloat {
        let derived = feedThumbnailWidth * 0.9
        return min(max(derived, 220), 320)
    }

    private var feedContentLeadingInset: CGFloat {
        48
    }

    private var feedImageLeadingInset: CGFloat {
        48
    }

}

private enum FeedFilter: String, CaseIterable, Identifiable {
    case recommended
    case following
    case latest

    var id: String { rawValue }

    var title: String {
        switch self {
        case .recommended:
            return "추천"
        case .following:
            return "팔로잉"
        case .latest:
            return "최신"
        }
    }
}

private struct FeedActionCandidate: Identifiable {
    let id = UUID()
    let post: FeedPost
    let target: PostDetailTarget
}

private struct FeedFeedbackAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

private struct FeedQuickComposeSheet: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @FocusState private var isFocused: Bool

    let onPublished: () -> Void

    @State private var draftText = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("취소") {
                    dismiss()
                }
                .foregroundStyle(primaryText)

                Spacer()

                Text("새로운 스레드")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(primaryText)

                Spacer()

                Button {
                    Task { await submit() }
                } label: {
                    if isSubmitting {
                        ProgressView()
                            .controlSize(.small)
                            .frame(width: 48, height: 28)
                    } else {
                        Text("게시")
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(submitDisabled ? Color.gray.opacity(0.35) : submitFill)
                )
                .foregroundStyle(submitDisabled ? primaryText.opacity(0.6) : submitText)
                .disabled(submitDisabled)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            Divider()
                .overlay(strokeColor)

            HStack(alignment: .top, spacing: 10) {
                if let user = appStore.user {
                    ProfileAvatarImage(
                        imageURL: resolveImageURL(
                            user.profileImage,
                            apiBaseURL: appStore.apiBaseURL,
                            frontendBaseURL: appStore.frontendBaseURL,
                            cacheBuster: appStore.profileImageCacheBuster,
                        ),
                        fallbackText: String(user.username.prefix(1)).uppercased(),
                        size: 38
                    )
                } else {
                    Circle()
                        .fill(surfaceBackground)
                        .frame(width: 38, height: 38)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(appStore.user?.username ?? "guest")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(primaryText)

                    ZStack(alignment: .topLeading) {
                        if draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text("새로운 소식이 있나요?")
                                .font(.title3.weight(.regular))
                                .foregroundStyle(secondaryText)
                                .padding(.horizontal, 4)
                                .padding(.top, 8)
                        }

                        TextEditor(text: $draftText)
                            .scrollContentBackground(.hidden)
                            .foregroundStyle(primaryText)
                            .focused($isFocused)
                            .frame(minHeight: 180)
                            .padding(.horizontal, 0)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.top, 6)
            }

            Spacer(minLength: 0)

            HStack(spacing: 20) {
                Image(systemName: "photo")
                Image(systemName: "text.quote")
                Image(systemName: "quote.bubble")
                Image(systemName: "ellipsis.circle")
            }
            .font(.title3.weight(.medium))
            .foregroundStyle(secondaryText.opacity(0.95))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
        }
        .background(backgroundColor)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                isFocused = true
            }
        }
    }

    private var submitDisabled: Bool {
        isSubmitting || draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var backgroundColor: Color {
        colorScheme == .dark ? .black : Color(.systemBackground)
    }

    private var surfaceBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.06) : Color.black.opacity(0.04)
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : .primary
    }

    private var secondaryText: Color {
        colorScheme == .dark ? Color.gray.opacity(0.95) : .secondary
    }

    private var strokeColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.1) : Color.black.opacity(0.08)
    }

    private var submitFill: Color {
        colorScheme == .dark ? .white : .black
    }

    private var submitText: Color {
        colorScheme == .dark ? .black : .white
    }

    private func submit() async {
        guard let repository = appStore.makeFeedRepository() else {
            errorMessage = "세션을 확인한 뒤 다시 시도해 주세요."
            return
        }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let trimmed = draftText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let firstLine = trimmed.split(separator: "\n").first.map(String.init) ?? "새 글"
        let title = String(firstLine.prefix(70))

        do {
            _ = try await repository.createPost(
                title: title.isEmpty ? "새 글" : title,
                content: trimmed,
                category: "general",
                isPublished: true,
                contentMarkdown: trimmed,
            )
            onPublished()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct HomeHeaderLogoView: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Group {
            if let image = HomeHeaderResourceImageLoader.homeLogoImage(preferDarkFallback: colorScheme == .dark) {
                platformImageView(image)
            } else {
                Image(systemName: "cube.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(colorScheme == .dark ? .white : .black)
            }
        }
        .frame(width: 40, height: 40)
        .accessibilityLabel("앱 로고")
        .accessibilityAddTraits(.isImage)
    }

    @ViewBuilder
    private func platformImageView(_ image: HomeHeaderPlatformImage) -> some View {
        #if canImport(UIKit)
        Image(uiImage: image)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
        #elseif canImport(AppKit)
        Image(nsImage: image)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
        #endif
    }
}

private enum HomeHeaderResourceImageLoader {
    static func homeLogoImage(preferDarkFallback: Bool) -> HomeHeaderPlatformImage? {
        if let svgImage = imageFromEmbeddedSVG(named: "logo", subdirectory: "App") {
            return svgImage
        }

        if preferDarkFallback,
           let fallback = image(named: "block-logo-dark-128", ext: "png", subdirectory: "App") {
            return fallback
        }

        if let fallback = image(named: "block-logo", ext: "png", subdirectory: "App") {
            return fallback
        }

        return image(named: "block-logo-dark", ext: "png", subdirectory: "App")
    }

    static func image(named: String, ext: String, subdirectory: String) -> HomeHeaderPlatformImage? {
        let bundleCandidates: [Bundle] = [Bundle.main, Bundle.module] + Bundle.allBundles + Bundle.allFrameworks

        for bundle in bundleCandidates {
            if let url = resourceURL(
                in: bundle,
                named: named,
                ext: ext,
                subdirectory: subdirectory,
            ) {
                #if canImport(UIKit)
                return UIImage(contentsOfFile: url.path)
                #elseif canImport(AppKit)
                return NSImage(contentsOfFile: url.path)
                #endif
            }
        }
        return nil
    }

    static func imageFromEmbeddedSVG(named: String, subdirectory: String) -> HomeHeaderPlatformImage? {
        let bundleCandidates: [Bundle] = [Bundle.main, Bundle.module] + Bundle.allBundles + Bundle.allFrameworks

        for bundle in bundleCandidates {
            guard let url = resourceURL(
                in: bundle,
                named: named,
                ext: "svg",
                subdirectory: subdirectory,
            ) else {
                continue
            }
            guard let svgMarkup = try? String(contentsOf: url, encoding: .utf8) else {
                continue
            }
            guard let imageData = decodeEmbeddedBase64Image(from: svgMarkup) else {
                continue
            }

            #if canImport(UIKit)
            if let image = UIImage(data: imageData) {
                return image
            }
            #elseif canImport(AppKit)
            if let image = NSImage(data: imageData) {
                return image
            }
            #endif
        }
        return nil
    }

    private static func decodeEmbeddedBase64Image(from svgMarkup: String) -> Data? {
        guard let markerRange = svgMarkup.range(of: "base64,") else {
            return nil
        }
        let payloadStart = markerRange.upperBound
        guard let payloadEnd = svgMarkup[payloadStart...].firstIndex(of: "\"") else {
            return nil
        }

        let rawBase64 = String(svgMarkup[payloadStart..<payloadEnd])
            .replacingOccurrences(of: "\n", with: "")
            .replacingOccurrences(of: "\r", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !rawBase64.isEmpty else { return nil }
        return Data(base64Encoded: rawBase64)
    }

    private static func resourceURL(
        in bundle: Bundle,
        named: String,
        ext: String,
        subdirectory: String?,
    ) -> URL? {
        if let subdirectory,
           let nested = bundle.url(forResource: named, withExtension: ext, subdirectory: subdirectory) {
            return nested
        }
        return bundle.url(forResource: named, withExtension: ext)
    }
}
