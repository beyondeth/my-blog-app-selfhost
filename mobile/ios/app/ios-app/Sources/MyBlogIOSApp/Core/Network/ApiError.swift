import Foundation

struct APIError: Error, Codable, Equatable, LocalizedError {
    enum ErrorType: String, Codable {
        case network
        case unauthorized
        case badRequest
        case server
        case decoding
        case timeout
        case unknown
    }

    let code: String
    let message: String
    let target: String?
    let status: Int
    let type: ErrorType

    init(code: String, message: String, status: Int, target: String? = nil, type: ErrorType = .unknown) {
        self.code = code
        self.message = message
        self.target = target
        self.status = status
        self.type = type
    }

    var errorDescription: String? {
        message
    }
}

struct APIErrorResponse: Decodable {
    let code: String
    let message: String
    let target: String?

    enum CodingKeys: String, CodingKey {
        case code
        case message
        case target
        case error
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        code = (try? container.decode(String.self, forKey: .code)) ?? "UNKNOWN_SERVER_ERROR"
        target = try? container.decodeIfPresent(String.self, forKey: .target)

        if let message = try? container.decode(String.self, forKey: .message),
           !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            self.message = message
            return
        }

        if let messages = try? container.decode([String].self, forKey: .message),
           !messages.isEmpty {
            self.message = messages.joined(separator: ", ")
            return
        }

        if let fallback = try? container.decode(String.self, forKey: .error),
           !fallback.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            self.message = fallback
            return
        }

        self.message = "Request failed"
    }
}
