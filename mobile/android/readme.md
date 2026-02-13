# Android Workspace (Kotlin)

Android implementation is now planned with SDD artifacts and Kotlin-first architecture guidance.

## Build bootstrap

- Root Gradle settings: `mobile/android/settings.gradle.kts`
- Root Gradle build: `mobile/android/build.gradle.kts`
- Root Gradle properties: `mobile/android/gradle.properties`
- App module build: `mobile/android/app/build.gradle.kts`

## Working rules

- Keep Android implementation in `mobile/android/**` only.
- Keep shared contracts in `mobile/contracts/**` only.
- If work needs changes in `mobile/ios/**`, `frontend/**`, or `backend/**`, stop immediately and request user approval first.

## SDD docs

- Master plan: `mobile/android/android-kotlin-sdd-plan.md`
- SDD guide: `mobile/android/.sdd/AGENTS.md`
- Architecture plan: `mobile/android/.sdd/specs/platform/android-architecture/plan.md`
- Architecture tasks: `mobile/android/.sdd/specs/platform/android-architecture/tasks.md`
- Auth plan: `mobile/android/.sdd/specs/auth/android-auth/plan.md`
- Auth tasks: `mobile/android/.sdd/specs/auth/android-auth/tasks.md`
- Feed/navigation plan: `mobile/android/.sdd/specs/ui/android-feed-navigation/plan.md`
- Feed/navigation tasks: `mobile/android/.sdd/specs/ui/android-feed-navigation/tasks.md`

## Phase 0 artifacts

- Workspace boundaries: `mobile/android/docs/workspace-boundaries.md`
- Branch and PR workflow: `mobile/android/docs/branching-and-pr.md`
- Kotlin implementation guide: `mobile/android/docs/kotlin-guidelines.md`
- Time rendering tests: `mobile/android/docs/time-rendering-test-cases.md`
- Architecture validation checklist: `mobile/android/docs/architecture-validation-checklist.md`
- Architecture smoke checklist: `mobile/android/docs/architecture-smoke-checklist.md`
- Compose token mapping: `mobile/android/docs/compose-theme-token-mapping.md`
- Feed navigation contracts: `mobile/android/docs/feed-navigation-contracts.md`
- Login/feed/settings architecture: `mobile/android/docs/login-feed-settings-architecture.md`
- Smithery review draft: `mobile/android/kotlin-expert-smithery-review.md`

## Phase 1 skeleton artifacts

- App skeleton overview: `mobile/android/app/README.md`
- Module boundaries: `mobile/android/docs/module-boundaries.md`
- App entry marker: `mobile/android/app/src/main/kotlin/com/myblog/android/app/AppEntry.kt`
- DI boundary marker: `mobile/android/app/src/main/kotlin/com/myblog/android/core/di/AppDi.kt`
- Default DI composition root: `mobile/android/app/src/main/kotlin/com/myblog/android/core/di/DefaultAppDi.kt`
- Navigation destination marker: `mobile/android/app/src/main/kotlin/com/myblog/android/core/navigation/AppDestination.kt`
- Bottom-tab route map: `mobile/android/app/src/main/kotlin/com/myblog/android/core/navigation/BottomTabRouteMap.kt`
- Theme tokens: `mobile/android/app/src/main/kotlin/com/myblog/android/core/ui/theme/AppThemeTokens.kt`
- App shell state model: `mobile/android/app/src/main/kotlin/com/myblog/android/app/model/AppShellState.kt`
- App shell state reducer: `mobile/android/app/src/main/kotlin/com/myblog/android/app/AppShellReducer.kt`
- App shell coordinator: `mobile/android/app/src/main/kotlin/com/myblog/android/app/AppShellCoordinator.kt`
- App bootstrap coordinator: `mobile/android/app/src/main/kotlin/com/myblog/android/app/AppBootstrapCoordinator.kt`
- App route coordinator: `mobile/android/app/src/main/kotlin/com/myblog/android/core/navigation/AppRouteCoordinator.kt`

## Phase 1.5 contract skeleton

- Network result contract: `mobile/android/app/src/main/kotlin/com/myblog/android/core/network/ApiResult.kt`
- HTTP transport contract: `mobile/android/app/src/main/kotlin/com/myblog/android/core/network/HttpTransport.kt`
- JDK HTTP transport implementation: `mobile/android/app/src/main/kotlin/com/myblog/android/core/network/JdkHttpTransport.kt`
- Authenticated request executor: `mobile/android/app/src/main/kotlin/com/myblog/android/core/network/AuthenticatedRequestExecutor.kt`
- Auth token store contract: `mobile/android/app/src/main/kotlin/com/myblog/android/core/auth/TokenStore.kt`
- In-memory token store: `mobile/android/app/src/main/kotlin/com/myblog/android/core/auth/InMemoryTokenStore.kt`
- Auth refresh coordinator contract: `mobile/android/app/src/main/kotlin/com/myblog/android/core/auth/RefreshCoordinator.kt`
- Single-flight refresh coordinator: `mobile/android/app/src/main/kotlin/com/myblog/android/core/auth/SingleFlightRefreshCoordinator.kt`
- Session restore contract: `mobile/android/app/src/main/kotlin/com/myblog/android/core/auth/SessionRestorer.kt`
- Auth repository contract: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/AuthRepository.kt`
- Auth refresh orchestration: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/AuthRefreshCoordinator.kt`
- Auth model set: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/model/AuthModels.kt`
- Auth state reducer: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/model/AuthStateMachine.kt`
- Auth session manager: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/AuthSessionManager.kt`
- Auth API DTO contract: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/network/AuthApi.kt`
- HTTP auth API implementation: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/network/HttpAuthApi.kt`
- Auth contract adapter: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/auth/network/MobileContractAuthRepository.kt`
- App DI factory for HTTP auth wiring: `mobile/android/app/src/main/kotlin/com/myblog/android/core/di/AppDiFactory.kt`
- Feed repository contract: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/FeedRepository.kt`
- HTTP feed repository implementation: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/network/HttpFeedRepository.kt`
- Feed use-case contracts: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/FeedUseCases.kt`
- Feed model set: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/model/FeedModels.kt`
- Feed state reducer: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/model/FeedStateMachine.kt`
- Pagination policy: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/PaginationPolicy.kt`
- Feed action handlers: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/FeedActionHandlers.kt`
- Feed timeline coordinator: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/FeedTimelineCoordinator.kt`
- Settings repository contract: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/settings/SettingsRepository.kt`
- HTTP settings repository implementation: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/settings/network/HttpSettingsRepository.kt`
- In-memory settings repository fallback: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/settings/InMemorySettingsRepository.kt`
- Settings model set: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/settings/model/SettingsModels.kt`
- Settings state: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/settings/model/SettingsState.kt`
- Settings coordinator: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/settings/SettingsCoordinator.kt`
- Clock abstraction: `mobile/android/app/src/main/kotlin/com/myblog/android/core/time/ClockProvider.kt`
- Relative-time formatter: `mobile/android/app/src/main/kotlin/com/myblog/android/feature/feed/time/RelativeTimeFormatter.kt`

## Auth verification artifacts

- Auth session manager tests: `mobile/android/app/src/test/kotlin/com/myblog/android/feature/auth/AuthSessionManagerTest.kt`
- Single-flight refresh tests: `mobile/android/app/src/test/kotlin/com/myblog/android/core/auth/SingleFlightRefreshCoordinatorTest.kt`
- Auth refresh coordinator tests: `mobile/android/app/src/test/kotlin/com/myblog/android/feature/auth/AuthRefreshCoordinatorTest.kt`
- Auth API adapter tests: `mobile/android/app/src/test/kotlin/com/myblog/android/feature/auth/network/MobileContractAuthRepositoryTest.kt`
- HTTP auth API tests: `mobile/android/app/src/test/kotlin/com/myblog/android/feature/auth/network/HttpAuthApiTest.kt`
- Authenticated request executor tests: `mobile/android/app/src/test/kotlin/com/myblog/android/core/network/AuthenticatedRequestExecutorTest.kt`
- Default DI composition tests: `mobile/android/app/src/test/kotlin/com/myblog/android/core/di/DefaultAppDiTest.kt`
- HTTP DI factory tests: `mobile/android/app/src/test/kotlin/com/myblog/android/core/di/AppDiFactoryTest.kt`
- HTTP feed repository tests: `mobile/android/app/src/test/kotlin/com/myblog/android/feature/feed/network/HttpFeedRepositoryTest.kt`
- HTTP settings repository tests: `mobile/android/app/src/test/kotlin/com/myblog/android/feature/settings/network/HttpSettingsRepositoryTest.kt`
- Auth API contract mapping doc: `mobile/android/docs/auth-api-contract-mapping.md`

## Current network integration status

- Auth, feed, and settings are wired through HTTP-backed repositories via `AppDiFactory`.
- Feed requests run through `AuthenticatedRequestExecutor` and support 401 refresh + retry.
- Settings requests run through `AuthenticatedRequestExecutor` and support 401 refresh + retry.
- `InMemorySettingsRepository` is kept as fallback/override for local testing and offline-first stubs.

## Known cross-platform lesson

- iOS에서 확인된 상대시간(분 단위) 렌더 오차 이슈를 반영해 Android도 단일 clock source 기반 상대시간 계산 규칙을 적용한다.
- 관련 규칙: `mobile/android/docs/kotlin-guidelines.md`의 "Time rendering consistency" 섹션.

## Branching

- Recommended feature branch: `feature/kotlin`
- Keep Android PRs isolated from iOS/web workstreams.

## Kotlin guide source

- Requested command attempted: `npx @smithery/cli skills install vitorpamplona/kotlin-expert`
- Current outcome: install endpoint did not expose a valid skills index.
- Usable fallback: `npx @smithery/cli skills view vitorpamplona/kotlin-expert`
- Apply the viewed guidance as implementation baseline (StateFlow/SharedFlow, sealed hierarchies, immutable UI models, inline/reified patterns).
- Smithery CLI skill install verified:
  - `npx @smithery/cli skills install smithery-ai/cli --agent codex`
  - `npx @smithery/cli skills install smithery-ai/cli --agent opencode`
