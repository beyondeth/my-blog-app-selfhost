import Foundation

actor CommunityRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func fetchCommunities(
        cursor: String?,
        cursorId: String?,
        limit: Int = 20,
        sortBy: String = "popular",
    ) async throws -> CommunityListResponse {
        var query = [URLQueryItem(name: "limit", value: String(limit)), URLQueryItem(name: "sortBy", value: sortBy)]
        if let cursor {
            query.append(URLQueryItem(name: "cursor", value: cursor))
        }
        if let cursorId {
            query.append(URLQueryItem(name: "cursorId", value: cursorId))
        }
        let req = EndpointRequest(path: "/community", method: .get, query: query)
        return try await apiClient.request(req, as: CommunityListResponse.self)
    }

    func join(communitySlug: String) async throws -> CommunityActionResponse {
        struct EmptyBody: Encodable {}
        let req = EndpointRequest(
            path: "/community/\(communitySlug)/join",
            method: .post,
            body: try JSONEncoder().encode(EmptyBody()),
        )
        return try await apiClient.request(req, as: CommunityActionResponse.self)
    }

    func leave(communitySlug: String) async throws -> CommunityActionResponse {
        struct EmptyBody: Encodable {}
        let req = EndpointRequest(
            path: "/community/\(communitySlug)/leave",
            method: .post,
            body: try JSONEncoder().encode(EmptyBody()),
        )
        return try await apiClient.request(req, as: CommunityActionResponse.self)
    }

    func fetchCommunity(slug: String) async throws -> Community {
        let req = EndpointRequest(path: "/community/\(slug)")
        return try await apiClient.request(req, as: Community.self)
    }
}
