import Foundation

actor AuthService {
    private let apiClient: APIClient
    private let tokenStore: TokenStoreProtocol
    private let config: AppConfig

    init(apiClient: APIClient, tokenStore: TokenStoreProtocol, config: AppConfig) {
        self.apiClient = apiClient
        self.tokenStore = tokenStore
        self.config = config
    }

    func login(email: String, password: String) async throws -> UserSession {
        let body = LoginRequest(email: email, password: password)
        let req = EndpointRequest(
            path: "/mobile/auth/login",
            method: .post,
            body: try JSONEncoder().encode(body)
        )
        let response: MobileAuthResponse = try await apiClient.request(
            req,
            as: MobileAuthResponse.self,
            requiresAuthentication: false,
        )
        await tokenStore.save(accessToken: response.accessToken, refreshToken: response.refreshToken, refreshAt: nil)
        return UserSession(user: response.user, accessToken: response.accessToken, refreshToken: response.refreshToken)
    }

    func refresh() async throws -> UserSession {
        guard let refreshToken = await tokenStore.currentRefreshToken() else {
            throw APIError(code: "NO_REFRESH_TOKEN", message: "refresh token not found", status: 401, type: .unauthorized)
        }
        let body = RefreshRequest(refreshToken: refreshToken)
        let req = EndpointRequest(
            path: "/mobile/auth/refresh",
            method: .post,
            body: try JSONEncoder().encode(body)
        )
        let response: MobileAuthResponse = try await apiClient.request(
            req,
            as: MobileAuthResponse.self,
            requiresAuthentication: false,
        )
        await tokenStore.save(accessToken: response.accessToken, refreshToken: response.refreshToken, refreshAt: nil)
        return UserSession(user: response.user, accessToken: response.accessToken, refreshToken: response.refreshToken)
    }

    func logout() async throws {
        let req = EndpointRequest(path: "/mobile/auth/logout", method: .post)
        try await apiClient.requestVoid(req)
        await tokenStore.clear()
    }

    func changePassword(currentPassword: String, newPassword: String) async throws -> MessageResponse {
        let body = ChangePasswordRequest(
            currentPassword: currentPassword,
            newPassword: newPassword,
        )
        let req = EndpointRequest(
            path: "/mobile/auth/change-password",
            method: .post,
            body: try JSONEncoder().encode(body)
        )
        return try await apiClient.request(req, as: MessageResponse.self)
    }

    func me() async throws -> UserProfile {
        let req = EndpointRequest(path: "/mobile/auth/me")
        return try await apiClient.request(req, as: UserProfile.self)
    }

    nonisolated func socialAuthURL(for provider: SocialProvider) -> URL? {
        return config.frontendURL.appendingPathComponent(provider.path).absoluteURL
    }
}

struct MobileAuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let user: UserProfile

    private enum CodingKeys: String, CodingKey {
        case accessToken
        case refreshToken
        case access_token
        case refresh_token
        case user
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let access = (try? container.decode(String.self, forKey: .accessToken))
            ?? (try? container.decode(String.self, forKey: .access_token))
        let refresh = (try? container.decode(String.self, forKey: .refreshToken))
            ?? (try? container.decode(String.self, forKey: .refresh_token))

        guard
            let accessToken = access, !accessToken.isEmpty,
            let refreshToken = refresh, !refreshToken.isEmpty
        else {
            throw DecodingError.dataCorruptedError(
                forKey: .accessToken,
                in: container,
                debugDescription: "missing access token pair",
            )
        }

        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.user = try container.decode(UserProfile.self, forKey: .user)
    }
}

struct UserProfile: Decodable {
    let id: String
    let username: String
    let email: String
    let role: String?
    let profileImage: String?
    let isEmailVerified: Bool?
    let authProvider: String?
    let lastLoginProvider: String?
    let subscriptionTier: String?
    let subscriptionStatus: String?
    let bio: String?
    let jobTitle: String?
    let blogSlug: String?
    let termsAcceptedAt: String?
    let privacyAcceptedAt: String?
    let marketingOptIn: Bool?
    let newsletterOptIn: Bool?
    let socialLinks: [SocialLink]?
    let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case username
        case email
        case role
        case profileImage
        case isEmailVerified
        case authProvider
        case lastLoginProvider
        case subscriptionTier
        case subscriptionStatus
        case bio
        case jobTitle
        case blogSlug
        case termsAcceptedAt
        case privacyAcceptedAt
        case marketingOptIn
        case newsletterOptIn
        case socialLinks
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        if let idString = try? container.decode(String.self, forKey: .id) {
            id = idString
        } else if let idNumber = try? container.decode(Int.self, forKey: .id) {
            id = String(idNumber)
        } else {
            id = ""
        }

        username = (try? container.decode(String.self, forKey: .username)) ?? ""
        email = (try? container.decode(String.self, forKey: .email)) ?? ""
        role = try? container.decode(String.self, forKey: .role)
        profileImage = try? container.decode(String.self, forKey: .profileImage)
        isEmailVerified = try? container.decode(Bool.self, forKey: .isEmailVerified)
        authProvider = try? container.decode(String.self, forKey: .authProvider)
        lastLoginProvider = try? container.decode(String.self, forKey: .lastLoginProvider)
        subscriptionTier = try? container.decode(String.self, forKey: .subscriptionTier)
        subscriptionStatus = try? container.decode(String.self, forKey: .subscriptionStatus)
        bio = try? container.decode(String.self, forKey: .bio)
        jobTitle = try? container.decode(String.self, forKey: .jobTitle)
        blogSlug = try? container.decode(String.self, forKey: .blogSlug)
        termsAcceptedAt = try? container.decode(String.self, forKey: .termsAcceptedAt)
        privacyAcceptedAt = try? container.decode(String.self, forKey: .privacyAcceptedAt)
        marketingOptIn = try? container.decode(Bool.self, forKey: .marketingOptIn)
        newsletterOptIn = try? container.decode(Bool.self, forKey: .newsletterOptIn)
        socialLinks = (try? container.decode([SocialLink].self, forKey: .socialLinks)) ?? []
        createdAt = try? container.decode(String.self, forKey: .createdAt)
    }
}

struct SocialLink: Decodable {
    let platform: String?
    let url: String?
}

struct LoginRequest: Encodable { let email: String; let password: String }
enum SocialProvider: String, CaseIterable, Identifiable {
    case google
    case github

    var id: String { rawValue }
    var label: String {
        switch self {
        case .google:
            return "Google"
        case .github:
            return "GitHub"
        }
    }

    var path: String {
        switch self {
        case .google:
            return "/auth/google"
        case .github:
            return "/auth/github"
        }
    }
}

struct ChangePasswordRequest: Encodable {
    let currentPassword: String
    let newPassword: String
}

struct MessageResponse: Decodable {
    let success: Bool?
    let message: String?
}
struct RefreshRequest: Encodable { let refreshToken: String }

struct UserSession {
    let user: UserProfile
    let accessToken: String
    let refreshToken: String
}
