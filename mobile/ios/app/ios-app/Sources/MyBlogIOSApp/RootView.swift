import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appStore: AppStore
    @State private var selectedTab: Int = 0
    @State private var showSessionExpiredToast = false
    @State private var toastDismissTask: Task<Void, Never>?

    var body: some View {
        ZStack(alignment: .top) {
            Group {
                if appStore.isBootstrapping {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("앱 초기화 중")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .accessibilityLabel("앱 초기화")
                } else if appStore.isAuthenticated {
                    MainTabShellView(selectedTab: $selectedTab)
                } else {
                    LoginView()
                        .padding()
                }
            }

            if showSessionExpiredToast {
                SessionToastView(text: "세션이 만료되어 로그인 화면으로 이동했습니다.")
                    .padding(.top, 12)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .task {
            await appStore.bootstrap()
            await appStore.restoreSession()
        }
        .onChange(of: appStore.requiresReauth) { _, requiresReauth in
            guard requiresReauth else { return }
            IOSRunTrace.emit(
                "auth.toast_shown",
                category: "auth",
                fields: ["source": "RootView", "reason": "requiresReauth"],
            )
            withAnimation(.easeOut(duration: 0.2)) {
                showSessionExpiredToast = true
            }
            scheduleToastDismiss()
        }
        .onChange(of: appStore.isAuthenticated) { _, isAuthenticated in
            IOSRunTrace.emit(
                "ui.auth_state",
                category: "auth",
                fields: ["authenticated": isAuthenticated ? "true" : "false"],
            )
            if isAuthenticated {
                IOSRunTrace.emit(
                    "ui.main_shown",
                    category: "ui",
                    fields: ["selected_tab": "0"],
                )
            } else {
                IOSRunTrace.emit(
                    "auth.login_shown",
                    category: "auth",
                    fields: ["source": "RootView"],
                )
            }
        }
        .alert(
            "오류",
            isPresented: errorAlertBinding,
        ) {
            Button("확인", role: .cancel) {
                appStore.authError = nil
            }
        } message: {
            Text(appStore.authError?.message ?? "오류가 발생했습니다.")
        }
        .onDisappear {
            toastDismissTask?.cancel()
            toastDismissTask = nil
        }
        .preferredColorScheme(appStore.preferredColorScheme)
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { !appStore.requiresReauth && appStore.authError != nil },
            set: { isPresented in
                if !isPresented {
                    appStore.authError = nil
                }
            },
        )
    }

    private func scheduleToastDismiss() {
        toastDismissTask?.cancel()
        toastDismissTask = Task {
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            guard !Task.isCancelled else { return }
            IOSRunTrace.emit(
                "auth.toast_dismissed",
                category: "auth",
                fields: ["source": "RootView"],
            )
            withAnimation(.easeIn(duration: 0.2)) {
                showSessionExpiredToast = false
            }
            appStore.clearAuthError()
            toastDismissTask = nil
        }
    }
}

private struct SessionToastView: View {
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.subheadline.weight(.semibold))
            Text(text)
                .font(.subheadline.weight(.semibold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(red: 0.78, green: 0.21, blue: 0.19))
        )
        .shadow(color: Color.black.opacity(0.32), radius: 8, x: 0, y: 4)
    }
}

private struct MainTabShellView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.colorScheme) private var colorScheme
    @Binding var selectedTab: Int

    private let tabs = [
        TabItem(title: "Home", icon: "house.fill"),
        TabItem(title: "Community", icon: "bubble.left.and.bubble.right"),
        TabItem(title: "Create", icon: "plus"),
        TabItem(title: "Profile", icon: "person"),
    ]

    var body: some View {
        Group {
            if selectedTab == 0 {
                FeedView()
            } else if selectedTab == 1 {
                CommunityLandingView()
            } else if selectedTab == 2 {
                PostComposeView {
                    selectedTab = 0
                }
            } else {
                ProfileHubView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(shellBackgroundColor)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                customTabBar
                    .padding(.horizontal, 14)
                    .padding(.top, 4)
                    .padding(.bottom, 6)

                Rectangle()
                    .fill(shellBackgroundColor)
                    .frame(height: 18)
            }
            .frame(maxWidth: .infinity)
            .background(shellBackgroundColor)
        }
        .overlay(alignment: .top) {
            GeometryReader { proxy in
                shellBackgroundColor
                    .frame(height: proxy.safeAreaInsets.top)
                    .frame(maxWidth: .infinity, alignment: .top)
                    .ignoresSafeArea(edges: .top)
            }
            .allowsHitTesting(false)
        }
        .task {
            await appStore.refreshCurrentUserProfile()
        }
        .environmentObject(appStore)
        .toolbar(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
    }

    private var customTabBar: some View {
        HStack(spacing: 6) {
            ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                tabButton(at: index, item: tab)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 11)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(tabBarBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(tabStrokeColor, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(colorScheme == .dark ? 0.34 : 0.18), radius: 14, x: 0, y: 7)
    }

    private func tabButton(at index: Int, item: TabItem) -> some View {
        let isCreate = index == 2
        let isSelected = selectedTab == index
        return Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.82)) {
                selectedTab = index
            }
        } label: {
            ZStack {
                if isCreate {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(createButtonBackground)
                        .frame(width: 58, height: 42)
                } else if isSelected {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(selectionBackground)
                        .frame(width: 52, height: 38)
                }

                Image(systemName: item.icon)
                    .font(.system(size: isCreate ? 20 : 19, weight: .semibold))
                    .foregroundStyle(isSelected ? selectedIconColor : unselectedIconColor)
            }
            .frame(maxWidth: .infinity, minHeight: 46)
            .animation(.spring(response: 0.3, dampingFraction: 0.75), value: selectedTab)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.title)
    }

    private var shellBackgroundColor: Color {
        colorScheme == .dark ? .black : Color(.systemGroupedBackground)
    }

    private var tabStrokeColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.11) : Color.black.opacity(0.08)
    }

    private var tabBarBackground: Color {
        colorScheme == .dark
            ? Color(red: 0.07, green: 0.09, blue: 0.13)
            : Color.white
    }

    private var selectionBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.12) : Color.black.opacity(0.08)
    }

    private var createButtonBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.13) : Color.black.opacity(0.12)
    }

    private var selectedIconColor: Color {
        colorScheme == .dark ? .white : .black.opacity(0.92)
    }

    private var unselectedIconColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.6) : Color.black.opacity(0.48)
    }
}

private struct TabItem {
    let title: String
    let icon: String
}
