import SwiftUI
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
    @Environment(\.colorScheme) private var colorScheme
    @State private var email = ""
    @State private var password = ""
    @State private var socialError: String?
    @State private var emailValidationError: String?
    @State private var passwordValidationError: String?
    @State private var isPasswordVisible = false
    @State private var isLoggingIn = false
    @State private var loginAttempts = 0
    private let maxLoginAttempts = 5

    var body: some View {
        let isAuthenticating = appStore.isBusy || isLoggingIn

        ZStack {
            LoginBackground()

            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 12) {
                        BrandResourceImage(
                            resource: colorScheme == .dark ? "block-logo-dark" : "block-logo",
                            ext: "png",
                            subdirectory: "App",
                            width: 58,
                            height: 58,
                        )

                        Text("다시 만나서 반가워요")
                            .font(.system(size: 31, weight: .bold, design: .rounded))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.center)

                        Text("계정으로 로그인하세요")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)

                        Text("웹 계정과 동일한 정책으로 바로 연결됩니다")
                            .font(.caption)
                            .foregroundStyle(.secondary)
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

                    LoginCard {
                        VStack(spacing: 14) {
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
                                            .tint(.white)
                                    } else {
                                        Image(systemName: "arrow.right.circle.fill")
                                        Text("이메일로 로그인")
                                            .fontWeight(.semibold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .foregroundStyle(.white)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(
                                            LinearGradient(
                                                colors: [Color(red: 0.14, green: 0.42, blue: 1.00), Color(red: 0.46, green: 0.35, blue: 1.0)],
                                                startPoint: .leading,
                                                endPoint: .trailing,
                                            )
                                        )
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(Color.white.opacity(0.35), lineWidth: 1)
                                )
                                .shadow(color: Color.blue.opacity(0.28), radius: 12, y: 6)
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
                        }

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

                        Divider()
                            .overlay(.secondary)
                            .padding(.vertical, 8)

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

                        Text("소셜 로그인은 웹 인증 후 앱으로 이동해 주세요.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .lineLimit(nil)
                            .padding(.top, 10)
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
        guard let base = appStore.socialLoginURL(for: .google) else {
            return nil
        }
        return base.deletingLastPathComponent().appendingPathComponent("register")
    }

    private var forgotPasswordURL: URL? {
        guard let base = appStore.socialLoginURL(for: .google) else {
            return nil
        }
        return base.deletingLastPathComponent().appendingPathComponent("forgot-password")
    }

    private func openSocialLogin(_ provider: SocialProvider) {
        guard let url = appStore.socialLoginURL(for: provider) else {
            socialError = "\(provider.label) 로그인 경로를 불러올 수 없습니다."
            return
        }
        appStore.clearAuthError()
        socialError = nil
        openURL(url)
        socialError = "\(provider.label) 로그인 페이지를 열었습니다. 완료 후 앱으로 돌아와 주세요."
    }
}

private struct LoginBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { proxy in
            let base = LinearGradient(
                colors: [
                    colorScheme == .dark ? Color(red: 0.06, green: 0.08, blue: 0.14) : Color(red: 0.95, green: 0.97, blue: 1.0),
                    colorScheme == .dark ? Color(red: 0.08, green: 0.11, blue: 0.19) : Color(red: 0.87, green: 0.9, blue: 1.0),
                    colorScheme == .dark ? Color(red: 0.03, green: 0.04, blue: 0.08) : Color.white,
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing,
            )

            base
                .ignoresSafeArea()
                .overlay(
                    LinearGradient(
                        colors: [
                            colorScheme == .dark ? Color.white.opacity(0.05) : Color.white.opacity(0.5),
                            Color.clear,
                        ],
                        startPoint: .top,
                        endPoint: .bottom,
                    )
                )
                .overlay(
                    Circle()
                        .fill(Color.blue.opacity(colorScheme == .dark ? 0.22 : 0.16))
                        .frame(width: max(proxy.size.width, proxy.size.height) * 0.62)
                        .blur(radius: 2)
                        .offset(x: -proxy.size.width * 0.25, y: -proxy.size.height * 0.2),
                    alignment: .topLeading,
                )
                .overlay(
                    Circle()
                        .fill(Color.purple.opacity(colorScheme == .dark ? 0.22 : 0.16))
                        .frame(width: max(proxy.size.width, proxy.size.height) * 0.58)
                        .blur(radius: 1)
                        .offset(x: proxy.size.width * 0.25, y: proxy.size.height * 0.35),
                    alignment: .topLeading,
                )
                .overlay(
                    Circle()
                        .fill(Color.indigo.opacity(colorScheme == .dark ? 0.2 : 0.12))
                        .frame(width: max(proxy.size.width, proxy.size.height) * 0.5)
                        .blur(radius: 1)
                        .offset(x: proxy.size.width * 0.4, y: -proxy.size.height * 0.35),
                    alignment: .topLeading,
                )
        }
    }
}

private struct LoginCard<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            content
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: colorScheme == .dark
                            ? [Color.white.opacity(0.12), Color.white.opacity(0.06)]
                            : [Color.white.opacity(0.7), Color.white.opacity(0.4)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing,
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: colorScheme == .dark
                                    ? [Color.white.opacity(0.28), Color.white.opacity(0.08)]
                                    : [Color.white.opacity(0.7), Color.white.opacity(0.2)],
                                startPoint: .top,
                                endPoint: .bottom,
                            ),
                            lineWidth: 1,
                        ),
                )
                .shadow(color: Color.black.opacity(colorScheme == .dark ? 0.25 : 0.08), radius: 12, y: 8)
        )
    }
}

private struct LoginInputField: View {
    @Environment(\.colorScheme) private var colorScheme
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
                .foregroundStyle(colorScheme == .dark ? Color.white : Color.primary)
                .disabled(!isEnabled)
                .padding(14)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(colorScheme == .dark ? Color.white.opacity(0.10) : Color(uiColor: .systemBackground).opacity(0.92))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(
                            validationMessage == nil
                                ? (colorScheme == .dark ? Color.white.opacity(0.2) : Color.secondary.opacity(0.18))
                                : Color.red.opacity(0.7),
                            lineWidth: 0.8
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
    @Environment(\.colorScheme) private var colorScheme
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
                        .foregroundStyle(colorScheme == .dark ? Color.white : Color.primary)
                        .disabled(!isEnabled)
                } else {
                    SecureField(placeholder, text: $text)
                        .textInputAutocapitalization(.never)
                        .textContentType(.password)
                        .autocorrectionDisabled()
                        .foregroundStyle(colorScheme == .dark ? Color.white : Color.primary)
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
            .padding(14)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(colorScheme == .dark ? Color.white.opacity(0.10) : Color(uiColor: .systemBackground).opacity(0.92))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(
                            validationMessage == nil
                                ? (colorScheme == .dark ? Color.white.opacity(0.2) : Color.secondary.opacity(0.18))
                                : Color.red.opacity(0.7),
                            lineWidth: 0.8
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
    @Environment(\.colorScheme) private var colorScheme
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
                    .foregroundStyle(colorScheme == .dark ? Color.white : Color.primary)
                Spacer()
            }
            .padding(.horizontal, 14)
            .frame(height: 46)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: colorScheme == .dark
                                ? [Color.white.opacity(0.12), Color.white.opacity(0.07)]
                                : [Color.white.opacity(0.98), Color.white.opacity(0.88)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing,
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: colorScheme == .dark
                                ? [Color.white.opacity(0.2), Color.white.opacity(0.06)]
                                : [Color.gray.opacity(0.25), Color.gray.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing,
                        ),
                        lineWidth: 1,
                    )
            )
            .shadow(color: Color.black.opacity(colorScheme == .dark ? 0.2 : 0.06), radius: 8, y: 3)
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
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        switch provider {
        case .google:
            BrandResourceImage(
                resource: colorScheme == .dark ? "google_dark" : "google_light",
                ext: "png",
                subdirectory: "Auth",
                width: 20,
                height: 20,
                fallbackSystemName: "globe",
            )
        case .github:
            BrandResourceImage(
                resource: colorScheme == .dark ? "GitHub_Logo_White" : "GitHub_Logo",
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
    enum Style {
        case error
        case success
        case warning

        var tint: Color {
            switch self {
            case .error:
                return .red
            case .success:
                return .green
            case .warning:
                return .orange
            }
        }
    }

    let text: String
    let style: Style

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle")
            Text(text)
                .font(.footnote)
                .lineLimit(nil)
        }
        .foregroundStyle(style.tint)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(style.tint.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
    }
}
