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
    @State private var isBottomChromeVisible = true

    private let tabs = [
        TabItem(title: "Home", icon: "house.fill", destination: 0),
        TabItem(title: "Community", icon: "bubble.left.and.bubble.right", destination: 1),
        TabItem(title: "Compose", icon: "plus", destination: 2),
        TabItem(title: "Profile", icon: "person", destination: 3),
    ]

    var body: some View {
        Group {
            if selectedTab == 0 {
                FeedView { direction in
                    switch direction {
                    case .down:
                        guard isBottomChromeVisible else { return }
                        withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                            isBottomChromeVisible = false
                        }
                    case .up:
                        guard !isBottomChromeVisible else { return }
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.84)) {
                            isBottomChromeVisible = true
                        }
                    }
                }
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
            Color.clear
                .frame(height: selectedTab != 2 && isBottomChromeVisible ? 56 : 0)
        }
        .overlay(alignment: .bottom) {
            bottomChrome
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
        .onChange(of: selectedTab) { _, tab in
            if tab == 2 {
                isBottomChromeVisible = false
            } else {
                withAnimation(.easeOut(duration: 0.16)) {
                    isBottomChromeVisible = true
                }
            }
        }
    }

    private var bottomChrome: some View {
        GeometryReader { proxy in
            let bottomInset = proxy.safeAreaInsets.bottom

            ZStack(alignment: .bottomTrailing) {
                if selectedTab != 2, isBottomChromeVisible {
                    VStack(spacing: 0) {
                        HStack(spacing: 2) {
                            ForEach(tabs, id: \.destination) { tab in
                                tabButton(item: tab)
                            }
                        }
                        .padding(.horizontal, 18)
                        .frame(height: 56)
                        .background(shellBackgroundColor.opacity(0.98))

                        if bottomInset > 0 {
                            shellBackgroundColor
                                .frame(height: bottomInset)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .bottom)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                if selectedTab != 2, !isBottomChromeVisible {
                    Button {
                        withAnimation(.spring(response: 0.26, dampingFraction: 0.84)) {
                            selectedTab = 2
                        }
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(selectedIconColor)
                            .frame(width: 56, height: 56)
                            .background(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(createButtonBackground)
                            )
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.trailing, 20)
                    .padding(.bottom, max(bottomInset, 8) + 8)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .animation(.easeOut(duration: 0.12), value: isBottomChromeVisible)
            .ignoresSafeArea(edges: .bottom)
            .allowsHitTesting(selectedTab != 2)
        }
        .allowsHitTesting(selectedTab != 2)
    }

    private func tabButton(item: TabItem) -> some View {
        let isSelected = selectedTab == item.destination
        return Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.82)) {
                selectedTab = item.destination
            }
        } label: {
            Group {
                if item.destination == 2 {
                    Image(systemName: "plus")
                        .font(.system(size: 21, weight: .semibold))
                        .foregroundStyle(isSelected ? selectedIconColor : unselectedIconColor)
                        .frame(width: 48, height: 48)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(createButtonBackground)
                        )
                        .frame(maxWidth: .infinity, minHeight: 50)
                } else {
                    ZStack {
                        if isSelected {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(selectionBackground)
                                .frame(width: 54, height: 40)
                        }

                        Image(systemName: item.icon)
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(isSelected ? selectedIconColor : unselectedIconColor)
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.75), value: selectedTab)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.title)
    }

    private var shellBackgroundColor: Color {
        colorScheme == .dark ? .black : Color(.systemGroupedBackground)
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
    let destination: Int
}
