import Nuke
import SwiftUI

@main
struct MyBlogIOSApp: App {
    @StateObject private var appStore = AppStore()

    init() {
        configureImagePipeline()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appStore)
                .onOpenURL { url in
                    Task { @MainActor in
                        await appStore.handleIncomingURL(url)
                    }
                }
        }
    }

    private func configureImagePipeline() {
        ImageCache.shared.costLimit = 1024 * 1024 * 220
        ImageCache.shared.countLimit = 700

        var configuration = ImagePipeline.Configuration.withDataCache(
            name: "kr.sihyung.myblog.ios.image-cache",
            sizeLimit: 1024 * 1024 * 500
        )
        configuration.imageCache = ImageCache.shared
        configuration.isResumableDataEnabled = true
        configuration.isRateLimiterEnabled = true
        configuration.isTaskCoalescingEnabled = true
        configuration.isDecompressionEnabled = true
        ImagePipeline.shared = ImagePipeline(configuration: configuration)
    }
}
