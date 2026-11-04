// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.0"),
        .package(name: "CapgoCapacitorVideoPlayer", path: "../../../node_modules/.pnpm/@capgo+capacitor-video-player@8.2.15_@capacitor+core@8.6.0_hls.js@1.7.3/node_modules/@capgo/capacitor-video-player")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapgoCapacitorVideoPlayer", package: "CapgoCapacitorVideoPlayer")
            ]
        )
    ]
)
