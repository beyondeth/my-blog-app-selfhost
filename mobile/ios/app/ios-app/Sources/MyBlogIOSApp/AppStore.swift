import Foundation
import SwiftUI

final class AppStore: ObservableObject {
    @Published var user: UserProfile?
    @Published var isBootstrapping = true
    @Published var isAuthenticated = false
    @Published var authError: APIError?
    @Published var authMessage: String?
    @Published var requiresReauth = false
    @Published var isBusy = false
    @Published var profileImageCacheBuster: String?
    @Published var themePreference: AppThemePreference = .dark

    private var config: AppConfig?
    private var tokenStore: TokenStore = TokenStore()
    private var apiClient: APIClient?
    private var authService: AuthService?
    private var feedRepository: FeedRepository?
    private var communityRepository: CommunityRepository?
    private var profileRepository: ProfileRepository?
    private let themePreferenceKey = "myblog.ios.theme.preference"
    private var pendingIncomingURL: URL?

    var apiBaseURL: URL? {
        config?.baseURL
    }

    var frontendBaseURL: URL? {
        config?.frontendURL
    }

    var socialAuthCallbackScheme: String? {
        config?.socialAuthCallbackURL.scheme
    }

    var preferredColorScheme: ColorScheme? {
        themePreference.colorScheme
    }

    @MainActor
    func bootstrap() async {
        IOSRunTrace.emit("bootstrap.start", category: "lifecycle")
        do {
            loadThemePreference()
            let cfg = try AppConfig.load()
            config = cfg

            let client = APIClient(
                config: cfg,
                tokenStore: tokenStore,
                onRefresh: { [weak self] in
                    guard let self else {
                        throw APIError(
                            code: "SESSION_STORE_MISSING",
                            message: "AppStore 인스턴스를 찾을 수 없습니다",
                            status: 500,
                            type: .server,
                        )
                    }
                    try await self.refreshSessionTokens()
                },
                onAuthFailure: { [weak self] in
                    await self?.handleAuthExpiration(
                        message: "세션이 만료되어 다시 로그인해야 합니다.",
                        shouldNotify: true,
                    )
                },
            )

            let service = AuthService(apiClient: client, tokenStore: tokenStore, config: cfg)
            apiClient = client
            authService = service
            feedRepository = FeedRepository(client: client)
            communityRepository = CommunityRepository(apiClient: client)
            profileRepository = ProfileRepository(apiClient: client)
#if DEBUG
            await applyDebugSessionFixtureIfNeeded()
#endif
            isBootstrapping = false
            requiresReauth = false
            authError = nil
            authMessage = nil
            isAuthenticated = false
            if let pendingURL = pendingIncomingURL {
                pendingIncomingURL = nil
                await handleIncomingURL(pendingURL)
            }
        } catch {
            IOSRunTrace.emit(
                "bootstrap.fail",
                category: "lifecycle",
                fields: ["error": "\(error)"],
            )
            isBootstrapping = false
            let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            authError = APIError(code: "CONFIG", message: message, status: -1, type: .badRequest)
            isAuthenticated = false
        }
    }

    @MainActor
    func setThemePreference(_ preference: AppThemePreference) {
        themePreference = preference
        UserDefaults.standard.set(preference.rawValue, forKey: themePreferenceKey)
        IOSRunTrace.emit(
            "ui.theme_preference",
            category: "ui",
            fields: ["value": preference.rawValue],
        )
    }

    func makeFeedRepository() -> FeedRepository? {
        feedRepository
    }

    func makeCommunityRepository() -> CommunityRepository? {
        communityRepository
    }

    func makeProfileRepository() -> ProfileRepository? {
        profileRepository
    }

    @MainActor
    func setProfileImageCacheBuster(_ value: String?) {
        profileImageCacheBuster = value
        IOSRunTrace.emit(
            "profile_image_cache_buster.update",
            category: "cache",
            fields: ["value": value ?? ""],
        )
    }

    @MainActor
    func bumpProfileImageCacheBuster() {
        setProfileImageCacheBuster(UUID().uuidString)
    }

    @MainActor
    func logout() async {
        authError = nil
        authMessage = nil
        requiresReauth = false
        isBusy = true
        do {
            try await authService?.logout()
            await clearLocalSession()
            authMessage = "로그아웃 되었습니다."
            IOSRunTrace.emit("auth.logout", category: "auth", fields: ["result": "success"])
        } catch {
            await clearLocalSession()
            authError = APIError(
                code: "LOGOUT_ERROR",
                message: error.localizedDescription,
                status: -1,
                type: .unknown,
            )
            IOSRunTrace.emit(
                "auth.logout",
                category: "auth",
                fields: ["result": "failed", "error": error.localizedDescription],
            )
        }
        isBusy = false
    }

    @MainActor
    func socialLoginURL(for provider: SocialProvider) -> URL? {
        authService?.socialAuthURL(for: provider)
    }

    @MainActor
    func handleIncomingURL(_ url: URL) async {
        guard let config else {
            pendingIncomingURL = url
            return
        }
        guard isMatchingSocialCallbackURL(url, expected: config.socialAuthCallbackURL) else { return }
        await completeSocialLoginCallback(url)
    }

    @MainActor
    func restoreSession() async {
        guard let authService else { return }
        isBusy = true
        authError = nil
        authMessage = nil
        requiresReauth = false

        let hasStoredAccessToken = await tokenStore.currentAccessToken() != nil
        let hasStoredRefreshToken = await tokenStore.currentRefreshToken() != nil
        let hasStoredToken = hasStoredAccessToken || hasStoredRefreshToken
        guard hasStoredToken else {
            isAuthenticated = false
            isBusy = false
            return
        }

        do {
            user = try await authService.me()
            isAuthenticated = true
            profileImageCacheBuster = nil
            IOSRunTrace.emit(
                "auth.restore_session",
                category: "auth",
                fields: ["result": "success"],
            )
        } catch let apiError as APIError {
            isAuthenticated = false
            let isAuthFailure = apiError.type == .unauthorized || apiError.status == 401 || apiError.status == 403
            if isAuthFailure {
                await handleAuthExpiration(
                    message: "세션이 만료되어 다시 로그인해 주세요.",
                    shouldNotify: true,
                )
            } else if apiError.type == .network {
                authError = APIError(
                    code: "SESSION_RESTORE_NETWORK",
                    message: "네트워크 문제로 자동 로그인을 완료하지 못했습니다.",
                    status: apiError.status,
                    target: apiError.target,
                    type: .network,
                )
            } else {
                // 자동 로그인 실패 시 stale token을 정리하고 로그인 화면으로 복귀한다.
                await clearLocalSession()
                authError = nil
            }
            IOSRunTrace.emit(
                "auth.restore_session",
                category: "auth",
                fields: ["result": "failed", "status": "\(apiError.status)", "code": apiError.code],
            )
        } catch {
            isAuthenticated = false
            authError = APIError(
                code: "SESSION_RESTORE_ERROR",
                message: "세션 복구 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.",
                status: -1,
                type: .server,
            )
        }
        isBusy = false
    }

    @MainActor
    func login(email: String, password: String) async {
        guard let authService else {
            authError = APIError(
                code: "NO_SERVICE",
                message: "인증 서비스가 준비되지 않았습니다.",
                status: -1,
                type: .unknown,
            )
            isBusy = false
            return
        }
        isBusy = true
        authError = nil
        authMessage = nil
        requiresReauth = false
        do {
            let session = try await authService.login(email: email, password: password)
            user = session.user
            isAuthenticated = true
            authError = nil
            authMessage = "로그인이 완료되었습니다."
            requiresReauth = false
            IOSRunTrace.emit(
                "auth.login",
                category: "auth",
                fields: ["result": "success", "userId": session.user.id],
            )
        } catch let error as APIError {
            authError = error
            IOSRunTrace.emit(
                "auth.login",
                category: "auth",
                fields: ["result": "failed", "status": "\(error.status)", "code": error.code],
            )
        } catch {
            authError = APIError(code: "UNKNOWN", message: error.localizedDescription, status: -1, type: .unknown)
            IOSRunTrace.emit(
                "auth.login",
                category: "auth",
                fields: ["result": "failed", "error": error.localizedDescription],
            )
        }
        isBusy = false
    }

    @MainActor
    func changePassword(currentPassword: String, newPassword: String) async -> Bool {
        guard let authService else {
            authError = APIError(
                code: "NO_SERVICE",
                message: "인증 서비스가 준비되지 않았습니다.",
                status: -1,
                type: .unknown,
            )
            return false
        }
        isBusy = true
        authError = nil
        authMessage = nil
        do {
            _ = try await authService.changePassword(
                currentPassword: currentPassword,
                newPassword: newPassword,
            )
            authMessage = "비밀번호가 변경되었습니다."
            isBusy = false
            return true
        } catch let error as APIError {
            authError = error
            isBusy = false
            return false
        } catch {
            authError = APIError(code: "UNKNOWN", message: error.localizedDescription, status: -1, type: .unknown)
            isBusy = false
            return false
        }
    }

    @MainActor
    func handleAuthExpiration(message: String = "세션이 만료되었습니다. 다시 로그인해 주세요.", shouldNotify: Bool = true) async {
        await clearLocalSession()
        requiresReauth = true
        profileImageCacheBuster = nil
        IOSRunTrace.emit(
            "auth.expired",
            category: "auth",
            fields: ["notify": shouldNotify ? "true" : "false"],
        )
        if shouldNotify {
            authError = APIError(
                code: "SESSION_EXPIRED",
                message: message,
                status: 401,
                type: .unauthorized,
            )
        } else {
            authError = nil
        }
    }

    @MainActor
    private func refreshSessionTokens() async throws {
        guard let authService else {
            throw APIError(
                code: "SESSION_SERVICE_UNAVAILABLE",
                message: "인증 서비스를 초기화할 수 없습니다",
                status: 500,
                type: .server,
            )
        }
        _ = try await authService.refresh()
    }

    @MainActor
    func clearAuthError() {
        authError = nil
        authMessage = nil
        requiresReauth = false
    }

    @MainActor
    func refreshCurrentUserProfile() async {
        guard isAuthenticated, let authService else { return }
        do {
            let refreshedUser = try await authService.me()
            user = refreshedUser
            authError = nil
            if let profileImage = refreshedUser.profileImage,
               let version = extractImageVersion(from: profileImage) {
                await setProfileImageCacheBuster(version)
            }
            IOSRunTrace.emit(
                "auth.profile_refresh",
                category: "profile",
                fields: ["result": "success", "userId": refreshedUser.id],
            )
        } catch let error as APIError where error.type == .unauthorized {
            await handleAuthExpiration(
                message: "세션이 만료되어 다시 로그인해 주세요.",
                shouldNotify: true,
            )
        } catch let apiError as APIError {
            // 탭 전환/백그라운드 동기화 실패는 사용자 흐름을 막지 않는다.
            IOSRunTrace.emit(
                "auth.profile_refresh",
                category: "profile",
                fields: [
                    "result": "failed",
                    "status": "\(apiError.status)",
                    "code": apiError.code,
                    "silent": "true",
                ],
            )
        } catch {
            IOSRunTrace.emit(
                "auth.profile_refresh",
                category: "profile",
                fields: ["result": "failed", "error": "\(error)", "silent": "true"],
            )
        }
    }

    @MainActor
    private func clearLocalSession() async {
        user = nil
        isAuthenticated = false
        profileImageCacheBuster = nil
        await tokenStore.clear()
    }

#if DEBUG
    @MainActor
    private func applyDebugSessionFixtureIfNeeded() async {
        guard let mode = ProcessInfo.processInfo.environment["MOBILE_IOS_SESSION_FIXTURE"]?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !mode.isEmpty else {
            return
        }

        guard ["expired", "invalid", "expired_refresh", "missing_refresh", "force_refresh_fail"].contains(mode) else {
            IOSRunTrace.emit(
                "debug_session_fixture",
                category: "auth",
                fields: ["result": "ignore", "mode": mode],
            )
            return
        }

        let accessToken = ProcessInfo.processInfo.environment["MOBILE_IOS_FIXTURE_ACCESS_TOKEN"] ?? "expired_access_token_debug"
        let refreshToken = ProcessInfo.processInfo.environment["MOBILE_IOS_FIXTURE_REFRESH_TOKEN"] ?? "expired_refresh_token_debug"
        let refreshAt = ProcessInfo.processInfo.environment["MOBILE_IOS_FIXTURE_EXPIRED_AT"]

        await tokenStore.save(
            accessToken: accessToken,
            refreshToken: mode == "missing_refresh" ? "" : refreshToken,
            refreshAt: refreshAt.flatMap { Date(timeIntervalSince1970: TimeInterval(Double($0) ?? 0)) },
        )

        IOSRunTrace.emit(
            "debug_session_fixture",
            category: "auth",
            fields: ["mode": mode, "hasRefresh": (mode == "missing_refresh" ? "false" : "true")],
        )
    }
#endif

    private func extractImageVersion(from profileImage: String) -> String? {
        guard let components = URLComponents(string: profileImage),
              let queryItems = components.queryItems else {
            return nil
        }
        return queryItems.first(where: { $0.name == "v" })?.value
    }

    private func loadThemePreference() {
        let storedRawValue = UserDefaults.standard.string(forKey: themePreferenceKey)
        if let storedRawValue,
           let parsed = AppThemePreference(rawValue: storedRawValue) {
            themePreference = parsed
        } else {
            themePreference = .dark
        }
    }

    @MainActor
    private func completeSocialLoginCallback(_ url: URL) async {
        guard let authService else {
            authError = APIError(
                code: "NO_SERVICE",
                message: "인증 서비스가 준비되지 않았습니다.",
                status: -1,
                type: .unknown
            )
            return
        }

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            authError = APIError(
                code: "SOCIAL_CALLBACK_INVALID",
                message: "소셜 로그인 콜백 데이터를 해석할 수 없습니다.",
                status: -1,
                type: .badRequest
            )
            return
        }

        let queryItems = components.queryItems ?? []
        if let code = queryValue(named: "error", in: queryItems), !code.isEmpty {
            let message = queryValue(named: "message", in: queryItems) ?? "소셜 로그인에 실패했습니다."
            authError = APIError(
                code: code.uppercased(),
                message: message,
                status: 401,
                type: .unauthorized
            )
            isAuthenticated = false
            IOSRunTrace.emit(
                "auth.social_callback",
                category: "auth",
                fields: ["result": "failed", "code": code],
            )
            return
        }

        if let oauthCode = queryValue(named: "code", in: queryItems), !oauthCode.isEmpty {
            let provider = queryValue(named: "provider", in: queryItems)
            isBusy = true
            authError = nil
            authMessage = nil
            requiresReauth = false
            defer { isBusy = false }

            do {
                let session = try await authService.exchangeSocialCode(
                    code: oauthCode,
                    redirectURI: config.socialAuthCallbackURL,
                    provider: provider,
                )
                user = session.user
                isAuthenticated = true
                authMessage = "소셜 로그인이 완료되었습니다."
                profileImageCacheBuster = nil
                IOSRunTrace.emit(
                    "auth.social_callback",
                    category: "auth",
                    fields: ["result": "success", "mode": "code", "userId": session.user.id],
                )
            } catch let error as APIError {
                await clearLocalSession()
                authError = error
                IOSRunTrace.emit(
                    "auth.social_callback",
                    category: "auth",
                    fields: ["result": "failed", "mode": "code", "status": "\(error.status)", "code": error.code],
                )
            } catch {
                await clearLocalSession()
                authError = APIError(
                    code: "SOCIAL_CALLBACK_ERROR",
                    message: error.localizedDescription,
                    status: -1,
                    type: .unknown
                )
                IOSRunTrace.emit(
                    "auth.social_callback",
                    category: "auth",
                    fields: ["result": "failed", "mode": "code", "error": error.localizedDescription],
                )
            }
            return
        }

        let accessToken = queryValue(named: "access_token", in: queryItems)
            ?? queryValue(named: "accessToken", in: queryItems)
        let refreshToken = queryValue(named: "refresh_token", in: queryItems)
            ?? queryValue(named: "refreshToken", in: queryItems)

        guard let accessToken, let refreshToken, !accessToken.isEmpty, !refreshToken.isEmpty else {
            authError = APIError(
                code: "SOCIAL_CALLBACK_TOKEN_MISSING",
                message: "소셜 로그인 토큰을 받지 못했습니다.",
                status: 401,
                type: .unauthorized
            )
            IOSRunTrace.emit(
                "auth.social_callback",
                category: "auth",
                fields: ["result": "failed", "code": "SOCIAL_CALLBACK_TOKEN_MISSING"],
            )
            return
        }

        isBusy = true
        authError = nil
        authMessage = nil
        requiresReauth = false
        defer { isBusy = false }

        await tokenStore.save(accessToken: accessToken, refreshToken: refreshToken, refreshAt: nil)

        do {
            let currentUser = try await authService.me()
            user = currentUser
            isAuthenticated = true
            authMessage = "소셜 로그인이 완료되었습니다."
            profileImageCacheBuster = nil
            IOSRunTrace.emit(
                "auth.social_callback",
                category: "auth",
                fields: ["result": "success", "mode": "legacy", "userId": currentUser.id],
            )
        } catch let error as APIError {
            await clearLocalSession()
            authError = error
            IOSRunTrace.emit(
                "auth.social_callback",
                category: "auth",
                fields: ["result": "failed", "mode": "legacy", "status": "\(error.status)", "code": error.code],
            )
        } catch {
            await clearLocalSession()
            authError = APIError(
                code: "SOCIAL_CALLBACK_ERROR",
                message: error.localizedDescription,
                status: -1,
                type: .unknown
            )
            IOSRunTrace.emit(
                "auth.social_callback",
                category: "auth",
                fields: ["result": "failed", "mode": "legacy", "error": error.localizedDescription],
            )
        }
    }

    private func queryValue(named name: String, in items: [URLQueryItem]) -> String? {
        items.first(where: { $0.name == name })?.value?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func isMatchingSocialCallbackURL(_ incoming: URL, expected: URL) -> Bool {
        guard let incomingScheme = incoming.scheme?.lowercased(),
              let expectedScheme = expected.scheme?.lowercased(),
              incomingScheme == expectedScheme else {
            return false
        }

        let expectedHost = expected.host?.lowercased() ?? ""
        if !expectedHost.isEmpty, incoming.host?.lowercased() != expectedHost {
            return false
        }

        let normalizedExpectedPath = expected.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if !normalizedExpectedPath.isEmpty {
            let normalizedIncomingPath = incoming.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            return normalizedIncomingPath == normalizedExpectedPath
        }

        return true
    }
}

enum AppThemePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system:
            return "시스템"
        case .light:
            return "라이트"
        case .dark:
            return "다크"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system:
            return nil
        case .light:
            return .light
        case .dark:
            return .dark
        }
    }
}
