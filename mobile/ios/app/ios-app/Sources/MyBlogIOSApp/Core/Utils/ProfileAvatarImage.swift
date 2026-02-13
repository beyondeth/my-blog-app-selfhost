import SwiftUI
#if canImport(UIKit)
import UIKit
private typealias PlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
private typealias PlatformImage = NSImage
#endif

struct ProfileAvatarImage: View {
    let imageURL: URL?
    let fallbackText: String
    let size: CGFloat

    init(imageURL: URL?, fallbackText: String, size: CGFloat) {
        self.imageURL = imageURL
        self.fallbackText = fallbackText.isEmpty ? "?" : fallbackText
        self.size = size
    }

    var body: some View {
        RemoteImageView(
            imageURL: imageURL,
            contentMode: .fill,
            downsampleWidth: size
        ) {
            Circle()
                .fill(.secondary.opacity(0.2))
                .overlay(
                    ProgressView()
                        .controlSize(.mini)
                        .tint(.white),
                    alignment: .center,
                )
        } failure: {
            fallbackAvatar
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(
            Circle()
                .stroke(Color.secondary.opacity(0.2), lineWidth: 0.5),
        )
    }

    private var fallbackAvatar: some View {
        Group {
            if let image = LocalAvatarSampleLoader.sampleImage(seed: fallbackText) {
                sampleImageView(image)
            } else {
                Circle()
                    .fill(Color.blue.opacity(0.15))
                    .overlay(
                        Text(fallbackText)
                            .font(.system(size: max(12, size / 3)))
                            .fontWeight(.semibold)
                            .foregroundStyle(.white),
                    )
            }
        }
    }

    @ViewBuilder
    private func sampleImageView(_ image: PlatformImage) -> some View {
        #if canImport(UIKit)
        Image(uiImage: image)
            .resizable()
            .scaledToFill()
        #elseif canImport(AppKit)
        Image(nsImage: image)
            .resizable()
            .scaledToFill()
        #endif
    }
}

private enum LocalAvatarSampleLoader {
    private static let candidates: [(name: String, ext: String, subdirectory: String)] = [
        ("123", "jpeg", "SampleProfiles"),
        ("Mippy", "jpeg", "Character"),
        ("Bubo", "jpeg", "Character"),
        ("TokaBun", "jpeg", "Character"),
        ("KuruPie", "jpeg", "Character"),
        ("Zimzo", "jpeg", "Character"),
        ("Dopi", "jpeg", "Character"),
        ("Zupin", "jpeg", "Character"),
        ("Paffi", "jpeg", "Character"),
        ("NibbiJoy", "jpeg", "Character"),
        ("Roroa", "jpeg", "Character"),
        ("Meloon", "jpeg", "Character"),
        ("Flynko", "jpeg", "Character"),
        ("Wibbo", "jpeg", "Character"),
        ("Jooli", "jpeg", "Character"),
        ("Bimmo", "jpeg", "Character"),
        ("LumoPop", "jpeg", "Character"),
        ("Kappi", "jpeg", "Character"),
        ("Tinko", "jpeg", "Character"),
        ("Yuniq", "jpeg", "Character"),
    ]

    static func sampleImage(seed: String) -> PlatformImage? {
        guard !candidates.isEmpty else { return nil }
        let normalizedSeed = seed.trimmingCharacters(in: .whitespacesAndNewlines)
        let index = stableIndex(for: normalizedSeed)

        for offset in 0..<candidates.count {
            let next = candidates[(index + offset) % candidates.count]
            if let image = loadImage(
                named: next.name,
                ext: next.ext,
                subdirectory: next.subdirectory,
            ) {
                return image
            }
        }
        return nil
    }

    private static func stableIndex(for seed: String) -> Int {
        var hash = 2166136261
        let bytes = Array(seed.utf8)
        for byte in bytes {
            hash = (hash ^ Int(byte)) &* 16777619
        }
        return (hash & Int.max) % candidates.count
    }

    private static func loadImage(named: String, ext: String, subdirectory: String) -> PlatformImage? {
        let bundleCandidates: [Bundle] = [Bundle.main, Bundle.module] + Bundle.allBundles + Bundle.allFrameworks
        for bundle in bundleCandidates {
            if let url = resourceURL(
                in: bundle,
                named: named,
                ext: ext,
                subdirectory: subdirectory,
            ) {
                #if canImport(UIKit)
                return UIImage(contentsOfFile: url.path)
                #elseif canImport(AppKit)
                return NSImage(contentsOfFile: url.path)
                #endif
            }
        }
        return nil
    }

    private static func resourceURL(
        in bundle: Bundle,
        named: String,
        ext: String,
        subdirectory: String?,
    ) -> URL? {
        if let subdirectory,
           let nested = bundle.url(forResource: named, withExtension: ext, subdirectory: subdirectory) {
            return nested
        }
        return bundle.url(forResource: named, withExtension: ext)
    }
}
