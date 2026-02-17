import SwiftUI
#if canImport(AuthenticationServices)
import AuthenticationServices
#endif
#if canImport(UIKit)
import UIKit
private typealias LoginPlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
private typealias LoginPlatformImage = NSImage
#endif

struct LoginView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.openURL) private var openURL
    @StateObject private var socialAuthCoordinator = SocialAuthCoordinator()
    @State private var email = ""
    @State private var password = ""
    @State private var socialError: String?
    @State private var emailValidationError: String?
    @State private var passwordValidationError: String?
    @State private var isPasswordVisible = false
    @State private var isLoggingIn = false
    @State private var isSocialAuthenticating = false
    @State private var loginAttempts = 0
    private let maxLoginAttempts = 5

    var body: some View {
        let isAuthenticating = appStore.isBusy || isLoggingIn || isSocialAuthenticating

        ZStack {
            LoginBackground()

            ScrollView {
                VStack(spacing: 20) {
                    VStack(spacing: 12) {
                        BrandResourceImage(
                            resource: "block-logo-clean",
                            ext: "png",
                            subdirectory: "App",
                            width: 62,
                            height: 62,
                        )

                        Text("Codebase")
                            .font(.system(size: 29, weight: .semibold, design: .default))
                            .tracking(-0.3)
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.center)

                        Text("국내 최대 AI 커뮤니티 & 블로그 자동화")
                            .font(.system(size: 15, weight: .regular, design: .default))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    if let socialError {
                        MessageBanner(text: socialError, style: .warning)
                    }

                    if isAuthenticating {
                        MessageBanner(text: "로그인 요청 처리중입니다.", style: .warning)
                    }

                    if let emailValidationError {
                        MessageBanner(text: emailValidationError, style: .warning)
                    }

                    if let passwordValidationError {
                        MessageBanner(text: passwordValidationError, style: .warning)
                    }

                    if appStore.requiresReauth {
                        MessageBanner(
                            text: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
                            style: .warning,
                        )
                    }

                    if let error = appStore.authError {
                        MessageBanner(text: error.message, style: .error)
                    }

                    if let message = appStore.authMessage {
                        MessageBanner(text: message, style: .success)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        LoginInputField(
                            title: "이메일",
                            placeholder: "name@example.com",
                            text: $email,
                            keyboardType: .emailAddress,
                            contentType: .emailAddress,
                            validationMessage: emailValidationError,
                            isEnabled: true
                        )

                        LoginSecureInputField(
                            title: "비밀번호",
                            placeholder: "비밀번호",
                            text: $password,
                            isVisible: $isPasswordVisible,
                            validationMessage: passwordValidationError,
                            isEnabled: true
                        )

                        Button {
                            Task {
                                await submitLogin()
                            }
                        } label: {
                            HStack(spacing: 10) {
                                if isAuthenticating {
                                    ProgressView()
                                        .tint(.black.opacity(0.85))
                                } else {
                                    Image(systemName: "envelope")
                                    Text("이메일로 로그인하기")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .foregroundStyle(Color.black.opacity(0.9))
                            .background(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(Color.white.opacity(0.95))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(Color.white.opacity(0.3), lineWidth: 1)
                            )
                            .shadow(color: Color.black.opacity(0.18), radius: 10, y: 4)
                        }
                        .buttonStyle(.plain)
                        .disabled(
                            isAuthenticating
                            || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            || password.isEmpty
                            || loginAttempts >= maxLoginAttempts
                        )
                        .accessibilityHint(isAuthenticating ? "로그인 처리 중" : "로그인 실행")
                        .accessibilityLabel("로그인 제출")

                        if loginAttempts > 0 {
                            Text("로그인 실패 횟수: \(loginAttempts)/\(maxLoginAttempts)")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        HStack {
                            Spacer()
                            ForgotLinkButton(url: forgotPasswordURL, label: "비밀번호를 잊으셨나요?")
                        }

                        SectionDivider(label: "또는")
                            .padding(.vertical, 4)

                        VStack(spacing: 12) {
                            ForEach(SocialProvider.allCases) { provider in
                                SocialLoginButton(style: SocialLoginButtonStyle(
                                    label: "\(provider.label) 계정으로 계속하기",
                                    provider: provider,
                                    isDisabled: appStore.isBusy || isLoggingIn || loginAttempts >= maxLoginAttempts,
                                    action: { openSocialLogin(provider) }
                                ))
                            }
                        }

                    }

                    HStack(spacing: 8) {
                        Text("계정이 없으신가요?")
                            .foregroundStyle(.secondary)
                            .font(.footnote)

                        RegisterButton(url: registerURL, label: "회원가입")
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 32)
                .frame(maxWidth: 460)
                .frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .onAppear {
            if !appStore.requiresReauth {
                appStore.authError = nil
            }
            socialError = nil
            emailValidationError = nil
            passwordValidationError = nil
        }
        .onDisappear {
            socialAuthCoordinator.cancel()
        }
    }

    private func validateLoginInput(email: String, password: String) -> String? {
        if email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            emailValidationError = "이메일을 입력해 주세요."
            return "이메일을 입력해 주세요."
        }

        if !isValidEmail(email) {
            emailValidationError = "올바른 이메일 형식이 아닙니다."
            return "올바른 이메일 형식이 아닙니다."
        }

        if password.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            passwordValidationError = "비밀번호를 입력해 주세요."
            return "비밀번호를 입력해 주세요."
        }

        if password.count < 8 {
            passwordValidationError = "비밀번호는 8자 이상으로 입력해 주세요."
            return "비밀번호는 8자 이상으로 입력해 주세요."
        }

        emailValidationError = nil
        passwordValidationError = nil
        return nil
    }

    @MainActor
    private func submitLogin() async {
        guard loginAttempts < maxLoginAttempts else {
            socialError = "로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요."
            return
        }

        let normalizedEmail = email
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let normalizedPassword = password

        if let validation = validateLoginInput(email: normalizedEmail, password: normalizedPassword) {
            socialError = validation
            return
        }

        socialError = nil
        emailValidationError = nil
        passwordValidationError = nil
        isLoggingIn = true
        defer { isLoggingIn = false }

        await appStore.login(email: normalizedEmail, password: normalizedPassword)

        if appStore.authError == nil {
            loginAttempts = 0
            return
        }

        if appStore.authError?.type == .unauthorized || appStore.authError?.status == 401 {
            loginAttempts += 1
            socialError = "로그인에 실패했습니다. (\(loginAttempts)/\(maxLoginAttempts))"
        }
        password = ""
    }

    private func isValidEmail(_ value: String) -> Bool {
        let pattern = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        let predicate = NSPredicate(format: "SELF MATCHES %@", pattern)
        return predicate.evaluate(with: value)
    }

    private var registerURL: URL? {
        appStore.frontendBaseURL?.appendingPathComponent("register")
    }

    private var forgotPasswordURL: URL? {
        appStore.frontendBaseURL?.appendingPathComponent("forgot-password")
    }

    private func openSocialLogin(_ provider: SocialProvider) {
        guard let url = appStore.socialLoginURL(for: provider) else {
            socialError = "\(provider.label) 로그인 경로를 불러올 수 없습니다."
            return
        }
        guard let callbackScheme = appStore.socialAuthCallbackScheme, !callbackScheme.isEmpty else {
            socialError = "소셜 로그인 콜백 설정이 누락되었습니다."
            return
        }
        appStore.clearAuthError()
        socialError = nil
        isSocialAuthenticating = true

        socialAuthCoordinator.start(
            url: url,
            callbackScheme: callbackScheme,
            onCallback: { callbackURL in
                Task { @MainActor in
                    await appStore.handleIncomingURL(callbackURL)
                    isSocialAuthenticating = false
                }
            },
            onCancel: {
                isSocialAuthenticating = false
            },
            onFailure: { message in
                socialError = message
                isSocialAuthenticating = false
            }
        )
    }
}

#if canImport(AuthenticationServices)
@MainActor
private final class SocialAuthCoordinator: NSObject, ObservableObject {
    private var session: ASWebAuthenticationSession?
    private lazy var presentationContextProvider = SocialAuthPresentationContextProvider()

    func start(
        url: URL,
        callbackScheme: String,
        onCallback: @escaping (URL) -> Void,
        onCancel: @escaping () -> Void,
        onFailure: @escaping (String) -> Void
    ) {
        cancel()

        let authSession = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: callbackScheme
        ) { [weak self] callbackURL, error in
            Task { @MainActor in
                self?.session = nil

                if let callbackURL {
                    onCallback(callbackURL)
                    return
                }

                if let authError = error as? ASWebAuthenticationSessionError,
                   authError.code == .canceledLogin {
                    onCancel()
                    return
                }

                onFailure(error?.localizedDescription ?? "소셜 로그인 인증을 완료하지 못했습니다.")
            }
        }

        authSession.prefersEphemeralWebBrowserSession = true
        authSession.presentationContextProvider = presentationContextProvider
        session = authSession

        if !authSession.start() {
            session = nil
            onFailure("소셜 로그인 세션을 시작하지 못했습니다.")
        }
    }

    func cancel() {
        session?.cancel()
        session = nil
    }
}

#if canImport(UIKit)
private final class SocialAuthPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
#elseif canImport(AppKit)
private final class SocialAuthPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApplication.shared.keyWindow ?? ASPresentationAnchor()
    }
}
#endif
#else
@MainActor
private final class SocialAuthCoordinator: ObservableObject {
    func start(
        url: URL,
        callbackScheme: String,
        onCallback: @escaping (URL) -> Void,
        onCancel: @escaping () -> Void,
        onFailure: @escaping (String) -> Void
    ) {
        onFailure("이 플랫폼에서는 소셜 로그인 세션을 지원하지 않습니다.")
    }

    func cancel() {}
}
#endif

private struct LoginBackground: View {
    var body: some View {
        GeometryReader { proxy in
            let baseGradient = LinearGradient(
                colors: [
                    Color(red: 0.04, green: 0.05, blue: 0.08),
                    Color(red: 0.06, green: 0.08, blue: 0.12),
                    Color(red: 0.03, green: 0.04, blue: 0.06),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing,
            )

            baseGradient
                .ignoresSafeArea()
                .overlay(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.04),
                            Color.clear,
                        ],
                        startPoint: .top,
                        endPoint: .bottom,
                    )
                )
                .overlay(
                    Circle()
                        .fill(Color(red: 0.0, green: 0.72, blue: 0.84).opacity(0.16))
                        .frame(width: max(proxy.size.width, proxy.size.height) * 0.56)
                        .blur(radius: 14)
                        .offset(x: -proxy.size.width * 0.25, y: -proxy.size.height * 0.2),
                    alignment: .topLeading,
                )
                .overlay(
                    Circle()
                        .fill(Color(red: 0.01, green: 0.63, blue: 0.86).opacity(0.11))
                        .frame(width: max(proxy.size.width, proxy.size.height) * 0.52)
                        .blur(radius: 18)
                        .offset(x: proxy.size.width * 0.25, y: proxy.size.height * 0.35),
                    alignment: .topLeading,
                )
        }
    }
}

private struct LoginInputField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var contentType: UITextContentType? = nil
    var validationMessage: String? = nil
    var isEnabled: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.footnote)
                .foregroundStyle(.secondary)

            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .keyboardType(keyboardType)
                .textContentType(contentType)
                .autocorrectionDisabled()
                .foregroundStyle(Color.white.opacity(0.96))
                .disabled(!isEnabled)
                .padding(.horizontal, 14)
                .frame(height: 50)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.white.opacity(0.1))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            validationMessage == nil
                                ? Color.white.opacity(0.18)
                                : Color.red.opacity(0.7),
                            lineWidth: 1
                        ),
                )
                .onChange(of: text) {
                    let normalized = text.lowercased()
                    if text != normalized {
                        text = normalized
                    }
                }
        }
    }
}

private struct LoginSecureInputField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    @Binding var isVisible: Bool
    var validationMessage: String? = nil
    var isEnabled: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.footnote)
                .foregroundStyle(.secondary)

            HStack(spacing: 10) {
                if isVisible {
                    TextField(placeholder, text: $text)
                        .textInputAutocapitalization(.never)
                        .textContentType(.password)
                        .autocorrectionDisabled()
                        .foregroundStyle(Color.white.opacity(0.96))
                        .disabled(!isEnabled)
                } else {
                    SecureField(placeholder, text: $text)
                        .textInputAutocapitalization(.never)
                        .textContentType(.password)
                        .autocorrectionDisabled()
                        .foregroundStyle(Color.white.opacity(0.96))
                        .disabled(!isEnabled)
                }

                Button {
                    isVisible.toggle()
                } label: {
                    Image(systemName: isVisible ? "eye.slash" : "eye")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)
            .frame(height: 50)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.white.opacity(0.1))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            validationMessage == nil
                                ? Color.white.opacity(0.18)
                                : Color.red.opacity(0.7),
                            lineWidth: 1
                        ),
                )
        }
    }
}

private struct SocialLoginButtonStyle {
    let label: String
    let provider: SocialProvider
    let isDisabled: Bool
    let action: () -> Void

    var icon: some View {
        Group {
            switch provider {
            case .google:
                SocialBrandMark(provider: .google)
            case .github:
                SocialBrandMark(provider: .github)
            }
        }
    }
}

private struct SocialLoginButton: View {
    let style: SocialLoginButtonStyle

    var body: some View {
        Button {
            if !style.isDisabled {
                style.action()
            }
        } label: {
            HStack(spacing: 10) {
                style.icon
                    .frame(width: 22, height: 22)
                Spacer()
                Text(style.label)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.white.opacity(0.95))
                Spacer()
            }
            .padding(.horizontal, 14)
            .frame(height: 50)
            .background(
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(Color.white.opacity(0.11))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.2), radius: 6, y: 2)
            .opacity(style.isDisabled ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(style.isDisabled)
    }
}

private struct ForgotLinkButton: View {
    let url: URL?
    let label: String

    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            if let url {
                openURL(url)
            }
        } label: {
            Text(label)
                .font(.footnote)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.blue)
        .disabled(url == nil)
    }
}

private struct RegisterButton: View {
    let url: URL?
    let label: String

    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            if let url {
                openURL(url)
            }
        } label: {
            Text(label)
                .font(.footnote)
                .fontWeight(.semibold)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.blue)
        .disabled(url == nil)
    }
}

private struct BrandResourceImage: View {
    let resource: String
    let ext: String
    let subdirectory: String
    let width: CGFloat
    let height: CGFloat
    var fallbackSystemName: String = "photo"

    var body: some View {
        Group {
            if let image = AppResourceImageLoader.image(
                named: resource,
                ext: ext,
                subdirectory: subdirectory,
            ) {
                platformImageView(image)
            } else {
                Image(systemName: fallbackSystemName)
                    .resizable()
                    .scaledToFit()
                    .frame(width: width, height: height)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func platformImageView(_ image: LoginPlatformImage) -> some View {
        #if canImport(UIKit)
        Image(uiImage: image)
            .resizable()
            .scaledToFit()
            .frame(width: width, height: height)
        #elseif canImport(AppKit)
        Image(nsImage: image)
            .resizable()
            .scaledToFit()
            .frame(width: width, height: height)
        #endif
    }
}

private struct SocialBrandMark: View {
    let provider: SocialProvider

    var body: some View {
        switch provider {
        case .google:
            BrandResourceImage(
                resource: "google_g",
                ext: "png",
                subdirectory: "Auth",
                width: 20,
                height: 20,
                fallbackSystemName: "globe",
            )
        case .github:
            BrandResourceImage(
                resource: "github_flat_white",
                ext: "png",
                subdirectory: "Auth",
                width: 20,
                height: 20,
                fallbackSystemName: "cat",
            )
        }
    }
}

private struct SectionDivider: View {
    let label: String

    var body: some View {
        HStack(spacing: 10) {
            Rectangle()
                .fill(Color.secondary.opacity(0.3))
                .frame(height: 1)
                .frame(maxWidth: .infinity)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Rectangle()
                .fill(Color.secondary.opacity(0.3))
                .frame(height: 1)
                .frame(maxWidth: .infinity)
        }
    }
}

private enum AppResourceImageLoader {
    static func image(named: String, ext: String, subdirectory: String) -> LoginPlatformImage? {
        var bundleCandidates: [Bundle] = [Bundle.main]
        if let moduleBundle = Self.moduleResourceBundle {
            bundleCandidates.append(moduleBundle)
        }
        bundleCandidates += Bundle.allBundles
        bundleCandidates += Bundle.allFrameworks

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

    private static var moduleResourceBundle: Bundle? {
        let candidateBundleNames = [
            "MyBlogIOSApp_MyBlogIOSApp",
            "MyBlogIOSApp",
            "Bundle",
        ]

        for name in candidateBundleNames {
            if let path = Bundle.main.path(forResource: name, ofType: "bundle"),
               let bundle = Bundle(path: path) {
                return bundle
            }
        }
        return nil
    }
}

private struct MessageBanner: View {
    @Environment(\.colorScheme) private var colorScheme

    enum Style {
        case error
        case success
        case warning

        var iconName: String {
            switch self {
            case .error:
                return "xmark.circle.fill"
            case .success:
                return "checkmark.circle.fill"
            case .warning:
                return "exclamationmark.triangle.fill"
            }
        }

        var tint: Color {
            switch self {
            case .error:
                return Color(red: 0.84, green: 0.24, blue: 0.21)
            case .success:
                return Color(red: 0.09, green: 0.49, blue: 0.93)
            case .warning:
                return Color(red: 0.89, green: 0.53, blue: 0.0)
            }
        }
    }

    let text: String
    let style: Style

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: style.iconName)
                .font(.subheadline)
                .foregroundStyle(style.tint)
                .frame(width: 22, height: 22)
                .background(
                    Circle()
                        .fill(style.tint.opacity(colorScheme == .dark ? 0.2 : 0.14))
                )

            Text(text)
                .font(.footnote)
                .lineLimit(nil)
                .foregroundStyle(colorScheme == .dark ? Color.white.opacity(0.92) : Color.black.opacity(0.8))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            style.tint.opacity(colorScheme == .dark ? 0.2 : 0.12),
                            colorScheme == .dark ? Color.white.opacity(0.07) : Color.white.opacity(0.9),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing,
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(style.tint.opacity(colorScheme == .dark ? 0.45 : 0.3), lineWidth: 1)
        )
    }
}
