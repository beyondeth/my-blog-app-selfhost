import Foundation

func resolveImageURL(
    _ candidate: String?,
    apiBaseURL: URL?,
    frontendBaseURL: URL?,
    cacheBuster: String? = nil,
) -> URL? {
    guard let rawCandidate = candidate?.trimmingCharacters(in: .whitespacesAndNewlines),
          !rawCandidate.isEmpty else {
        return nil
    }

    if rawCandidate.hasPrefix("character/") || rawCandidate.hasPrefix("/character/") {
        return localCharacterAssetURL(from: rawCandidate)
    }
    if rawCandidate.hasPrefix("user_images/") || rawCandidate.hasPrefix("/user_images/") {
        return localSampleProfileAssetURL(from: rawCandidate)
    }

    let candidateWithCacheBuster = appendCacheBuster(rawCandidate, value: cacheBuster)
    if candidateWithCacheBuster.hasPrefix("http://") || candidateWithCacheBuster.hasPrefix("https://") {
        return URL(string: candidateWithCacheBuster)
    }

    let cleaned = candidateWithCacheBuster.hasPrefix("/") ? String(candidateWithCacheBuster.dropFirst()) : candidateWithCacheBuster
    let pathOnly = cleaned.split(separator: "?").first.map(String.init) ?? cleaned
    guard !pathOnly.isEmpty else { return nil }

    let backendRoot = apiBaseURL.flatMap(backendRoot(from:))
    let apiRoot = apiBaseURL.flatMap(apiV1Root(from:))

    if let absoluteBackend = absoluteBackendURL(
        path: pathOnly,
        backendRoot: backendRoot,
    ) {
        return absoluteBackend
    }

    if let localCharacterAssetURL = localCharacterAssetURL(from: pathOnly) {
        return localCharacterAssetURL
    }
    if let localSampleProfileAssetURL = localSampleProfileAssetURL(from: pathOnly) {
        return localSampleProfileAssetURL
    }

    if pathOnly.hasPrefix("files/proxy/") || pathOnly.hasPrefix("files/download") {
        return absolutePath(pathOnly, backendRoot: apiRoot)
    }

    if pathOnly.hasPrefix("uploads/") || pathOnly.hasPrefix("v2/") {
        if let cdnURL = cdnURL(fromRelativePath: cleaned) {
            return cdnURL
        }
        return absolutePath("files/proxy/\(pathOnly)", backendRoot: apiRoot)
    }

    if pathOnly.hasPrefix("character/"), let frontendRoot = frontendBaseURL {
        return URL(string: "\(trimmedSlash(frontendRoot.absoluteString))/\(pathOnly)")
    }

    if isBareAssetFile(pathOnly) {
        if let cdnURL = cdnURL(fromRelativePath: "uploads/\(pathOnly)") {
            return cdnURL
        }
        return absolutePath("files/proxy/uploads/\(pathOnly)", backendRoot: apiRoot)
    }

    if pathOnly.hasPrefix("cdn/") {
        let suffix = String(pathOnly.dropFirst(4))
        return cdnURL(fromRelativePath: suffix)
    }

    if pathOnly.hasPrefix("cdn.") {
        return URL(string: "https://\(pathOnly)")
    }

    if pathOnly.contains("storage.googleapis.com") || pathOnly.contains("amazonaws.com") {
        if pathOnly.hasPrefix("http://") || pathOnly.hasPrefix("https://") {
            return URL(string: pathOnly)
        }
        return URL(string: "https://\(pathOnly)")
    }

    return nil
}

private func appendCacheBuster(_ candidate: String, value: String?) -> String {
    guard
        let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
        !value.isEmpty
    else {
        return candidate
    }

    let hasExistingVersion = candidate.contains("v=")
    if hasExistingVersion {
        return candidate
    }

    if candidate.contains("?") {
        return "\(candidate)&v=\(value)"
    }
    return "\(candidate)?v=\(value)"
}

private func absoluteBackendURL(path: String, backendRoot: String?) -> URL? {
    guard let backendRoot else { return nil }
    if path.hasPrefix("api/v1/files/") {
        return URL(string: "\(backendRoot)/\(path)")
    }
    return nil
}

private func absolutePath(_ path: String, backendRoot: String?) -> URL? {
    guard let backendRoot else { return nil }
    let normalized = path.hasPrefix("/") ? path : "/\(path)"
    return URL(string: "\(backendRoot)\(normalized)")
}

private func cdnURL(fromRelativePath path: String) -> URL? {
    let rawRoot = ProcessInfo.processInfo.environment["MOBILE_CDN_BASE_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines)
    let root = (rawRoot?.isEmpty == false ? rawRoot! : "https://cdn.codebase.blog")
    let normalizedRoot = trimmedSlash(root)
    let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
    return URL(string: "\(normalizedRoot)/\(normalizedPath)")
}

private func isBareAssetFile(_ candidate: String) -> Bool {
    let trimmed = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty || trimmed.contains("/") { return false }
    return trimmed.range(of: #"\.(jpg|jpeg|png|gif|webp|svg|avif|heic)$"#, options: .regularExpression) != nil
}

private func trimmedSlash(_ value: String) -> String {
    if value.hasSuffix("/") { return String(value.dropLast()) }
    return value
}

private func localCharacterAssetURL(from path: String) -> URL? {
    let normalizedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard normalizedPath.hasPrefix("character/") || normalizedPath.hasPrefix("/character/") else {
        return nil
    }

    let cleaned = normalizedPath.hasPrefix("/") ? String(normalizedPath.dropFirst()) : normalizedPath
    let components = cleaned.split(separator: "/")
    guard let filename = components.last else { return nil }

    let fileName = String(filename)
    let nsFileName = fileName as NSString
    let nameWithoutExtension = nsFileName.deletingPathExtension
    let ext = nsFileName.pathExtension
    guard !nameWithoutExtension.isEmpty, !ext.isEmpty else { return nil }

    let candidates: [Bundle] = [Bundle.main, Bundle.module] + Bundle.allBundles + Bundle.allFrameworks
    for bundle in candidates {
        if let url = resourceURL(
            in: bundle,
            named: nameWithoutExtension,
            ext: ext,
            subdirectory: "Character",
        ) {
            return url
        }
    }

    return nil
}

private func localSampleProfileAssetURL(from path: String) -> URL? {
    let normalizedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard normalizedPath.hasPrefix("user_images/") || normalizedPath.hasPrefix("/user_images/") else {
        return nil
    }

    let cleaned = normalizedPath.hasPrefix("/") ? String(normalizedPath.dropFirst()) : normalizedPath
    let components = cleaned.split(separator: "/")
    guard let filename = components.last else { return nil }

    let fileName = String(filename)
    let nsFileName = fileName as NSString
    let nameWithoutExtension = nsFileName.deletingPathExtension
    let ext = nsFileName.pathExtension
    guard !nameWithoutExtension.isEmpty, !ext.isEmpty else { return nil }

    let candidates: [Bundle] = [Bundle.main, Bundle.module] + Bundle.allBundles + Bundle.allFrameworks
    for bundle in candidates {
        if let url = resourceURL(
            in: bundle,
            named: nameWithoutExtension,
            ext: ext,
            subdirectory: "SampleProfiles",
        ) {
            return url
        }
    }

    return nil
}

private func backendRoot(from baseURL: URL) -> String {
    var root = baseURL.absoluteString
    if root.hasSuffix("/") {
        root.removeLast()
    }

    let marker = "/api/v1"
    if root.hasSuffix(marker) {
        root.removeLast(marker.count)
    } else if root.hasSuffix("\(marker)/") {
        root.removeLast((marker.count + 1))
    }
    return root
}

private func apiV1Root(from baseURL: URL) -> String {
    var root = baseURL.absoluteString
    if root.hasSuffix("/") {
        root.removeLast()
    }

    if root.hasSuffix("/api/v1") {
        return root
    }
    return "\(root)/api/v1"
}

private func resourceURL(
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
