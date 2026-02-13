import Foundation
import SwiftUI
import WebKit

enum YouTubeMediaResolver {
    static func firstVideoID(in candidates: [String?]) -> String? {
        for candidate in candidates {
            guard let candidate, !candidate.isEmpty else { continue }
            if let id = extractVideoID(from: candidate) {
                return id
            }
        }
        return nil
    }

    static func isYouTubeMediaLocator(_ value: String?) -> Bool {
        guard let value, !value.isEmpty else { return false }
        return extractVideoID(from: value) != nil
    }

    static func extractVideoID(from source: String) -> String? {
        let urlPattern = #"(https?://[^\s"')]+)"#
        if let regex = try? NSRegularExpression(pattern: urlPattern) {
            let ns = source as NSString
            let matches = regex.matches(in: source, range: NSRange(location: 0, length: ns.length))
            for match in matches where match.numberOfRanges > 1 {
                let raw = ns.substring(with: match.range(at: 1))
                if let id = extractVideoIDFromURL(raw) {
                    return id
                }
            }
        }

        if let regex = try? NSRegularExpression(pattern: #"img\.youtube\.com/vi(?:_webp)?/([^/\?\s]+)"#, options: [.caseInsensitive]) {
            let ns = source as NSString
            if let match = regex.firstMatch(in: source, range: NSRange(location: 0, length: ns.length)),
               match.numberOfRanges > 1
            {
                let candidate = ns.substring(with: match.range(at: 1))
                return sanitizeVideoID(candidate)
            }
        }

        return nil
    }

    private static func extractVideoIDFromURL(_ raw: String) -> String? {
        guard let url = URL(string: raw) else { return nil }
        let host = (url.host ?? "").lowercased()
        let path = url.path

        if host.contains("youtu.be") {
            let id = path
                .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                .components(separatedBy: "/")
                .first
            return sanitizeVideoID(id)
        }

        if host.contains("youtube.com") || host.contains("youtube-nocookie.com") {
            if path.hasPrefix("/watch"),
               let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
               let v = components.queryItems?.first(where: { $0.name == "v" })?.value
            {
                return sanitizeVideoID(v)
            }

            for prefix in ["/embed/", "/shorts/", "/live/", "/v/"] {
                if path.hasPrefix(prefix) {
                    let id = path.replacingOccurrences(of: prefix, with: "").components(separatedBy: "/").first
                    return sanitizeVideoID(id)
                }
            }
        }

        return nil
    }

    private static func sanitizeVideoID(_ source: String?) -> String? {
        guard let source else { return nil }
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count == 11 else { return nil }
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")
        guard trimmed.unicodeScalars.allSatisfy({ allowed.contains($0) }) else { return nil }
        return trimmed
    }
}

struct YouTubeInlinePlayerView: UIViewRepresentable {
    let videoID: String
    var autoplay: Bool = false

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        if #available(iOS 10.0, *) {
            configuration.mediaTypesRequiringUserActionForPlayback = []
        }

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let params: [String: String] = [
            "playsinline": "1",
            "rel": "0",
            "modestbranding": "1",
            "controls": "1",
            "autoplay": autoplay ? "1" : "0",
            "mute": autoplay ? "1" : "0",
        ]

        var components = URLComponents(string: "https://www.youtube.com/embed/\(videoID)")
        components?.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = components?.url else { return }

        if context.coordinator.lastLoadedURL == url {
            return
        }
        context.coordinator.lastLoadedURL = url

        var request = URLRequest(url: url)
        request.setValue("https://www.youtube.com/", forHTTPHeaderField: "Referer")
        request.setValue("https://www.youtube.com", forHTTPHeaderField: "Origin")
        webView.load(request)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var lastLoadedURL: URL?

        func webView(
            _: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard navigationAction.navigationType == .linkActivated,
                  let url = navigationAction.request.url
            else {
                decisionHandler(.allow)
                return
            }

            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
        }
    }
}
