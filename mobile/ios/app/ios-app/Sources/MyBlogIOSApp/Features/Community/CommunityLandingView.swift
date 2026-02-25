import SwiftUI

struct CommunityLandingView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var vm = CommunityLandingViewModel()
    @State private var searchText = ""

    private var filteredCommunities: [Community] {
        let keyword = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if keyword.isEmpty {
            return vm.communities
        }

        return vm.communities.filter { community in
            community.name.lowercased().contains(keyword)
                || community.slug.lowercased().contains(keyword)
                || (community.description ?? "").lowercased().contains(keyword)
        }
    }

    private var joinedCommunities: [Community] {
        filteredCommunities.filter { $0.userMembership?.isMember == true }
    }

    private var recommendedCommunities: [Community] {
        filteredCommunities.filter { $0.userMembership?.isMember != true }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    topBar
                    searchBar
                    communitySection(
                        sectionLabel: "MY COMMUNITIES",
                        title: "내 커뮤니티",
                        communities: joinedCommunities,
                        emptyText: "참여 중인 커뮤니티가 없습니다."
                    )
                    communitySection(
                        sectionLabel: "DISCOVER",
                        title: "추천 커뮤니티",
                        communities: recommendedCommunities,
                        emptyText: "추천 커뮤니티가 없습니다."
                    )

                    if let errorMessage = vm.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.95))
                            .padding(.top, 2)
                    }

                    if vm.hasMore {
                        ProgressView("다음 커뮤니티 로딩 중")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(secondaryText)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 16)
                            .task { await vm.loadMore() }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 10)
                .padding(.bottom, 24)
            }
            .background(backgroundColor.ignoresSafeArea())
            .navigationBarHidden(true)
            .task {
                vm.setRepository(appStore.makeCommunityRepository())
                await vm.loadInitial()
            }
            .refreshable {
                await vm.refresh()
            }
            .onChange(of: appStore.isAuthenticated) { _, _ in
                vm.setRepository(appStore.makeCommunityRepository())
                Task { await vm.refresh() }
            }
            .overlay {
                if vm.communities.isEmpty && vm.isLoading {
                    ProgressView("커뮤니티 목록 로딩 중")
                        .foregroundStyle(primaryText)
                }
            }
            .alert("알림", isPresented: $vm.showAlert) {
                Button("확인", role: .cancel) {}
            } message: {
                if let alertMessage = vm.alertMessage {
                    Text(alertMessage)
                }
            }
        }
    }

    private var topBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("커뮤니티")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(primaryText)
                Text("내 관심사를 찾고 참여해 보세요")
                    .font(.footnote)
                    .foregroundStyle(secondaryText)
            }

            Spacer()

            Image(systemName: "person.3.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(primaryText)
                .frame(width: 36, height: 36)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(surfaceBackground)
                )
        }
        .padding(.top, 6)
    }

    private var searchBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(secondaryText)
                .frame(width: 16, height: 16)

            TextField("커뮤니티 검색", text: $searchText)
                .font(.body)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundStyle(primaryText)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(surfaceBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(cardStroke, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func communitySection(sectionLabel: String, title: String, communities: [Community], emptyText: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(sectionLabel)
                .font(.caption2.weight(.bold))
                .kerning(1.4)
                .foregroundStyle(tertiaryText)

            Text(title)
                .font(.headline.weight(.semibold))
                .foregroundStyle(primaryText)

            if communities.isEmpty {
                Text(emptyText)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(secondaryText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(surfaceBackground)
                    )
            } else {
                VStack(spacing: 10) {
                    ForEach(communities) { community in
                        communityCard(community)
                    }
                }
            }
        }
    }

    private func communityCard(_ community: Community) -> some View {
        let imageURL = resolveImageURL(
            community.iconUrl ?? community.bannerUrl,
            apiBaseURL: appStore.apiBaseURL,
            frontendBaseURL: appStore.frontendBaseURL
        )
        let isMember = community.userMembership?.isMember == true
        let isProcessing = vm.processingCommunityId == community.id
        let summaryText = (community.description?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
            ? community.description!
            : "/\(community.slug)"

        return HStack(spacing: 14) {
            CommunityIconView(imageURL: imageURL)

            VStack(alignment: .leading, spacing: 6) {
                Text(community.name)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(primaryText)
                    .lineLimit(1)

                Text(summaryText)
                    .font(.caption)
                    .foregroundStyle(secondaryText)
                    .lineLimit(2)

                HStack(spacing: 10) {
                    if let memberCount = community.memberCount {
                        Label("\(memberCount) 멤버", systemImage: "person.2.fill")
                    }
                    if let postCount = community.postCount {
                        Label("\(postCount) 포스트", systemImage: "doc.text.fill")
                    }
                    if community.isNsfw == true {
                        Label("NSFW", systemImage: "exclamationmark.triangle.fill")
                    }
                }
                .font(.caption2.weight(.medium))
                .foregroundStyle(tertiaryText)
                .lineLimit(1)
            }

            Spacer(minLength: 8)

            Button {
                Task { await vm.toggleMembership(community: community) }
            } label: {
                Group {
                    if isProcessing {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text(isMember ? "참여중" : "참여")
                            .font(.caption.weight(.bold))
                    }
                }
                .frame(minWidth: 72, minHeight: 32)
                .padding(.horizontal, 10)
            }
            .buttonStyle(.plain)
            .background(
                Capsule()
                    .fill(isMember ? surfaceBackground : accentFill)
            )
            .foregroundStyle(isMember ? primaryText : accentText)
            .disabled(isProcessing || vm.repository == nil)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(cardBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(cardStroke, lineWidth: 1)
        )
    }

    private var backgroundColor: Color {
        colorScheme == .dark ? .black : Color(.systemGroupedBackground)
    }

    private var cardBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.06) : Color.black.opacity(0.035)
    }

    private var surfaceBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.05)
    }

    private var cardStroke: Color {
        colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : .primary
    }

    private var secondaryText: Color {
        colorScheme == .dark ? Color.white.opacity(0.68) : Color.black.opacity(0.58)
    }

    private var tertiaryText: Color {
        colorScheme == .dark ? Color.white.opacity(0.52) : Color.black.opacity(0.52)
    }

    private var accentFill: Color {
        colorScheme == .dark ? .white : .black
    }

    private var accentText: Color {
        colorScheme == .dark ? .black : .white
    }
}

private struct CommunityIconView: View {
    @Environment(\.colorScheme) private var colorScheme
    let imageURL: URL?

    var body: some View {
        RemoteImageView(
            imageURL: imageURL,
            contentMode: .fill,
            downsampleWidth: 60
        ) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(placeholderFill)
                .overlay(ProgressView().controlSize(.small))
        } failure: {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(placeholderFill)
                .overlay(Image(systemName: "person.3.fill").foregroundStyle(placeholderIcon))
        }
        .frame(width: 60, height: 60)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var placeholderFill: Color {
        colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.05)
    }

    private var placeholderIcon: Color {
        colorScheme == .dark ? Color.white.opacity(0.55) : Color.black.opacity(0.45)
    }
}

@MainActor
private final class CommunityLandingViewModel: ObservableObject {
    @Published var communities: [Community] = []
    @Published var isLoading = false
    @Published var hasMore = true
    @Published var errorMessage: String?
    @Published var processingCommunityId: String?
    @Published var showAlert = false
    @Published var alertMessage: String?

    private(set) var repository: CommunityRepository?
    private var cursor: String?
    private var isLoadingMore = false

    func setRepository(_ repository: CommunityRepository?) {
        self.repository = repository
    }

    func loadInitial() async {
        cursor = nil
        hasMore = true
        await load()
    }

    func refresh() async {
        cursor = nil
        hasMore = true
        await load()
    }

    func loadMore() async {
        await load()
    }

    private func load() async {
        guard !isLoading, !isLoadingMore, let repository else { return }
        guard cursor == nil || hasMore else { return }

        let isLoadMore = cursor != nil
        if cursor == nil {
            isLoading = true
            communities = []
        } else {
            isLoadingMore = true
        }
        errorMessage = nil
        defer { isLoading = false; isLoadingMore = false }

        do {
            let response = try await repository.fetchCommunities(
                cursor: cursor,
                cursorId: nil,
            )
            if isLoadMore {
                communities.append(contentsOf: response.data.items)
            } else {
                communities = response.data.items
            }
            cursor = response.data.nextCursor
            hasMore = response.hasMore
        } catch let apiError as APIError {
            errorMessage = readableMessage(for: apiError)
        } catch {
            errorMessage = "커뮤니티를 불러오지 못했습니다."
        }
    }

    func toggleMembership(community: Community) async {
        guard let repository else { return }
        processingCommunityId = community.id
        errorMessage = nil
        defer { processingCommunityId = nil }

        do {
            if community.userMembership?.isMember == true {
                _ = try await repository.leave(communitySlug: community.slug)
                await updateCommunityMembership(communityId: community.id, isMember: false)
            } else {
                _ = try await repository.join(communitySlug: community.slug)
                await updateCommunityMembership(communityId: community.id, isMember: true)
            }
        } catch let apiError as APIError {
            alertMessage = readableMessage(for: apiError)
            showAlert = true
        } catch {
            alertMessage = "커뮤니티 처리 중 오류가 발생했습니다."
            showAlert = true
        }
    }

    private func readableMessage(for apiError: APIError) -> String {
        if apiError.status >= 500 || apiError.type == .server {
            return "서버 상태가 불안정합니다. 잠시 후 다시 시도해 주세요."
        }
        if apiError.type == .network {
            return "네트워크 연결을 확인해 주세요."
        }
        return apiError.message
    }

    private func updateCommunityMembership(communityId: String, isMember: Bool) async {
        let refreshed = communities.map { item -> Community in
            guard item.id == communityId, let existing = item.userMembership else {
                return Community(
                    id: item.id,
                    slug: item.slug,
                    name: item.name,
                    description: item.description,
                    iconUrl: item.iconUrl,
                    bannerUrl: item.bannerUrl,
                    memberCount: item.memberCount,
                    postCount: item.postCount,
                    isNsfw: item.isNsfw,
                    userMembership: CommunityMembership(
                        isMember: isMember,
                        role: nil,
                        status: isMember ? "active" : nil,
                    ),
                    isPublic: item.isPublic,
                    joinPolicy: item.joinPolicy
                )
            }
            return Community(
                id: item.id,
                slug: item.slug,
                name: item.name,
                description: item.description,
                iconUrl: item.iconUrl,
                bannerUrl: item.bannerUrl,
                memberCount: item.memberCount,
                postCount: item.postCount,
                isNsfw: item.isNsfw,
                userMembership: CommunityMembership(
                    isMember: isMember,
                    role: existing.role,
                    status: isMember ? "active" : nil
                ),
                isPublic: item.isPublic,
                joinPolicy: item.joinPolicy
            )
        }
        communities = refreshed
    }
}
