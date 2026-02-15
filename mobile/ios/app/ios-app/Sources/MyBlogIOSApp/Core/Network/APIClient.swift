import Foundation

actor APIClient {
    typealias RefreshAction = @Sendable () async throws -> Void
    typealias AuthFailureAction = @Sendable () async -> Void

    let config: AppConfig
    private let session: URLSession
    private let tokenStore: TokenStoreProtocol
    private let onRefresh: RefreshAction?
    private let onAuthFailure: AuthFailureAction?
    private var refreshTask: Task<Void, Error>?

    init(
        config: AppConfig,
        tokenStore: TokenStoreProtocol,
        session: URLSession = .shared,
        onRefresh: RefreshAction? = nil,
        onAuthFailure: AuthFailureAction? = nil,
    ) {
        self.config = config
        self.tokenStore = tokenStore
        self.session = session
        self.onRefresh = onRefresh
        self.onAuthFailure = onAuthFailure
    }

    func request<T: Decodable>(
        _ request: EndpointRequest,
        as type: T.Type,
        requiresAuthentication: Bool = true,
    ) async throws -> T {
        let data = try await execute(request, requiresAuthentication: requiresAuthentication)

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError(
                code: "DECODE_ERROR",
                message: "응답 파싱 실패 (\(request.path))",
                status: -1,
                target: request.path,
                type: .decoding,
            )
        }
    }

    func requestVoid(_ request: EndpointRequest, requiresAuthentication: Bool = true) async throws {
        _ = try await execute(request, requiresAuthentication: requiresAuthentication)
    }

    func requestMultipart<T: Decodable>(
        _ request: EndpointRequest,
        as type: T.Type,
        fileData: Data,
        fileName: String,
        mimeType: String,
        requiresAuthentication: Bool = true,
        fieldName: String = "file",
        onResponseHeaders: (([String: String]) -> Void)? = nil,
    ) async throws -> T {
        let payload = makeMultipartPayload(
            fileData: fileData,
            fieldName: fieldName,
            fileName: fileName,
            mimeType: mimeType,
        )
        let (data, headers) = try await executeMultipart(
            request,
            payload: payload,
            requiresAuthentication: requiresAuthentication,
        )
        onResponseHeaders?(headers)

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError(
                code: "DECODE_ERROR",
                message: "응답 파싱 실패 (\(request.path))",
                status: -1,
                target: request.path,
                type: .decoding,
            )
        }
    }

    func requestMultipartVoid(
        _ request: EndpointRequest,
        fileData: Data,
        fileName: String,
        mimeType: String,
        requiresAuthentication: Bool = true,
        fieldName: String = "file",
        onResponseHeaders: (([String: String]) -> Void)? = nil,
    ) async throws {
        let payload = makeMultipartPayload(
            fileData: fileData,
            fieldName: fieldName,
            fileName: fileName,
            mimeType: mimeType,
        )
        let (_, headers) = try await executeMultipart(
            request,
            payload: payload,
            requiresAuthentication: requiresAuthentication,
        )
        onResponseHeaders?(headers)
    }

    private func execute(
        _ request: EndpointRequest,
        requiresAuthentication: Bool,
        retried: Bool = false,
        fallbackRetried: Bool = false,
    ) async throws -> Data {
        IOSRunTrace.emit(
            "request.start",
            category: "network",
            fields: [
                "path": request.path,
                "method": request.method.rawValue,
                "requiresAuth": String(requiresAuthentication),
                "retried": String(retried),
            ],
        )

        let responseData: Data
        let httpResponse: HTTPURLResponse

        do {
            let (data, response) = try await send(request, needsAuthHeader: requiresAuthentication)
            responseData = data
            httpResponse = response
        } catch {
            if retried {
                throw error
            }
            if let apiError = error as? APIError {
                IOSRunTrace.emit(
                    "request.failed",
                    category: "network",
                    fields: ["path": request.path, "error": apiError.code, "reason": apiError.message],
                )
                throw apiError
            }
            if let urlError = error as? URLError {
                IOSRunTrace.emit(
                    "request.failed",
                    category: "network",
                    fields: ["path": request.path, "error": "NETWORK_ERROR", "reason": urlError.localizedDescription],
                )
                throw APIError(
                    code: "NETWORK_ERROR",
                    message: "네트워크 오류 (\(request.path)): \(urlError.localizedDescription)",
                    status: urlError.errorCode,
                    target: request.path,
                    type: .network,
                )
            }
            throw APIError(
                code: "NETWORK_ERROR",
                message: "요청 실패 (\(request.path))",
                status: -1,
                target: request.path,
                type: .network,
            )
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let parsedMessage = parseServerMessage(responseData)
            let errorType: APIError.ErrorType =
                httpResponse.statusCode == 401 ? .unauthorized : .server
            let apiError = APIError(
                code: "HTTP_\(httpResponse.statusCode)",
                message: parsedMessage ?? "Request failed",
                status: httpResponse.statusCode,
                target: parseServerTarget(responseData),
                type: errorType,
            )

            if !fallbackRetried,
               httpResponse.statusCode == 404,
               let fallbackPath = legacyFallbackPath(for: request.path) {
                let fallbackRequest = EndpointRequest(
                    path: fallbackPath,
                    method: request.method,
                    body: request.body,
                    query: request.query,
                )
                IOSRunTrace.emit(
                    "request.fallback",
                    category: "network",
                    fields: [
                        "path": request.path,
                        "fallbackPath": fallbackPath,
                        "status": "\(httpResponse.statusCode)",
                    ],
                )
                return try await execute(
                    fallbackRequest,
                    requiresAuthentication: requiresAuthentication,
                    retried: retried,
                    fallbackRetried: true,
                )
            }

            if !requiresAuthentication || retried {
                IOSRunTrace.emit(
                    "request.response_error",
                    category: "network",
                    fields: [
                        "path": request.path,
                        "status": "\(httpResponse.statusCode)",
                        "needsRetry": "false",
                    ],
                )
                throw apiError
            }

            guard httpResponse.statusCode == 401 else {
                IOSRunTrace.emit(
                    "request.response_error",
                    category: "network",
                    fields: [
                        "path": request.path,
                        "status": "\(httpResponse.statusCode)",
                        "needsRetry": "false",
                    ],
                )
                throw apiError
            }

            do {
                IOSRunTrace.emit("request.refresh_start", category: "network", fields: ["path": request.path])
                try await refreshAccessToken()
                return try await execute(request, requiresAuthentication: requiresAuthentication, retried: true)
            } catch {
                IOSRunTrace.emit(
                    "request.refresh_failed",
                    category: "network",
                    fields: ["path": request.path, "cause": "\(error)"],
                )
                await notifyAuthFailure()
                throw apiError
            }
        }

        IOSRunTrace.emit(
            "request.success",
            category: "network",
            fields: ["path": request.path, "status": "\(httpResponse.statusCode)"],
        )

        return responseData
    }

    private func executeMultipart(
        _ request: EndpointRequest,
        payload: MultipartPayload,
        requiresAuthentication: Bool,
        retried: Bool = false,
    ) async throws -> (Data, [String: String]) {
        IOSRunTrace.emit(
            "request.multipart.start",
            category: "network",
            fields: [
                "path": request.path,
                "requiresAuth": String(requiresAuthentication),
                "retried": String(retried),
            ],
        )

        let responseData: Data
        let httpResponse: HTTPURLResponse
        var headers: [String: String] = [:]

        do {
            let (data, response) = try await sendMultipart(
                request,
                needsAuthHeader: requiresAuthentication,
                payload: payload,
            )
            responseData = data
            httpResponse = response
            headers = responseHeaders(from: response)
        } catch {
            if retried {
                throw error
            }
            if let apiError = error as? APIError {
                IOSRunTrace.emit(
                    "request.multipart.failed",
                    category: "network",
                    fields: ["path": request.path, "error": apiError.code, "reason": apiError.message],
                )
                throw apiError
            }
            if let urlError = error as? URLError {
                IOSRunTrace.emit(
                    "request.multipart.failed",
                    category: "network",
                    fields: ["path": request.path, "error": "NETWORK_ERROR", "reason": urlError.localizedDescription],
                )
                throw APIError(
                    code: "NETWORK_ERROR",
                    message: "네트워크 오류 (\(request.path)): \(urlError.localizedDescription)",
                    status: urlError.errorCode,
                    target: request.path,
                    type: .network,
                )
            }
            throw APIError(
                code: "NETWORK_ERROR",
                message: "요청 실패 (\(request.path))",
                status: -1,
                target: request.path,
                type: .network,
            )
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let parsedMessage = parseServerMessage(responseData)
            let errorType: APIError.ErrorType =
                httpResponse.statusCode == 401 ? .unauthorized : .server
            let apiError = APIError(
                code: "HTTP_\(httpResponse.statusCode)",
                message: parsedMessage ?? "Request failed",
                status: httpResponse.statusCode,
                target: parseServerTarget(responseData),
                type: errorType,
            )

            if !requiresAuthentication || retried {
                IOSRunTrace.emit(
                    "request.multipart.response_error",
                    category: "network",
                    fields: ["path": request.path, "status": "\(httpResponse.statusCode)", "needsRetry": "false"],
                )
                throw apiError
            }

            guard httpResponse.statusCode == 401 else {
                IOSRunTrace.emit(
                    "request.multipart.response_error",
                    category: "network",
                    fields: ["path": request.path, "status": "\(httpResponse.statusCode)", "needsRetry": "false"],
                )
                throw apiError
            }

            do {
                IOSRunTrace.emit("request.multipart.refresh_start", category: "network", fields: ["path": request.path])
                try await refreshAccessToken()
                return try await executeMultipart(
                    request,
                    payload: payload,
                    requiresAuthentication: requiresAuthentication,
                    retried: true,
                )
            } catch {
                IOSRunTrace.emit(
                    "request.multipart.refresh_failed",
                    category: "network",
                    fields: ["path": request.path, "cause": "\(error)"],
                )
                await notifyAuthFailure()
                throw apiError
            }
        }

        IOSRunTrace.emit(
            "request.multipart.success",
            category: "network",
            fields: ["path": request.path, "status": "\(httpResponse.statusCode)"],
        )

        return (responseData, headers)
    }

    private func refreshAccessToken() async throws {
        if let existing = refreshTask {
            return try await existing.value
        }

        let task = Task<Void, Error> { [onRefresh] in
            guard let onRefresh else {
                throw APIError(
                    code: "NO_REFRESH_HANDLER",
                    message: "토큰 갱신 핸들러가 등록되지 않았습니다",
                    status: 500,
                    type: .server,
                )
            }
            try await onRefresh()
        }
        refreshTask = task

        do {
            try await task.value
        } catch {
            refreshTask = nil
            throw error
        }

        refreshTask = nil
    }

    private func notifyAuthFailure() async {
        if let onAuthFailure {
            await onAuthFailure()
        }
    }

    private func send(
        _ request: EndpointRequest,
        needsAuthHeader: Bool,
    ) async throws -> (Data, HTTPURLResponse) {
        var urlRequest = try buildRequest(request)

        if needsAuthHeader, let token = await tokenStore.currentAccessToken() {
            urlRequest.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw APIError(
                code: "NETWORK_ERROR",
                message: "Invalid response",
                status: -1,
                type: .network,
            )
        }

        return (data, http)
    }

    private func sendMultipart(
        _ request: EndpointRequest,
        needsAuthHeader: Bool,
        payload: MultipartPayload,
    ) async throws -> (Data, HTTPURLResponse) {
        var urlRequest = try buildRequest(request)
        urlRequest.setValue("multipart/form-data; boundary=\(payload.boundary)", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = payload.body

        if needsAuthHeader, let token = await tokenStore.currentAccessToken() {
            urlRequest.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw APIError(
                code: "NETWORK_ERROR",
                message: "Invalid response",
                status: -1,
                type: .network,
            )
        }

        return (data, http)
    }

    private func responseHeaders(from httpResponse: HTTPURLResponse) -> [String: String] {
        var output: [String: String] = [:]
        for (key, value) in httpResponse.allHeaderFields {
            if let keyString = key as? String, let valueString = value as? String {
                output[keyString] = valueString
            }
        }
        return output
    }

    private func buildRequest(_ request: EndpointRequest) throws -> URLRequest {
        guard let url = request.makeURL(baseURL: config.baseURL) else {
            throw APIError(
                code: "INVALID_URL",
                message: "Cannot build URL",
                status: -1,
                type: .badRequest,
            )
        }
        var req = request.toURLRequest(url: url)
        req.timeoutInterval = config.apiTimeout
        return req
    }

    private func parseServerMessage(_ data: Data) -> String? {
        guard !data.isEmpty, let decoded = parseServerResponse(data) else {
            let raw = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if let raw, !raw.isEmpty {
                return raw
            }
            return nil
        }
        let normalized = decoded.message.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }

    private func parseServerTarget(_ data: Data) -> String? {
        guard !data.isEmpty, let decoded = parseServerResponse(data) else {
            return nil
        }
        return decoded.target
    }

    private func parseServerResponse(_ data: Data) -> APIErrorResponse? {
        guard !data.isEmpty else {
            return nil
        }
        return try? JSONDecoder().decode(APIErrorResponse.self, from: data)
    }

    private func makeMultipartPayload(
        fileData: Data,
        fieldName: String,
        fileName: String,
        mimeType: String,
    ) -> MultipartPayload {
        let boundary = UUID().uuidString
        var body = Data()
        body.append("--\(boundary)\r\n")
        body.append(
            "Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n"
        )
        body.append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n")
        return MultipartPayload(boundary: boundary, body: body)
    }

    private func legacyFallbackPath(for path: String) -> String? {
        let fallbackMappings: [String] = [
            "/mobile/feed",
            "/mobile/posts",
            "/mobile/auth",
            "/mobile/files",
            "/mobile/community",
            "/mobile/comments",
            "/mobile/reports",
            "/mobile/notifications",
        ]

        for mapping in fallbackMappings where path == mapping || path.hasPrefix("\(mapping)/") {
            return "/" + path.dropFirst("/mobile/".count)
        }
        return nil
    }
}

private extension Data {
    mutating func append(_ value: String) {
        if let data = value.data(using: .utf8) {
            append(data)
        }
    }
}

private struct MultipartPayload {
    let boundary: String
    let body: Data
}

struct EndpointRequest {
    enum Method: String { case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE" }

    let path: String
    let method: Method
    let body: Data?
    let query: [URLQueryItem]

    init(path: String, method: Method = .get, body: Data? = nil, query: [URLQueryItem] = []) {
        self.path = path
        self.method = method
        self.body = body
        self.query = query
    }

    func makeURL(baseURL: URL) -> URL? {
        var comps = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        if !query.isEmpty {
            comps?.queryItems = query
        }
        return comps?.url
    }

    func toURLRequest(url: URL) -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method.rawValue
        req.timeoutInterval = 15
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            req.httpBody = body
        }
        return req
    }
}
