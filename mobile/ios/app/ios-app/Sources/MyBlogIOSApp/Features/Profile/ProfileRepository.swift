import Foundation

actor ProfileRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func fetchMeProfile() async throws -> UserProfile {
        let req = EndpointRequest(path: "/mobile/auth/me")
        return try await apiClient.request(req, as: UserProfile.self)
    }

    func fetchProfile() async throws -> UserProfile {
        let req = EndpointRequest(path: "/users/profile")
        return try await apiClient.request(req, as: UserProfile.self)
    }

    func updateProfile(_ payload: UserProfileUpdatePayload) async throws -> UserProfile {
        let req = EndpointRequest(
            path: "/users/profile",
            method: .put,
            body: try JSONEncoder().encode(payload),
        )
        return try await apiClient.request(req, as: UserProfile.self)
    }

    func updateMarketingPreferences(_ payload: MarketingPreferencesPayload) async throws -> UserProfile {
        let req = EndpointRequest(
            path: "/users/marketing-preferences",
            method: .patch,
            body: try JSONEncoder().encode(payload),
        )
        return try await apiClient.request(req, as: UserProfile.self)
    }

    func uploadProfileImage(
        fileData: Data,
        fileName: String,
        mimeType: String,
    ) async throws -> AvatarImageUploadResult {
        let req = EndpointRequest(
            path: "/files/v2/profile/avatar",
            method: .post,
        )
        var etag: String?
        let response = try await apiClient.requestMultipart(
            req,
            as: FileUploadResponse.self,
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            onResponseHeaders: { headers in
                etag = headers["ETag"] ?? headers["Etag"] ?? headers["etag"]
            },
        )
        return AvatarImageUploadResult(response: response, etag: etag)
    }

    func fetchMyBlog() async throws -> MobileBlog? {
        let req = EndpointRequest(path: "/blogs/my-blogs")
        do {
            return try await apiClient.request(req, as: MobileBlog.self)
        } catch {
            return nil
        }
    }

    func updateBlog(id: String, payload: MobileBlogUpdatePayload) async throws -> MobileBlog {
        let req = EndpointRequest(
            path: "/blogs/\(id)",
            method: .put,
            body: try JSONEncoder().encode(payload),
        )
        return try await apiClient.request(req, as: MobileBlog.self)
    }

    func checkAlias(_ alias: String) async throws -> AliasCheckResponse {
        let req = EndpointRequest(path: "/blogs/check-alias/\(alias)")
        return try await apiClient.request(req, as: AliasCheckResponse.self)
    }

    func changeAlias(_ alias: String) async throws -> MobileBlog {
        let req = EndpointRequest(
            path: "/blogs/my-blog/alias",
            method: .patch,
            body: try JSONEncoder().encode(BlogAliasPayload(alias: alias)),
        )
        return try await apiClient.request(req, as: MobileBlog.self)
    }
}

struct AvatarImageUploadResult {
    let response: FileUploadResponse
    let etag: String?
}
