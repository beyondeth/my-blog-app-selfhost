import Foundation
import Nuke

@MainActor
final class ImagePreheater {
    static let shared = ImagePreheater()

    private let prefetcher = ImagePrefetcher()
    private var prefetchedURLs: Set<URL> = []

    private init() {}

    func preheat(urls: [URL], maxCount: Int = 12) {
        let unique = Array(Set(urls))
        let limited = Array(unique.prefix(maxCount))
        guard !limited.isEmpty else { return }

        let delta = limited.filter { url in
            prefetchedURLs.insert(url).inserted
        }
        guard !delta.isEmpty else {
            return
        }

        prefetcher.isPaused = false
        prefetcher.startPrefetching(with: delta)
    }

    func reset() {
        prefetcher.stopPrefetching()
        prefetchedURLs.removeAll()
    }
}
