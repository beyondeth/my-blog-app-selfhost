// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MyBlogIOSApp",
    platforms: [
        .iOS(.v17),
        .macOS(.v10_15)
    ],
    products: [
        .executable(name: "MyBlogIOSApp", targets: ["MyBlogIOSApp"])
    ],
    dependencies: [
        .package(url: "https://github.com/kean/Nuke.git", from: "12.8.0"),
    ],
    targets: [
        .executableTarget(
            name: "MyBlogIOSApp",
            dependencies: [
                .product(name: "Nuke", package: "Nuke"),
                .product(name: "NukeUI", package: "Nuke")
            ],
            path: "Sources",
            resources: [.process("MyBlogIOSApp/Resources")]
        )
    ]
)
