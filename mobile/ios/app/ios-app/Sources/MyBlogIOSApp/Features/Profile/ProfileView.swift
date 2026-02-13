import PhotosUI
import UIKit
import SwiftUI

struct ProfileHubView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var vm = ProfileHubViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text("Profile")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(primaryText)
                        Spacer()
                        Image(systemName: "gearshape")
                            .font(.title3)
                            .foregroundStyle(primaryText.opacity(0.75))
                    }

                    if vm.isLoading && vm.profile == nil && appStore.isBusy {
                        ProgressView("프로필 동기화 중")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .foregroundStyle(primaryText)
                    }

                    if let profile = vm.profile ?? appStore.user {
                            ProfileHeroCard(
                            profile: profile,
                            imageURL: resolveImageURL(
                                profile.profileImage,
                                apiBaseURL: appStore.apiBaseURL,
                                frontendBaseURL: appStore.frontendBaseURL,
                                cacheBuster: appStore.profileImageCacheBuster,
                            ),
                            previewImageData: nil,
                        )
                    }

                    settingsGroup(title: "Settings Hub") {
                        SettingsNavRow(icon: "person.crop.circle", title: "Account") {
                            ProfileView()
                        }
                        SettingsNavRow(icon: "lock.shield", title: "Security") {
                            ChangePasswordView()
                        }
                        SettingsNavRow(icon: "person.3", title: "Communities") {
                            CommunitySettingsView()
                        }
                    }

                    settingsGroup(title: "Account Management") {
                        Button(role: .destructive) {
                            Task { await appStore.logout() }
                        } label: {
                            HStack {
                                Label("로그아웃", systemImage: "rectangle.portrait.and.arrow.right")
                                Spacer()
                                if appStore.isBusy {
                                    ProgressView()
                                } else {
                                    Image(systemName: "chevron.right")
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.red)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                        }
                    }

                    if let errorMessage = vm.errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red.opacity(0.95))
                    }

                    if let message = appStore.authMessage {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.green)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(backgroundColor)
            .navigationBarHidden(true)
            .task {
                vm.bind(appStore: appStore)
                await vm.load()
                await appStore.refreshCurrentUserProfile()
            }
            .refreshable {
                await vm.load()
                await appStore.refreshCurrentUserProfile()
            }
        }
    }

    private func settingsGroup<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.gray)
            VStack(spacing: 0) {
                content()
            }
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(cardBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(cardStroke, lineWidth: 1)
            )
        }
    }

    private var backgroundColor: Color {
        colorScheme == .dark ? .black : Color(.systemGroupedBackground)
    }

    private var cardBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.06) : Color.black.opacity(0.035)
    }

    private var cardStroke: Color {
        colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : .primary
    }
}

private struct SettingsNavRow<Destination: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let icon: String
    let title: String
    let destination: Destination

    init(icon: String, title: String, @ViewBuilder destination: () -> Destination) {
        self.icon = icon
        self.title = title
        self.destination = destination()
    }

    var body: some View {
        NavigationLink {
            destination
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(primaryText.opacity(0.76))
                    .frame(width: 20)
                Text(title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(primaryText)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(primaryText.opacity(0.65))
                    .font(.caption.weight(.semibold))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(alignment: .bottom) {
            Divider()
                .padding(.leading, 46)
        }
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : .primary
    }
}

private final class ProfileHubViewModel: ObservableObject {
    @Published var profile: UserProfile?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var profileRepository: ProfileRepository?

    func bind(appStore: AppStore) {
        profileRepository = appStore.makeProfileRepository()
    }

    func load() async {
        guard let profileRepository else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            profile = try await profileRepository.fetchMeProfile()
        } catch let apiError as APIError {
            errorMessage = readableMessage(for: apiError)
        } catch {
            errorMessage = "프로필 정보를 불러오지 못했습니다."
        }
    }

    private func readableMessage(for apiError: APIError) -> String {
        if apiError.status >= 500 || apiError.type == .server {
            return "프로필 정보를 불러오는 중 서버 오류가 발생했습니다."
        }
        if apiError.type == .network {
            return "네트워크 연결을 확인해 주세요."
        }
        return apiError.message
    }
}

struct ProfileView: View {
    @EnvironmentObject private var appStore: AppStore
    @StateObject private var vm = ProfileSettingsViewModel()
    @State private var avatarPickerItem: PhotosPickerItem?
    @State private var avatarPreviewData: Data?

    var body: some View {
        NavigationStack {
            List {
                if let profile = vm.profile {
                    Section("내 계정") {
                            ProfileHeroCard(
                            profile: profile,
                            imageURL: resolveImageURL(
                                profile.profileImage,
                                apiBaseURL: appStore.apiBaseURL,
                                frontendBaseURL: appStore.frontendBaseURL,
                                cacheBuster: appStore.profileImageCacheBuster,
                            ),
                            previewImageData: avatarPreviewData,
                        )

                        PhotosPicker(
                            selection: $avatarPickerItem,
                            matching: .images
                        ) {
                            HStack {
                                Image(systemName: "person.crop.circle.badge.plus")
                                Text("프로필 사진 변경")
                                    .font(.body)
                            }
                        }
                        .buttonStyle(.bordered)
                        if vm.isUploadingAvatar {
                            ProgressView("아바타 업로드 중")
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(profile.username)
                                .font(.title3)
                                .fontWeight(.semibold)
                            Text(profile.email)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            if let authProvider = profile.authProvider {
                                Text("로그인 방식: \(authProvider)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if let role = profile.role {
                                Text("권한: \(role)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Section("소개") {
                        if let bio = profile.bio, !bio.isEmpty {
                            Text(bio)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                        if let jobTitle = profile.jobTitle, !jobTitle.isEmpty {
                            Text(jobTitle)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let createdAt = profile.createdAt {
                        Section("가입") {
                            Text(createdAt)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } else if vm.isLoading {
                    HStack {
                        Spacer()
                        ProgressView("프로필 로딩 중")
                        Spacer()
                    }
                }

                Section("마케팅/알림 설정") {
                    Toggle("마케팅 수신 동의", isOn: $vm.marketingOptIn)
                    Toggle("뉴스레터 수신", isOn: $vm.newsletterOptIn)
                }

                Section("디스플레이") {
                    Picker(
                        "테마",
                        selection: Binding(
                            get: { appStore.themePreference },
                            set: { appStore.setThemePreference($0) }
                        )
                    ) {
                        ForEach(AppThemePreference.allCases) { preference in
                            Text(preference.title)
                                .tag(preference)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("블로그 설정") {
                    HStack {
                        TextField("별칭 입력", text: $vm.aliasDraft)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button(vm.aliasCheckStatus == nil ? "중복확인" : "재확인") {
                            Task { await vm.checkAlias() }
                        }
                        .buttonStyle(.bordered)
                    }

                    if let aliasCheck = vm.aliasCheckStatus {
                        Text(aliasCheck)
                            .font(.caption)
                            .foregroundStyle(aliasCheck.contains("가능") ? .green : .red)
                    }

                    Button("별칭 적용") {
                        Task { await vm.changeAlias() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.aliasDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || vm.isSubmitting)

                    if let blog = vm.blog {
                        Divider()
                        VStack(alignment: .leading, spacing: 6) {
                            Text(blog.name)
                                .font(.headline)
                            if let alias = blog.alias {
                                Text("별칭: \(alias)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if let description = blog.description, !description.isEmpty {
                                Text(description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if let visibility = blog.isPublic {
                                Text("공개: \(visibility ? "ON" : "OFF")")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section("현재 상태 반영") {
                    Button("설정 저장") {
                        Task { await vm.saveMarketing() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.profile == nil || vm.isSubmitting)

                    Button("정보 다시 불러오기", role: .cancel) {
                        Task { await vm.load() }
                    }
                }

                if let profileError = vm.errorMessage {
                    Section {
                        Text(profileError)
                            .foregroundStyle(.red)
                    }
                }

                if let avatarMessage = vm.avatarMessage {
                    Section {
                        Text(avatarMessage)
                            .foregroundStyle(vm.isUploadingAvatar ? .blue : .secondary)
                            .font(.footnote)
                    }
                }
            }
            .navigationTitle("계정/블로그")
            .task {
                vm.bind(appStore: appStore)
                await vm.load()
            }
            .refreshable {
                await vm.load()
            }
            .onChange(of: avatarPickerItem) { _, newItem in
                Task { await uploadAvatarFromPicker(newItem) }
            }
            .overlay {
                if vm.profile == nil && !vm.isLoading && vm.errorMessage == nil {
                    Text("프로필을 불러올 수 없습니다")
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func uploadAvatarFromPicker(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        defer {
            avatarPickerItem = nil
            avatarPreviewData = nil
        }

        do {
            guard let rawData = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: rawData) else {
                vm.avatarMessage = "이미지 로드에 실패했습니다."
                return
            }

            let fileData: Data
            let mimeType: String
            let fileName: String

            if let jpegData = image.jpegData(compressionQuality: 0.9) {
                fileData = jpegData
                mimeType = "image/jpeg"
                fileName = "avatar.jpg"
            } else if let pngData = image.pngData() {
                fileData = pngData
                mimeType = "image/png"
                fileName = "avatar.png"
            } else {
                vm.avatarMessage = "지원되지 않는 이미지 형식입니다."
                return
            }

            avatarPreviewData = fileData
            let uploadedVersion = await vm.uploadAvatarImage(
                fileData: fileData,
                fileName: fileName,
                mimeType: mimeType,
            )
            if let uploadedVersion {
                appStore.setProfileImageCacheBuster(uploadedVersion)
            }
            await appStore.refreshCurrentUserProfile()
        } catch {
            vm.avatarMessage = error.localizedDescription
        }
    }
}

private struct ChangePasswordView: View {
    @EnvironmentObject private var appStore: AppStore
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var showCurrent = false
    @State private var showNew = false
    @State private var showConfirm = false
    @State private var statusMessage: String?

    var body: some View {
        Form {
            Section("현재 비밀번호") {
                secureInputField(
                    title: "",
                    text: $currentPassword,
                    isVisible: $showCurrent,
                )
            }

            Section("새 비밀번호") {
                secureInputField(
                    title: "",
                    text: $newPassword,
                    isVisible: $showNew,
                )
                secureInputField(
                    title: "",
                    text: $confirmPassword,
                    isVisible: $showConfirm,
                )
            }

            Section {
                if let statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(statusMessage.contains("성공") ? .green : .red)
                }
            }

            Button {
                Task { await submit() }
            } label: {
                HStack {
                    if appStore.isBusy { ProgressView() }
                    Text("비밀번호 변경")
                }
            }
            .disabled(
                appStore.isBusy ||
                    currentPassword.isEmpty ||
                    newPassword.isEmpty ||
                    confirmPassword.isEmpty ||
                    newPassword != confirmPassword
            )
            .buttonStyle(.borderedProminent)

            if appStore.authError == nil, let message = appStore.authMessage, !message.isEmpty {
                Text(message)
                    .foregroundStyle(.green)
                    .font(.footnote)
            }
        }
        .navigationTitle("비밀번호 변경")
        .task {
            appStore.clearAuthError()
            appStore.authMessage = nil
            statusMessage = nil
        }
    }

    private func secureInputField(
        title: String,
        text: Binding<String>,
        isVisible: Binding<Bool>,
    ) -> some View {
        HStack {
            if isVisible.wrappedValue {
                TextField(title, text: text)
            } else {
                SecureField(title, text: text)
            }
            Button {
                isVisible.wrappedValue.toggle()
            } label: {
                Image(systemName: isVisible.wrappedValue ? "eye.slash" : "eye")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
    }

    private func submit() async {
        guard newPassword == confirmPassword else {
            statusMessage = "새 비밀번호가 일치하지 않습니다."
            return
        }
        let ok = await appStore.changePassword(
            currentPassword: currentPassword.trimmingCharacters(in: .whitespacesAndNewlines),
            newPassword: newPassword.trimmingCharacters(in: .whitespacesAndNewlines),
        )
        if ok {
            statusMessage = "비밀번호 변경이 완료되었습니다."
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
        } else {
            statusMessage = appStore.authError?.message ?? "비밀번호 변경에 실패했습니다."
        }
    }
}

private struct CommunitySettingsView: View {
    @EnvironmentObject private var appStore: AppStore
    @StateObject private var vm = CommunitySettingsViewModel()

    var body: some View {
        List {
            if vm.isLoading && vm.communities.isEmpty {
                HStack {
                    Spacer()
                    ProgressView("커뮤니티 설정 불러오는 중")
                    Spacer()
                }
            }

            if vm.communities.isEmpty && !vm.isLoading && vm.errorMessage == nil {
                Text("현재 참여 중인 커뮤니티가 없습니다.")
                    .foregroundStyle(.secondary)
            }

            ForEach(vm.communities) { community in
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(community.name)
                                .font(.headline)
                            Spacer()
                            if vm.processingCommunityId == community.id {
                                ProgressView()
                            } else if let userMembership = community.userMembership, userMembership.isMember {
                                Text("구독중")
                                    .font(.caption2)
                                    .foregroundStyle(.green)
                            }
                        }

                        Text("/\(community.slug)")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if let memberCount = community.memberCount {
                            Text("멤버 \(memberCount)명")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        Button {
                            Task { await vm.toggleMembership(community: community) }
                        } label: {
                            Text(vm.isMember(community) ? "탈퇴" : "참여")
                                .font(.subheadline)
                        }
                        .buttonStyle(.bordered)
                        .disabled(vm.processingCommunityId == community.id)
                    }
                }
            }

            if let message = vm.errorMessage {
                Section {
                    Text(message)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("커뮤니티 설정")
        .task {
            vm.bind(appStore: appStore)
            await vm.load()
        }
        .refreshable {
            await vm.load()
        }
    }
}

private final class CommunitySettingsViewModel: ObservableObject {
    @Published var communities: [Community] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var processingCommunityId: String?

    private var repository: CommunityRepository?
    private var cursor: String?
    private var hasMore = true

    func bind(appStore: AppStore) {
        repository = appStore.makeCommunityRepository()
    }

    func load() async {
        await load(nil, reset: true)
    }

    func loadMoreIfNeeded(nextOf communityId: String) async {
        if communities.last?.id == communityId {
            await load(cursor, reset: false)
        }
    }

    private func load(_ cursorValue: String?, reset: Bool) async {
        guard let repository else { return }
        guard !isLoading else { return }
        if cursorValue != nil && !hasMore { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        if reset {
            communities = []
            hasMore = true
            self.cursor = nil
        }

        do {
            let response = try await repository.fetchCommunities(cursor: cursorValue, cursorId: nil)
            if reset {
                communities = response.data.items
            } else {
                communities.append(contentsOf: response.data.items)
            }
            self.cursor = response.data.nextCursor
            hasMore = response.hasMore
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func isMember(_ community: Community) -> Bool {
        community.userMembership?.isMember == true
    }

    func toggleMembership(community: Community) async {
        guard let repository else { return }
        processingCommunityId = community.id
        errorMessage = nil
        defer { processingCommunityId = nil }

        do {
            let joined = isMember(community)
            if joined {
                _ = try await repository.leave(communitySlug: community.slug)
            } else {
                _ = try await repository.join(communitySlug: community.slug)
            }
            await refreshCommunity(community.id, isMember: !joined)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshCommunity(_ communityId: String, isMember: Bool) async {
        communities = communities.map { item in
            guard item.id == communityId else { return item }
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
                userMembership: isMember ? CommunityMembership(isMember: true, role: item.userMembership?.role, status: "active") : CommunityMembership(isMember: false, role: item.userMembership?.role, status: nil),
                isPublic: item.isPublic,
                joinPolicy: item.joinPolicy,
            )
        }
    }
}

private final class ProfileSettingsViewModel: ObservableObject {
    @Published var profile: UserProfile?
    @Published var blog: MobileBlog?
    @Published var isLoading = false
    @Published var isSubmitting = false
    @Published var isUploadingAvatar = false
    @Published var errorMessage: String?
    @Published var avatarMessage: String?
    @Published var marketingOptIn = false
    @Published var newsletterOptIn = false
    @Published var aliasDraft = ""
    @Published var aliasCheckStatus: String?

    private var profileRepo: ProfileRepository?

    func bind(appStore: AppStore) {
        profileRepo = appStore.makeProfileRepository()
    }

    func load() async {
        guard let profileRepo else { return }
        isLoading = true
        errorMessage = nil
        avatarMessage = nil
        defer { isLoading = false }

        do {
            let fetched = try await profileRepo.fetchMeProfile()
            profile = fetched
            marketingOptIn = fetched.marketingOptIn ?? false
            newsletterOptIn = fetched.newsletterOptIn ?? false

            if let existingBlog = try await profileRepo.fetchMyBlog() {
                blog = existingBlog
                aliasDraft = existingBlog.alias ?? ""
            } else {
                blog = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveMarketing() async {
        guard let profileRepo else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            let updated = try await profileRepo.updateMarketingPreferences(
                MarketingPreferencesPayload(
                    marketingOptIn: marketingOptIn,
                    newsletterOptIn: newsletterOptIn,
                ),
            )
            profile = updated
            marketingOptIn = updated.marketingOptIn ?? marketingOptIn
            newsletterOptIn = updated.newsletterOptIn ?? newsletterOptIn
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func checkAlias() async {
        guard let profileRepo else { return }
        let alias = aliasDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !alias.isEmpty else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let result = try await profileRepo.checkAlias(alias)
            aliasCheckStatus = result.available ? "사용 가능한 별칭입니다." : "이미 사용 중인 별칭입니다."
        } catch {
            aliasCheckStatus = "중복확인 실패: \(error.localizedDescription)"
        }
    }

    func changeAlias() async {
        guard let profileRepo else { return }
        let alias = aliasDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !alias.isEmpty else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            let updatedBlog = try await profileRepo.changeAlias(alias)
            blog = updatedBlog
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func uploadAvatarImage(
        fileData: Data,
        fileName: String,
        mimeType: String,
    ) async -> String? {
        guard let profileRepo else { return nil }
        isUploadingAvatar = true
        avatarMessage = nil
        defer { isUploadingAvatar = false }

        do {
            let response = try await profileRepo.uploadProfileImage(
                fileData: fileData,
                fileName: fileName,
                mimeType: mimeType,
            )
            let normalizedEtag = normalizeEtag(response.etag)
            let upload = response.response

            if upload.url == nil && upload.s3Key == nil {
                avatarMessage = "업로드는 되었지만 응답값이 비었습니다. 다시 불러오기를 눌러 확인해주세요."
            } else {
                avatarMessage = "프로필 이미지가 업데이트되었습니다."
            }
            await load()
            return upload.version.flatMap { String($0) }
                ?? normalizedEtag
                ?? extractImageVersion(from: upload.url)
                ?? "\(Int(Date().timeIntervalSince1970 * 1000))"
        } catch {
            avatarMessage = error.localizedDescription
            return nil
        }
    }

    private func extractImageVersion(from urlString: String?) -> String? {
        guard let urlString else { return nil }
        guard let components = URLComponents(string: urlString),
              let queryItems = components.queryItems else {
            return nil
        }
        return queryItems.first(where: { $0.name == "v" })?.value
    }

    private func normalizeEtag(_ etag: String?) -> String? {
        guard let raw = etag?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else {
            return nil
        }
        let trimmed = raw.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
        return trimmed.isEmpty ? nil : trimmed
    }
}

private struct ProfileHeroCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let profile: UserProfile
    let imageURL: URL?
    let previewImageData: Data?

    var body: some View {
        HStack(spacing: 14) {
            if let previewImageData,
               let uiImage = UIImage(data: previewImageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 54, height: 54)
                    .clipShape(Circle())
            } else {
                let avatarText = profile.username.trimmingCharacters(in: .whitespacesAndNewlines)
                ProfileAvatarImage(
                    imageURL: imageURL,
                    fallbackText: avatarText.isEmpty ? "?" : String(avatarText.prefix(1)).uppercased(),
                    size: 54,
                )
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(profile.username)
                    .font(.headline)
                    .foregroundStyle(primaryText)
                Text(profile.email)
                    .font(.subheadline)
                    .foregroundStyle(.gray)
                if let blogSlug = profile.blogSlug, !blogSlug.isEmpty {
                    Text("@\(blogSlug)")
                        .font(.caption)
                        .foregroundStyle(.gray)
                }
            }
            Spacer()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(cardBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(cardStroke, lineWidth: 1)
        )
    }

    private var cardBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.06) : Color.black.opacity(0.035)
    }

    private var cardStroke: Color {
        colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : .primary
    }
}
