import Foundation

enum RelativeTimeFormatter {
    static func string(from source: String?) -> String {
        guard let source, !source.isEmpty else { return "방금 전" }
        guard let date = parseDate(source) else { return source }
        return string(from: date)
    }

    static func string(from date: Date) -> String {
        let now = Date()
        let diffMs = now.timeIntervalSince(date) * 1000

        if diffMs < 0 {
            return absoluteDateFormatter.string(from: date)
        }

        let diffMins = Int(diffMs / 60_000)
        let diffHours = Int(diffMs / 3_600_000)
        let diffDays = Int(diffMs / 86_400_000)

        if diffMins < 1 { return "방금 전" }
        if diffMins < 60 { return "\(diffMins)분 전" }
        if diffHours < 24 { return "\(diffHours)시간 전" }
        if diffDays == 1 { return "하루 전" }
        if diffDays == 2 { return "이틀 전" }
        if diffDays <= 7 { return "\(diffDays)일 전" }

        let diffWeeks = diffDays / 7
        if diffWeeks < 4 { return "\(diffWeeks)주 전" }

        let diffMonths = diffDays / 30
        if diffMonths < 12 { return "\(diffMonths)개월 전" }

        let diffYears = diffDays / 365
        return "\(diffYears)년 전"
    }

    private static func parseDate(_ source: String) -> Date? {
        if let date = iso8601WithFractional.date(from: source) {
            return date
        }
        if let date = iso8601.date(from: source) {
            return date
        }
        return nil
    }

    private static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let absoluteDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy. M. d."
        return formatter
    }()
}
