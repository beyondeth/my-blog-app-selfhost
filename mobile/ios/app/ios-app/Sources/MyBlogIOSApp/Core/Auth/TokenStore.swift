import Foundation
import Security

protocol TokenStoreProtocol {
    func save(accessToken: String, refreshToken: String, refreshAt: Date?) async
    func currentAccessToken() async -> String?
    func currentRefreshToken() async -> String?
    func clear() async
}

actor TokenStore: TokenStoreProtocol {
    private let accessKey = "myblog.access"
    private let refreshKey = "myblog.refresh"
    private let refreshAtKey = "myblog.refreshAt"

    // NOTE: 교체 시 Keychain wrapper 사용 권장
    func save(accessToken: String, refreshToken: String, refreshAt: Date? = nil) async {
        KeychainHelper.standard.save(accessToken, forKey: accessKey)
        KeychainHelper.standard.save(refreshToken, forKey: refreshKey)
        if let refreshAt {
            KeychainHelper.standard.save(String(refreshAt.timeIntervalSince1970), forKey: refreshAtKey)
        }
    }

    func currentAccessToken() async -> String? {
        normalizeToken(KeychainHelper.standard.readString(forKey: accessKey))
    }

    func currentRefreshToken() async -> String? {
        normalizeToken(KeychainHelper.standard.readString(forKey: refreshKey))
    }

    func clear() async {
        KeychainHelper.standard.delete(forKey: accessKey)
        KeychainHelper.standard.delete(forKey: refreshKey)
        KeychainHelper.standard.delete(forKey: refreshAtKey)
    }

    private func normalizeToken(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

enum KeychainHelperError: Error {
    case invalidData
}

struct KeychainHelper {
    static let standard = KeychainHelper()
    private init() {}

    func save(_ value: String, forKey: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: forKey,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func readString(forKey: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: forKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(forKey: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: forKey
        ]
        SecItemDelete(query as CFDictionary)
    }
}
