import SwiftUI
import UIKit
import WebKit

struct PostDetailView: View {
    let target: PostDetailTarget
    let repository: FeedRepository
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.colorScheme) private var colorScheme

    @StateObject private var vm = PostDetailViewModel()
    @State private var draftComment = ""
    @State private var isBodyLayoutReady = false
    @FocusState private var isReplyComposerFocused: Bool
    @State private var detailOpenedAt = Date()
    @State private var didEmitFirstBodyPaint = false
    @State private var didEmitFirstCommentsPaint = false
    @State private var mediaViewerContext: MediaViewerContext?

    var body: some View {
        Group {
            if vm.isLoading && vm.post == nil {
                PostDetailSkeletonView()
                    .foregroundStyle(primaryText)
            } else if let post = vm.post {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let author = post.author {
                            PostHeaderMetaView(
                                author: author,
                                cacheBuster: cacheBuster(for: author.id),
                                createdAt: post.createdAt,
                                appStore: appStore
                            )
                        }

                        if shouldShowTitle(for: post) {
                            Text(post.title)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(primaryText)
                                .multilineTextAlignment(.leading)
                        }

                        ZStack(alignment: .topLeading) {
                            PostBodySection(
                                post: post,
                                colorScheme: colorScheme,
                                suppressYouTubeEmbeds: YouTubeMediaResolver.firstVideoID(
                                    in: [post.content, post.contentMarkdown, post.excerpt, post.thumbnail] + (post.images ?? []).map(Optional.some)
                                ) != nil
                            ) {
                                isBodyLayoutReady = true
                            }

                            if !isBodyLayoutReady {
                                VStack(alignment: .leading, spacing: 8) {
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(surfaceBackground)
                                        .frame(height: 16)
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(surfaceBackground)
                                        .frame(height: 16)
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(surfaceBackground)
                                        .frame(width: 220, height: 16)
                                }
                                .padding(.vertical, 4)
                            }
                        }

                        let youtubeVideoID = YouTubeMediaResolver.firstVideoID(
                            in: [post.thumbnail] + (post.images ?? []).map(Optional.some) + [post.content, post.contentMarkdown, post.excerpt]
                        )
                        if let youtubeVideoID {
                            YouTubeInlinePlayerView(videoID: youtubeVideoID)
                                .frame(maxWidth: .infinity)
                                .frame(height: 220)
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(strokeColor, lineWidth: 1)
                                )
                        }

                        let detailMediaURLs = detailMediaURLs(for: post)
                        if !detailMediaURLs.isEmpty {
                            PostDetailMediaCarouselView(
                                imageURLs: detailMediaURLs,
                                surfaceBackground: surfaceBackground,
                                strokeColor: strokeColor,
                                secondaryText: secondaryText,
                                onTapImage: { index in
                                    mediaViewerContext = MediaViewerContext(
                                        imageURLs: detailMediaURLs,
                                        initialIndex: index
                                    )
                                }
                            )
                        }

                        Divider()
                            .overlay(strokeColor)

                        PostDetailActionBar(
                            post: post,
                            isSubmitting: vm.isSubmitting,
                            shareURL: shareURL(for: post),
                            secondaryTint: secondaryText,
                            onLike: {
                                Task { await vm.vote(type: .upvote) }
                            },
                            onComment: {
                                vm.prepareCommentDraft()
                                isReplyComposerFocused = true
                            }
                        )

                        if let message = post.message {
                            Text(message)
                                .font(.caption)
                                .foregroundStyle(secondaryText)
                        }

                        if let errorMessage = vm.errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red.opacity(0.95))
                        }

                        Divider()
                            .overlay(strokeColor)

                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("댓글")
                                    .font(.headline)
                                    .foregroundStyle(primaryText)
                                Spacer()
                                Picker(
                                    "정렬",
                                    selection: Binding(
                                        get: { vm.selectedCommentSort },
                                        set: { nextSort in
                                            Task { await vm.changeCommentSort(to: nextSort) }
                                        }
                                    )
                                ) {
                                    ForEach(CommentSort.allCases) { sort in
                                        Text(sort.title).tag(sort)
                                    }
                                }
                                .pickerStyle(.segmented)
                                .frame(width: 170)
                            }

                            if vm.isCommentsLoading {
                                HStack(spacing: 8) {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text("댓글 불러오는 중")
                                        .font(.subheadline)
                                        .foregroundStyle(secondaryText)
                                }
                                .padding(.vertical, 10)
                            } else if vm.comments.isEmpty {
                                Text("아직 댓글이 없습니다")
                                    .font(.callout)
                                    .foregroundStyle(secondaryText)
                                    .padding(.vertical, 10)
                            } else {
                                VStack(alignment: .leading, spacing: 14) {
                                    ForEach(vm.comments) { comment in
                                        CommentNodeView(
                                            comment: comment,
                                            depth: 0,
                                            appStore: appStore,
                                            reactionInFlightIDs: vm.commentReactionInFlightIDs,
                                            isExpanded: vm.expandedCommentIDs.contains(comment.id),
                                            isReplyLoading: vm.replyLoadingIDs.contains(comment.id),
                                            canLoadMoreReplies: vm.replyHasMoreByCommentID[comment.id] ?? false,
                                            onLike: { targetComment in
                                                Task { await vm.toggleCommentLike(targetComment) }
                                            },
                                            onReply: { targetComment in
                                                vm.startReplyDraft(for: targetComment)
                                                isReplyComposerFocused = true
                                            },
                                            onToggleReplies: { targetComment in
                                                Task { await vm.toggleReplies(for: targetComment) }
                                            },
                                            onLoadMoreReplies: { targetComment in
                                                Task { await vm.loadMoreReplies(for: targetComment) }
                                            }
                                        )
                                    }
                                }
                            }

                            if vm.canLoadMoreComments {
                                Button {
                                    Task { await vm.loadMoreComments() }
                                } label: {
                                    HStack(spacing: 8) {
                                        if vm.isLoadingMoreComments {
                                            ProgressView()
                                                .controlSize(.small)
                                        }
                                        Text(vm.isLoadingMoreComments ? "댓글 불러오는 중..." : "댓글 더 보기")
                                            .font(.subheadline.weight(.semibold))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                }
                                .buttonStyle(.bordered)
                                .tint(borderTint)
                                .foregroundStyle(primaryText)
                                .disabled(vm.isLoadingMoreComments)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 170)
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("해당 글을 불러오지 못했습니다")
                        .font(.headline)
                        .foregroundStyle(primaryText)
                    if let errorMessage = vm.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.95))
                    } else {
                        Text("네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.")
                            .font(.footnote)
                            .foregroundStyle(secondaryText)
                    }
                }
                .padding()
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if vm.post != nil {
                BottomReplyComposer(
                    text: $draftComment,
                    mode: vm.replyDraftMode,
                    targetUsername: vm.activeReplyTarget?.username,
                    isSubmitting: vm.isSubmitting,
                    isFocused: $isReplyComposerFocused,
                    profileImage: appStore.user?.profileImage,
                    profileCacheBuster: appStore.profileImageCacheBuster,
                    appStore: appStore,
                    onCancelReply: {
                        vm.cancelReplyDraft()
                    },
                    onSubmit: {
                        Task {
                            let success = await vm.createComment(content: draftComment)
                            guard success else { return }
                            draftComment = ""
                            isReplyComposerFocused = false
                        }
                    }
                )
                .padding(.bottom, tabShellComposerBottomPadding)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(backgroundColor)
        .navigationTitle("스레드")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            detailOpenedAt = Date()
            didEmitFirstBodyPaint = false
            didEmitFirstCommentsPaint = false
            vm.configure(target: target, repository: repository)
            await vm.load()
            await vm.trackView()
        }
        .onChange(of: vm.post?.id) { _, _ in
            isBodyLayoutReady = false
            didEmitFirstBodyPaint = false
            didEmitFirstCommentsPaint = false
            detailOpenedAt = Date()
        }
        .onChange(of: isBodyLayoutReady) { _, ready in
            guard ready, !didEmitFirstBodyPaint else { return }
            didEmitFirstBodyPaint = true
            emitPaintTrace(event: "post_detail.first_body_paint")
        }
        .onChange(of: vm.comments.map(\.id)) { _, ids in
            guard !ids.isEmpty, !didEmitFirstCommentsPaint else { return }
            didEmitFirstCommentsPaint = true
            emitPaintTrace(event: "post_detail.first_comments_paint")
        }
        .fullScreenCover(item: $mediaViewerContext) { context in
            PostDetailMediaViewer(
                imageURLs: context.imageURLs,
                initialIndex: context.initialIndex
            )
        }
    }

    private func emitPaintTrace(event: String) {
        let elapsed = max(0, Int(Date().timeIntervalSince(detailOpenedAt) * 1000))
        IOSRunTrace.emit(
            event,
            category: "performance",
            fields: ["elapsed_ms": "\(elapsed)"]
        )
    }

    private func shareURL(for post: MobilePost) -> URL? {
        guard let frontendBaseURL = appStore.frontendBaseURL else { return nil }
        return frontendBaseURL
            .appendingPathComponent("p")
            .appendingPathComponent(post.id)
    }

    private func cacheBuster(for authorId: String?) -> String? {
        guard
            let authorId,
            let currentUserId = appStore.user?.id,
            authorId == currentUserId
        else {
            return nil
        }
        return appStore.profileImageCacheBuster
    }

    private var backgroundColor: Color {
        colorScheme == .dark ? .black : Color(.systemBackground)
    }

    private var surfaceBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.09) : Color.black.opacity(0.06)
    }

    private var strokeColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.12) : Color.black.opacity(0.12)
    }

    private var borderTint: Color {
        colorScheme == .dark ? Color.white.opacity(0.22) : Color.black.opacity(0.18)
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : Color.black.opacity(0.95)
    }

    private var secondaryText: Color {
        colorScheme == .dark ? Color.white.opacity(0.65) : Color.black.opacity(0.62)
    }

    private var tabShellComposerBottomPadding: CGFloat {
        86
    }

    private func detailMediaURLs(for post: MobilePost) -> [URL] {
        let mediaCandidates: [String]
        if let images = post.images?
            .compactMap(normalized)
            .filter({ !YouTubeMediaResolver.isYouTubeMediaLocator($0) }), !images.isEmpty
        {
            mediaCandidates = images
        } else if let thumbnail = normalized(post.thumbnail),
                  !YouTubeMediaResolver.isYouTubeMediaLocator(thumbnail)
        {
            mediaCandidates = [thumbnail]
        } else {
            return []
        }

        var deduped: [String] = []
        var seen = Set<String>()
        for candidate in mediaCandidates {
            let dedupeKey = normalizeMediaLocator(candidate)
            guard !dedupeKey.isEmpty else { continue }
            if seen.insert(dedupeKey).inserted {
                deduped.append(candidate)
            }
        }

        let bodyCandidates = [post.content, post.contentMarkdown].compactMap(normalized)
        let filtered = deduped.filter { candidate in
            for body in bodyCandidates where containsSameMedia(body: body, thumbnail: candidate) {
                return false
            }
            return true
        }

        return filtered.compactMap { candidate in
            resolveImageURL(
                candidate,
                apiBaseURL: appStore.apiBaseURL,
                frontendBaseURL: appStore.frontendBaseURL
            )
        }
    }

    private func containsSameMedia(body: String, thumbnail: String) -> Bool {
        let normalizedBody = normalizeMediaLocator(body)
        let normalizedThumb = normalizeMediaLocator(thumbnail)
        guard !normalizedThumb.isEmpty else { return false }
        return normalizedBody.contains(normalizedThumb)
    }

    private func normalizeMediaLocator(_ value: String) -> String {
        let decoded = value
            .replacingOccurrences(of: "&amp;", with: "&")
            .lowercased()

        if let url = URL(string: decoded), let host = url.host {
            return "\(host)\(url.path)"
        }

        if let questionMark = decoded.firstIndex(of: "?") {
            return String(decoded[..<questionMark])
        }
        return decoded
    }

    private func normalized(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func shouldShowTitle(for post: MobilePost) -> Bool {
        guard let title = normalized(post.title) else { return false }
        let titleKey = normalizedComparisonKey(title)
        guard !titleKey.isEmpty else { return false }

        let bodyCandidates = [post.content, post.contentMarkdown, post.excerpt]
            .compactMap(normalized)
            .map(normalizedComparisonKey)
            .filter { !$0.isEmpty }

        guard !bodyCandidates.isEmpty else { return true }
        for candidate in bodyCandidates where candidate == titleKey || candidate.hasPrefix("\(titleKey) ") {
            return false
        }
        return true
    }

    private func normalizedComparisonKey(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }
}

private struct PostDetailSkeletonView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.secondary.opacity(0.18))
                .frame(height: 220)
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.secondary.opacity(0.18))
                .frame(width: 180, height: 18)
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.secondary.opacity(0.14))
                .frame(height: 16)
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.secondary.opacity(0.14))
                .frame(height: 16)
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.secondary.opacity(0.14))
                .frame(width: 220, height: 16)
        }
        .padding(16)
    }
}

private struct MediaViewerContext: Identifiable {
    let id = UUID()
    let imageURLs: [URL]
    let initialIndex: Int
}

private struct PostDetailMediaCarouselView: View {
    let imageURLs: [URL]
    let surfaceBackground: Color
    let strokeColor: Color
    let secondaryText: Color
    let onTapImage: (Int) -> Void

    var body: some View {
        let screenWidth = max(1, UIScreen.main.bounds.width - 32)
        let hasMultipleImages = imageURLs.count > 1
        let cardWidth = hasMultipleImages ? min(340, max(240, screenWidth * 0.84)) : screenWidth
        let cardHeight = min(420, max(240, cardWidth * 1.02))

        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 10) {
                ForEach(Array(imageURLs.enumerated()), id: \.offset) { index, imageURL in
                    RemoteImageView(imageURL: imageURL, contentMode: .fill) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(surfaceBackground)
                            ProgressView()
                        }
                    } failure: {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(surfaceBackground)
                            .overlay(
                                Image(systemName: "photo")
                                    .foregroundStyle(secondaryText),
                                alignment: .center
                            )
                    }
                    .frame(width: cardWidth, height: cardHeight)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(strokeColor, lineWidth: 1)
                    )
                    .contentShape(Rectangle())
                    .onTapGesture {
                        onTapImage(index)
                    }
                }
            }
            .padding(.trailing, hasMultipleImages ? 20 : 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: cardHeight)
    }
}

private struct PostDetailMediaViewer: View {
    let imageURLs: [URL]
    @Environment(\.dismiss) private var dismiss
    @State private var selectedIndex: Int

    init(imageURLs: [URL], initialIndex: Int) {
        self.imageURLs = imageURLs
        let safeUpperBound = max(0, imageURLs.count - 1)
        _selectedIndex = State(initialValue: min(max(0, initialIndex), safeUpperBound))
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            TabView(selection: $selectedIndex) {
                ForEach(Array(imageURLs.enumerated()), id: \.offset) { index, imageURL in
                    RemoteImageView(imageURL: imageURL, contentMode: .fit) {
                        ProgressView()
                            .tint(.white)
                    } failure: {
                        VStack(spacing: 10) {
                            Image(systemName: "photo")
                                .font(.title2)
                            Text("이미지를 불러오지 못했습니다")
                                .font(.footnote)
                        }
                        .foregroundStyle(.white.opacity(0.85))
                    }
                    .tag(index)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: imageURLs.count > 1 ? .automatic : .never))

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.95))
                    .padding(16)
            }
            .buttonStyle(.plain)
        }
    }
}

private struct PostHeaderMetaView: View {
    let author: PostAuthor
    let cacheBuster: String?
    let createdAt: String?
    let appStore: AppStore

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            ProfileAvatarImage(
                imageURL: resolveImageURL(
                    author.profileImage,
                    apiBaseURL: appStore.apiBaseURL,
                    frontendBaseURL: appStore.frontendBaseURL,
                    cacheBuster: cacheBuster
                ),
                fallbackText: initial(author.username),
                size: 34
            )

            HStack(spacing: 6) {
                Text(author.username ?? "익명")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text("·")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(RelativeTimeFormatter.string(from: createdAt))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }
}

private struct PostDetailActionBar: View {
    let post: MobilePost
    let isSubmitting: Bool
    let shareURL: URL?
    let secondaryTint: Color
    let onLike: () -> Void
    let onComment: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            actionButton(
                icon: post.userVote == .upvote ? "heart.fill" : "heart",
                value: post.likeCount ?? 0,
                tint: post.userVote == .upvote ? .red : secondaryTint,
                action: onLike
            )
            .frame(width: 72, alignment: .leading)

            actionButton(
                icon: "bubble.left",
                value: post.commentCount ?? 0,
                tint: secondaryTint,
                action: onComment
            )
            .frame(width: 72, alignment: .leading)

            HStack(spacing: 6) {
                Image(systemName: "eye")
                Text("\(post.viewCount ?? 0)")
                    .monospacedDigit()
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(secondaryTint)
            .frame(width: 72, alignment: .leading)

            shareAction
                .frame(minWidth: 38, alignment: .leading)

            Spacer(minLength: 4)
        }
        .opacity(isSubmitting ? 0.7 : 1)
        .animation(.easeInOut(duration: 0.15), value: isSubmitting)
    }

    private func actionButton(
        icon: String,
        value: Int,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text("\(value)")
                    .monospacedDigit()
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(tint)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting)
    }

    @ViewBuilder
    private var shareAction: some View {
        if let shareURL {
            ShareLink(item: shareURL) {
                Image(systemName: "paperplane")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(secondaryTint.opacity(0.95))
            }
            .buttonStyle(.plain)
        } else {
            Image(systemName: "paperplane")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(secondaryTint.opacity(0.6))
        }
    }
}

private struct BottomReplyComposer: View {
    @Binding var text: String
    let mode: PostDetailViewModel.ReplyDraftMode
    let targetUsername: String?
    let isSubmitting: Bool
    let isFocused: FocusState<Bool>.Binding
    let profileImage: String?
    let profileCacheBuster: String?
    let appStore: AppStore
    let onCancelReply: () -> Void
    let onSubmit: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            if mode == .reply, let targetUsername, !targetUsername.isEmpty {
                HStack(spacing: 6) {
                    Text("@\(targetUsername)에게 답글")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button("취소") {
                        onCancelReply()
                    }
                    .font(.caption.weight(.medium))
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 14)
            }

            HStack(alignment: .center, spacing: 10) {
                ProfileAvatarImage(
                    imageURL: resolveImageURL(
                        profileImage,
                        apiBaseURL: appStore.apiBaseURL,
                        frontendBaseURL: appStore.frontendBaseURL,
                        cacheBuster: profileCacheBuster
                    ),
                    fallbackText: initial(appStore.user?.username),
                    size: 34
                )

                HStack(spacing: 12) {
                    TextField(
                        mode == .reply ? "답글 달기..." : "스레드에 추가...",
                        text: $text,
                        axis: .vertical
                    )
                    .lineLimit(1 ... 2)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .foregroundStyle(.primary)
                    .focused(isFocused)

                    HStack(spacing: 12) {
                        Image(systemName: "photo.on.rectangle")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary.opacity(0.82))
                        Image(systemName: "face.smiling")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary.opacity(0.82))
                        Button {
                            onSubmit()
                        } label: {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundStyle(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .gray : .blue)
                        }
                        .buttonStyle(.plain)
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)
                    }
                }
                .padding(.horizontal, 14)
                .frame(minHeight: 52)
                .background(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(Color(.tertiarySystemBackground))
                )
            }
            .padding(.horizontal, 14)
            .padding(.top, mode == .reply ? 2 : 8)
            .padding(.bottom, 10)
        }
        .background(.ultraThinMaterial)
        .overlay(
            Rectangle()
                .fill(Color.primary.opacity(0.08))
                .frame(height: 1),
            alignment: .top
        )
    }
}

private struct CommentNodeView: View {
    let comment: PostComment
    let depth: Int
    let appStore: AppStore
    let reactionInFlightIDs: Set<String>
    let isExpanded: Bool
    let isReplyLoading: Bool
    let canLoadMoreReplies: Bool
    let onLike: (PostComment) -> Void
    let onReply: (PostComment) -> Void
    let onToggleReplies: (PostComment) -> Void
    let onLoadMoreReplies: (PostComment) -> Void

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                ProfileAvatarImage(
                    imageURL: resolveImageURL(
                        comment.author?.profileImage,
                        apiBaseURL: appStore.apiBaseURL,
                        frontendBaseURL: appStore.frontendBaseURL
                    ),
                    fallbackText: initial(comment.author?.username),
                    size: depth == 0 ? 28 : 24
                )

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Text(comment.author?.username ?? "익명")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(primaryText)
                        Text("·")
                            .font(.subheadline)
                            .foregroundStyle(secondaryText.opacity(0.8))
                        Text(RelativeTimeFormatter.string(from: comment.createdAt))
                            .font(.subheadline)
                            .foregroundStyle(secondaryText)
                    }

                    Text(comment.content)
                        .font(.body)
                        .foregroundStyle(bodyText)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 14) {
                        Button {
                            onLike(comment)
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: (comment.userLiked ?? false) ? "heart.fill" : "heart")
                                Text("\(comment.likesCount ?? 0)")
                            }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle((comment.userLiked ?? false) ? Color.red : secondaryText)
                        }
                        .buttonStyle(.plain)
                        .disabled(reactionInFlightIDs.contains(comment.id))

                        HStack(spacing: 4) {
                            Image(systemName: "bubble.left")
                            Text("\(replyCount)")
                                .monospacedDigit()
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(secondaryText)

                        Button {
                            onReply(comment)
                        } label: {
                            Text("답글 달기")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(secondaryText)
                        }
                        .buttonStyle(.plain)

                        Spacer(minLength: 0)
                    }
                }
            }

            if depth == 0, hasReplies {
                Button {
                    onToggleReplies(comment)
                } label: {
                    HStack(spacing: 8) {
                        if isReplyLoading {
                            ProgressView()
                                .controlSize(.small)
                        }
                        Text(isExpanded ? "답글 숨기기" : "답글 보기")
                            .font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(secondaryText)
                }
                .buttonStyle(.plain)
                .padding(.leading, 36)
            }

            if depth == 0, isExpanded {
                let replies = comment.replies ?? []
                if !replies.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(replies) { reply in
                            CommentNodeView(
                                comment: reply,
                                depth: depth + 1,
                                appStore: appStore,
                                reactionInFlightIDs: reactionInFlightIDs,
                                isExpanded: true,
                                isReplyLoading: false,
                                canLoadMoreReplies: false,
                                onLike: onLike,
                                onReply: onReply,
                                onToggleReplies: onToggleReplies,
                                onLoadMoreReplies: onLoadMoreReplies
                            )
                        }
                    }
                    .padding(.leading, 22)
                    .overlay(
                        Rectangle()
                            .fill(secondaryText.opacity(0.25))
                            .frame(width: 1),
                        alignment: .leading
                    )
                }

                if canLoadMoreReplies {
                    Button {
                        onLoadMoreReplies(comment)
                    } label: {
                        HStack(spacing: 8) {
                            if isReplyLoading {
                                ProgressView()
                                    .controlSize(.small)
                            }
                            Text(isReplyLoading ? "답글 불러오는 중..." : "답글 더 보기")
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(secondaryText)
                    }
                    .buttonStyle(.plain)
                    .padding(.leading, 36)
                }
            }
        }
        .padding(.leading, depth == 0 ? 0 : CGFloat(min(depth, 3)) * 14)
        .padding(.vertical, 2)
    }

    private var hasReplies: Bool {
        (comment.repliesCount ?? 0) > 0 || !(comment.replies ?? []).isEmpty || canLoadMoreReplies
    }

    private var replyCount: Int {
        let loadedReplies = comment.replies?.count ?? 0
        return comment.repliesCount ?? loadedReplies
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : Color.black.opacity(0.94)
    }

    private var bodyText: Color {
        colorScheme == .dark ? Color.white.opacity(0.9) : Color.black.opacity(0.9)
    }

    private var secondaryText: Color {
        colorScheme == .dark ? Color.white.opacity(0.65) : Color.black.opacity(0.6)
    }
}

private struct PostBodySection: View {
    let post: MobilePost
    let colorScheme: ColorScheme
    var suppressYouTubeEmbeds: Bool = false
    var onBodyReady: () -> Void = {}

    var body: some View {
        if let payload = resolveBodyPayload() {
            renderedBody(payload)
                .onAppear {
                    if payload.format != .html {
                        onBodyReady()
                    }
                }
        } else if let excerpt = normalized(post.excerpt) {
            Text(excerpt)
                .font(.body)
                .lineSpacing(4)
                .foregroundStyle(bodyTextColor)
        }
    }

    @ViewBuilder
    private func renderedBody(_ payload: PostBodyPayload) -> some View {
        switch payload.format {
        case .html:
            HTMLArticleView(
                rawHTML: payload.text,
                isDarkMode: colorScheme == .dark,
                onFirstLayout: onBodyReady
            )

        case .markdown:
            if let attributed = try? AttributedString(
                markdown: payload.text,
                options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .full)
            ) {
                Text(attributed)
                    .font(.body)
                    .lineSpacing(4)
                    .foregroundStyle(bodyTextColor)
                    .textSelection(.enabled)
            } else {
                Text(payload.text)
                    .font(.body)
                    .lineSpacing(4)
                    .foregroundStyle(bodyTextColor)
                    .textSelection(.enabled)
            }

        case .plain:
            Text(payload.text)
                .font(.body)
                .lineSpacing(4)
                .foregroundStyle(bodyTextColor)
                .textSelection(.enabled)
        }
    }

    private var bodyTextColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.92) : Color.black.opacity(0.9)
    }

    private func resolveBodyPayload() -> PostBodyPayload? {
        let contentType = normalized(post.contentType)?.lowercased() ?? ""
        let htmlContent = normalized(post.content)
        let markdownContent = normalized(post.contentMarkdown)

        if contentType == "html", let htmlContent {
            let sanitized = suppressYouTubeEmbeds ? removingYouTubeEmbeds(from: htmlContent) : htmlContent
            return PostBodyPayload(text: sanitized, format: .html)
        }

        if contentType == "markdown" {
            if let markdownContent {
                return PostBodyPayload(text: markdownContent, format: .markdown)
            }
            if let htmlContent, looksLikeHTML(htmlContent) {
                let sanitized = suppressYouTubeEmbeds ? removingYouTubeEmbeds(from: htmlContent) : htmlContent
                return PostBodyPayload(text: sanitized, format: .html)
            }
        }

        if let htmlContent {
            if looksLikeHTML(htmlContent) {
                let sanitized = suppressYouTubeEmbeds ? removingYouTubeEmbeds(from: htmlContent) : htmlContent
                return PostBodyPayload(text: sanitized, format: .html)
            }
            return PostBodyPayload(text: decodeHTMLEntities(htmlContent), format: .plain)
        }

        if let markdownContent {
            return PostBodyPayload(text: markdownContent, format: .markdown)
        }

        return nil
    }

    private func normalized(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func looksLikeHTML(_ text: String) -> Bool {
        text.range(of: "<\\s*[a-zA-Z][^>]*>", options: .regularExpression) != nil
    }

    private func decodeHTMLEntities(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }

    private func removingYouTubeEmbeds(from html: String) -> String {
        var cleaned = html
        let patterns = [
            #"(?is)<iframe[^>]*src=['"][^'"]*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)[^'"]*['"][^>]*>.*?</iframe>"#,
            #"(?is)<div[^>]*data-youtube-video[^>]*>.*?</div>"#,
            #"(?is)<a[^>]*href=['"][^'"]*(?:youtube\.com|youtu\.be)[^'"]*['"][^>]*>.*?</a>"#,
        ]

        for pattern in patterns {
            cleaned = cleaned.replacingOccurrences(
                of: pattern,
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
        }

        cleaned = cleaned.replacingOccurrences(
            of: #"(?is)https?://(?:www\.)?(?:youtube\.com|youtu\.be)\S*"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        return cleaned
    }
}

private struct PostBodyPayload {
    let text: String
    let format: PostBodyFormat
}

private enum PostBodyFormat {
    case html
    case markdown
    case plain
}

private struct HTMLArticleView: View {
    let rawHTML: String
    let isDarkMode: Bool
    var onFirstLayout: () -> Void = {}
    @State private var dynamicHeight: CGFloat = 80

    var body: some View {
        AutoSizingHTMLView(
            html: wrappedDocument(rawHTML),
            dynamicHeight: $dynamicHeight,
            onFirstLayout: onFirstLayout
        )
        .frame(height: max(80, dynamicHeight))
    }

    private func wrappedDocument(_ body: String) -> String {
        let textColor = isDarkMode ? "#F4F6FB" : "#111827"
        let headingColor = isDarkMode ? "#FFFFFF" : "#0F172A"
        let blockquoteColor = isDarkMode ? "#D5DBE8" : "#334155"
        let blockquoteBg = isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.04)"
        let codeBg = isDarkMode ? "#101722" : "#F1F5F9"
        let codeBorder = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)"
        let inlineCodeBg = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)"
        let linkColor = isDarkMode ? "#7CC6FF" : "#2563EB"
        let hrColor = isDarkMode ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.14)"
        let tableBorder = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.16)"
        let thBg = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"
        let figcaptionColor = isDarkMode ? "#A8B1C2" : "#64748B"
        let mediaBg = isDarkMode ? "#0B0E14" : "#E2E8F0"
        let colorScheme = isDarkMode ? "dark" : "light"

        return """
        <!doctype html>
        <html lang="ko">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            :root {
              color-scheme: \(colorScheme);
            }
            html, body {
              margin: 0;
              padding: 0;
              background: transparent;
              color: \(textColor);
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", "Noto Sans KR", "Helvetica Neue", sans-serif;
              font-size: 17px;
              line-height: 1.72;
              word-break: keep-all;
              overflow-wrap: anywhere;
              width: 100%;
              max-width: 100%;
              overflow-x: hidden;
            }
            * {
              box-sizing: border-box;
            }
            body > * {
              max-width: 100% !important;
            }
            p { margin: 0 0 1em 0; }
            h1, h2, h3, h4, h5, h6 {
              margin: 1.1em 0 0.55em;
              line-height: 1.3;
              color: \(headingColor);
              letter-spacing: -0.015em;
            }
            h1 { font-size: 1.58em; }
            h2 { font-size: 1.34em; }
            h3 { font-size: 1.2em; }
            ul, ol {
              margin: 0.2em 0 1em 0;
              padding-left: 1.2em;
            }
            li { margin: 0.28em 0; }
            blockquote {
              margin: 0.2em 0 1.05em;
              padding: 0.3em 0.9em;
              border-left: 3px solid \(hrColor);
              color: \(blockquoteColor);
              background: \(blockquoteBg);
              border-radius: 0 10px 10px 0;
            }
            pre {
              margin: 0.2em 0 1.05em;
              padding: 14px;
              border-radius: 12px;
              overflow-x: auto;
              background: \(codeBg);
              border: 1px solid \(codeBorder);
            }
            code {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
              font-size: 0.92em;
            }
            p code, li code {
              background: \(inlineCodeBg);
              border-radius: 7px;
              padding: 0.12em 0.38em;
            }
            a {
              color: \(linkColor);
              text-decoration: none;
            }
            img, video, iframe {
              max-width: 100%;
              height: auto;
              border-radius: 12px;
            }
            table, pre {
              max-width: 100%;
            }
            .ios-youtube-card {
              display: block;
              position: relative;
              width: 100%;
              text-decoration: none;
              border-radius: 12px;
              overflow: hidden;
              margin: 0.2em 0 1.05em;
              background: \(mediaBg);
              border: 1px solid \(hrColor);
            }
            .ios-youtube-thumb {
              position: relative;
              width: 100%;
              padding-top: 56.25%;
              background: \(mediaBg);
            }
            .ios-youtube-thumb img {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              border-radius: 0;
            }
            .ios-youtube-thumb::after {
              content: "";
              position: absolute;
              inset: 0;
              background: linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0.36));
            }
            .ios-youtube-play {
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -50%);
              width: 64px;
              height: 64px;
              border-radius: 32px;
              background: rgba(0, 0, 0, 0.55);
              color: #FFFFFF;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 32px;
              line-height: 1;
              font-weight: 700;
            }
            .ios-youtube-badge {
              position: absolute;
              left: 10px;
              bottom: 10px;
              border-radius: 999px;
              background: rgba(0, 0, 0, 0.55);
              color: #FFFFFF;
              font-size: 12px;
              padding: 3px 9px;
            }
            figure {
              margin: 0.2em 0 1.05em;
            }
            figcaption {
              margin-top: 0.45em;
              color: \(figcaptionColor);
              font-size: 0.86em;
            }
            hr {
              border: none;
              border-top: 1px solid \(hrColor);
              margin: 1.1em 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 0.2em 0 1.05em;
            }
            th, td {
              border: 1px solid \(tableBorder);
              padding: 8px 10px;
              text-align: left;
            }
            th {
              background: \(thBg);
            }
          </style>
          <script>
            (function () {
              function extractYouTubeId(rawUrl) {
                if (!rawUrl) return null;
                try {
                  var url = new URL(rawUrl, window.location.origin);
                  var host = (url.hostname || "").toLowerCase();
                  var path = url.pathname || "";

                  if (host.indexOf("youtu.be") !== -1) {
                    var shortId = path.replace(/^\\//, "").split("/")[0];
                    return shortId || null;
                  }

                  if (host.indexOf("youtube.com") !== -1) {
                    if (path.indexOf("/watch") === 0) {
                      var watchId = url.searchParams.get("v");
                      return watchId || null;
                    }
                    if (path.indexOf("/embed/") === 0) {
                      return path.replace("/embed/", "").split("/")[0] || null;
                    }
                    if (path.indexOf("/shorts/") === 0) {
                      return path.replace("/shorts/", "").split("/")[0] || null;
                    }
                    if (path.indexOf("/live/") === 0) {
                      return path.replace("/live/", "").split("/")[0] || null;
                    }
                  }

                  var thumbMatch = rawUrl.match(/img\\.youtube\\.com\\/vi\\/([^/]+)/i);
                  if (thumbMatch && thumbMatch[1]) return thumbMatch[1];
                } catch (_) {
                  var fallbackThumb = String(rawUrl).match(/img\\.youtube\\.com\\/vi\\/([^/]+)/i);
                  if (fallbackThumb && fallbackThumb[1]) return fallbackThumb[1];
                }
                return null;
              }

              function buildEmbed(id) {
                var link = document.createElement("a");
                link.className = "ios-youtube-card";
                link.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
                link.target = "_blank";
                link.rel = "noopener noreferrer";

                var thumb = document.createElement("div");
                thumb.className = "ios-youtube-thumb";

                var image = document.createElement("img");
                image.src = "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/hqdefault.jpg";
                image.alt = "YouTube thumbnail";
                image.loading = "lazy";

                var play = document.createElement("span");
                play.className = "ios-youtube-play";
                play.textContent = "▶";

                var badge = document.createElement("span");
                badge.className = "ios-youtube-badge";
                badge.textContent = "YouTube";

                thumb.appendChild(image);
                thumb.appendChild(play);
                thumb.appendChild(badge);
                link.appendChild(thumb);
                return link;
              }

              function replaceAnchorWithEmbed(anchor, id) {
                if (!anchor || !anchor.parentNode) return;
                var wrapper = buildEmbed(id);
                var parentTag = anchor.parentElement ? anchor.parentElement.tagName.toLowerCase() : "";
                if (parentTag === "p" && anchor.parentElement.childNodes.length === 1) {
                  anchor.parentElement.replaceWith(wrapper);
                } else {
                  anchor.replaceWith(wrapper);
                }
              }

              function upgradeYouTubeAnchors() {
                var anchors = document.querySelectorAll("a[href]");
                anchors.forEach(function (anchor) {
                  var href = anchor.getAttribute("href");
                  var id = extractYouTubeId(href);
                  if (!id) return;
                  replaceAnchorWithEmbed(anchor, id);
                });
              }

              function upgradeYouTubeThumbnails() {
                var images = document.querySelectorAll("img[src]");
                images.forEach(function (img) {
                  var src = img.getAttribute("src");
                  var id = extractYouTubeId(src);
                  if (!id || !img.parentNode) return;

                  var wrapper = buildEmbed(id);
                  var parentTag = img.parentElement ? img.parentElement.tagName.toLowerCase() : "";
                  if (parentTag === "p" && img.parentElement.childNodes.length === 1) {
                    img.parentElement.replaceWith(wrapper);
                  } else {
                    img.replaceWith(wrapper);
                  }
                });
              }

              function run() {
                upgradeYouTubeAnchors();
                upgradeYouTubeThumbnails();
              }

              if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", run, { once: true });
              } else {
                run();
              }
            })();
          </script>
        </head>
        <body>\(body)</body>
        </html>
        """
    }
}

private struct AutoSizingHTMLView: UIViewRepresentable {
    let html: String
    @Binding var dynamicHeight: CGFloat
    var onFirstLayout: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(dynamicHeight: $dynamicHeight, onFirstLayout: onFirstLayout)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        if #available(iOS 10.0, *) {
            configuration.mediaTypesRequiringUserActionForPlayback = []
        }
        configuration.defaultWebpagePreferences.preferredContentMode = .mobile
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.dynamicHeight = $dynamicHeight
        context.coordinator.onFirstLayout = onFirstLayout
        if context.coordinator.lastHTML != html {
            context.coordinator.lastHTML = html
            context.coordinator.didReportFirstLayout = false
            webView.loadHTMLString(html, baseURL: URL(string: "https://www.youtube.com"))
        } else {
            context.coordinator.recalculateHeight(webView)
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var dynamicHeight: Binding<CGFloat>
        var lastHTML: String?
        var onFirstLayout: () -> Void
        var didReportFirstLayout = false

        init(dynamicHeight: Binding<CGFloat>, onFirstLayout: @escaping () -> Void) {
            self.dynamicHeight = dynamicHeight
            self.onFirstLayout = onFirstLayout
        }

        func webView(_ webView: WKWebView, didFinish _: WKNavigation!) {
            recalculateHeight(webView)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { [weak self, weak webView] in
                guard let self, let webView else { return }
                self.recalculateHeight(webView)
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self, weak webView] in
                guard let self, let webView else { return }
                self.recalculateHeight(webView)
            }
        }

        func webView(
            _: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard navigationAction.navigationType == .linkActivated,
                  let url = navigationAction.request.url
            else {
                decisionHandler(.allow)
                return
            }

            let host = (url.host ?? "").lowercased()
            if host.contains("youtube.com") || host.contains("youtu.be") {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func recalculateHeight(_ webView: WKWebView) {
            let script = """
            (function() {
              const body = document.body;
              const html = document.documentElement;
              return Math.max(
                body ? body.scrollHeight : 0,
                body ? body.offsetHeight : 0,
                html ? html.clientHeight : 0,
                html ? html.scrollHeight : 0,
                html ? html.offsetHeight : 0
              );
            })();
            """

            webView.evaluateJavaScript(script) { [weak self] result, _ in
                guard let self else { return }
                guard let value = result as? NSNumber else { return }
                let nextHeight = max(1, ceil(CGFloat(truncating: value)))
                if abs(self.dynamicHeight.wrappedValue - nextHeight) > 0.5 {
                    self.dynamicHeight.wrappedValue = nextHeight
                }
                if !self.didReportFirstLayout, nextHeight > 36 {
                    self.didReportFirstLayout = true
                    self.onFirstLayout()
                }
            }
        }
    }
}

private func initial(_ source: String?) -> String {
    guard let source else { return "?" }
    let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? "?" : String(trimmed.prefix(1)).uppercased()
}
