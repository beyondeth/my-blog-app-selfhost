import Nuke
import NukeUI
import SwiftUI

struct RemoteImageView<Placeholder: View, Failure: View>: View {
    let imageURL: URL?
    let contentMode: ContentMode
    let downsampleWidth: CGFloat?
    let placeholder: Placeholder
    let failure: Failure

    init(
        imageURL: URL?,
        contentMode: ContentMode = .fill,
        downsampleWidth: CGFloat? = nil,
        @ViewBuilder placeholder: () -> Placeholder,
        @ViewBuilder failure: () -> Failure
    ) {
        self.imageURL = imageURL
        self.contentMode = contentMode
        self.downsampleWidth = downsampleWidth
        self.placeholder = placeholder()
        self.failure = failure()
    }

    var body: some View {
        if let imageURL {
            LazyImage(url: imageURL) { state in
                if let image = state.image {
                    image
                        .resizable()
                        .aspectRatio(contentMode: contentMode)
                } else if let error = state.error {
                    failure
                        .onAppear {
                            IOSRunTrace.emit(
                                "image.load_failed",
                                category: "image",
                                fields: [
                                    "url": imageURL.absoluteString,
                                    "error": "\(error)",
                                ],
                            )
                        }
                } else {
                    placeholder
                }
            }
            .processors(processors)
            .onDisappear(.lowerPriority)
        } else {
            failure
                .onAppear {
                    IOSRunTrace.emit(
                        "image.url_nil",
                        category: "image",
                    )
                }
        }
    }

    private var processors: [any ImageProcessing]? {
        guard let downsampleWidth, downsampleWidth > 0 else { return nil }
        return [
            ImageProcessors.Resize(
                width: downsampleWidth,
                unit: .points,
                upscale: false
            ),
        ]
    }
}
