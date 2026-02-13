import Foundation

struct AppConfig {
    let baseURL: URL
    let frontendURL: URL
    let socketURL: URL
    let apiTimeout: TimeInterval
    let appVersion: String

    static func load() throws -> AppConfig {
        let defaultBaseURL = "http://localhost:3000/api/v1"
        let defaultFrontendURL = "http://localhost:3001"
        let base = ProcessInfo.processInfo.environment["MOBILE_API_BASE_URL"] ?? defaultBaseURL
        let baseURL = URL(string: base) ?? URL(string: defaultBaseURL)!
        let frontend = ProcessInfo.processInfo.environment["MOBILE_FRONTEND_URL"] ?? defaultFrontendURL
        let socket = ProcessInfo.processInfo.environment["MOBILE_SOCKET_URL"] ?? base
        return AppConfig(
            baseURL: baseURL,
            frontendURL: URL(string: frontend) ?? URL(string: defaultFrontendURL)!,
            socketURL: URL(string: socket) ?? baseURL,
            apiTimeout: 15,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
        )
    }
}
