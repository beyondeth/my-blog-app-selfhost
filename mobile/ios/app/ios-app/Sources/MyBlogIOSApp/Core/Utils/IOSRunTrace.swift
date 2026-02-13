import Foundation
import OSLog

enum IOSRunTrace {
    private static let logger = Logger(subsystem: "com.myblog.IOSRunTrace", category: "runtime")
    private static let isEnabled: Bool = {
#if DEBUG
        let raw = ProcessInfo.processInfo.environment["MOBILE_IOS_TRACE_ENABLED"] ?? "1"
        let normalized = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized == "1" || normalized == "true" || normalized == "yes" || normalized == "on"
#else
        return false
#endif
    }()

    static func emit(
        _ event: String,
        category: String,
        fields: [String: String] = [:],
    ) {
        guard isEnabled else { return }
        let payload = fields
            .sorted { $0.key < $1.key }
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: " ")
        if payload.isEmpty {
            logger.debug("[IOS-TRACE][\(category)] \(event)")
        } else {
            logger.debug("[IOS-TRACE][\(category)] \(event) | \(payload)")
        }
    }
}
