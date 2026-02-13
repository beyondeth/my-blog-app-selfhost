import Foundation

final class RealtimeClient {
    let endpoint: URL
    init(endpoint: URL) {
        self.endpoint = endpoint
    }

    func connect() {
        // Socket 또는 푸시 브리징 진입점
    }

    func disconnect() {
        // 연결 정리
    }
}
