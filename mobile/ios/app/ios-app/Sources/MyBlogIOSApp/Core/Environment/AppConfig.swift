import Foundation

struct AppConfig {
    let baseURL: URL
    let frontendURL: URL
    let socketURL: URL
    let socialAuthCallbackURL: URL
    let apiTimeout: TimeInterval
    let appVersion: String

    static func load() throws -> AppConfig {
#if DEBUG
        let defaultBaseURL = "http://localhost:3000/api/v1"
        let defaultFrontendURL = "http://localhost:3001"
#else
        let defaultBaseURL = "https://www.codebase.blog/api/v1"
        let defaultFrontendURL = "https://www.codebase.blog"
#endif
        let base = resolvedValue(
            key: "MOBILE_API_BASE_URL",
            fallback: defaultBaseURL,
        )
        let frontend = resolvedValue(
            key: "MOBILE_FRONTEND_URL",
            fallback: defaultFrontendURL,
        )
        let socket = resolvedValue(
            key: "MOBILE_SOCKET_URL",
            fallback: base,
        )
        let socialAuthCallback = resolvedValue(
            key: "MOBILE_OAUTH_CALLBACK_URL",
            fallback: "codebase://auth/callback",
        )

        guard let baseURL = URL(string: base) else {
            throw AppConfigError.invalidURL(key: "MOBILE_API_BASE_URL", value: base)
        }
        guard let frontendURL = URL(string: frontend) else {
            throw AppConfigError.invalidURL(key: "MOBILE_FRONTEND_URL", value: frontend)
        }
        guard let socketURL = URL(string: socket) else {
            throw AppConfigError.invalidURL(key: "MOBILE_SOCKET_URL", value: socket)
        }
        guard let socialAuthCallbackURL = URL(string: socialAuthCallback),
              socialAuthCallbackURL.scheme?.isEmpty == false else {
            throw AppConfigError.invalidURL(
                key: "MOBILE_OAUTH_CALLBACK_URL",
                value: socialAuthCallback
            )
        }

#if !DEBUG
        let allowLocalhost = resolvedValue(key: "MOBILE_ALLOW_LOCALHOST", fallback: "0") == "1"
        if !allowLocalhost && (isLocalhostURL(baseURL) || isLocalhostURL(frontendURL)) {
            throw AppConfigError.localhostDisallowedInRelease
        }
#endif

        return AppConfig(
            baseURL: baseURL,
            frontendURL: frontendURL,
            socketURL: socketURL,
            socialAuthCallbackURL: socialAuthCallbackURL,
            apiTimeout: 15,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
        )
    }

    private static func resolvedValue(key: String, fallback: String) -> String {
        if let env = ProcessInfo.processInfo.environment[key], !env.isEmpty {
            return env
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: key) as? String, !plist.isEmpty {
            return plist
        }
        return fallback
    }

    private static func isLocalhostURL(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return host == "localhost" || host == "127.0.0.1" || host == "::1"
    }
}

enum AppConfigError: LocalizedError {
    case invalidURL(key: String, value: String)
    case localhostDisallowedInRelease

    var errorDescription: String? {
        switch self {
        case .invalidURL(let key, let value):
            return "유효하지 않은 URL 설정: \(key)=\(value)"
        case .localhostDisallowedInRelease:
            return "릴리즈 환경에서는 localhost URL을 사용할 수 없습니다. MOBILE_API_BASE_URL / MOBILE_FRONTEND_URL을 실제 도메인으로 설정하세요."
        }
    }
}
