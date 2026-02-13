# iOS App (SwiftUI)

This is the iOS implementation workspace. It starts with an architecture-first skeleton and SDD documentation.

## Current status

- Foundation scaffold created.
- SDD docs and mobile contracts linked.
- No external dependency on `backend` or `frontend` source.

## Commands

- SDD install: `npm install -g sdd-tool`
- 웹 자산 동기화: `./scripts/sync-web-assets.sh`
- SDD init from this directory: `sdd init --skip-git-setup --auto-approve`
- Create iOS specs:
  - `sdd new ios-architecture --all -d platform`
  - `sdd new ios-auth --all -d auth`
  - `sdd new ios-feed-navigation --all -d ui`
- Validate: `sdd validate --strict`
- Sync: `sdd sync --ci --threshold 80`

## Runbook

- Use `mobile/contracts` for API contracts only.
- Keep iOS source in `app/` and `features/` directories.
- 웹 자산을 iOS 리소스로 동기화하려면:
  - `./scripts/sync-web-assets.sh`
  - `mobile/ios/app/ios-app/Sources/MyBlogIOSApp/Resources/Auth` 및 `Resources/App` 아래로 반영됨.
- 실행/기능 검증은 백엔드가 먼저 기동된 상태에서 수행해야 실제 동작이 보장됩니다.
- 권장 백엔드 기동:
  - `pnpm --dir backend install` (필요 시)
  - `pnpm --dir backend start` 또는 `pnpm --dir backend start:dev`
  - `docker compose -f docker-compose.dev.yml up backend postgres redis`
- 권장 순서:
  1. 백엔드 실행 (`backend` 또는 `docker-compose.dev.yml`)
  2. 앱 빌드/런치
  3. 로그인(이메일/소셜), 피드, 댓글, 커뮤니티, 프로필/설정 화면 동작 확인
4. 소셜 로그인 실패 시 `앱 로그인`으로 수동 복귀 가이드를 노출합니다.

### 시뮬레이터 실행 체크리스트
- `backend` 기동 후 iOS 앱 실행을 시작해야 함.
- 현재 프로젝트는 앱 빌드 자체만으로는 UI가 나오지만, 로그인/피드/댓글/커뮤니티/설정 API 연동은 백엔드가 반드시 필요.
- 앱 번들 런타임 패키지 생성 + 설치 + 실행:
  - `cd /Users/sihyungpark/Desktop/code/my-blog-app/mobile/ios`
  - `MOBILE_IOS_BUNDLE_ID=kr.sihyung.MyBlogIOSApp ./scripts/run-simulator-flow.sh`

### 백엔드 없이 실행할 때
- 로그인/토큰/프로필/커뮤니티 동작은 실패하고 네트워크/권한 에러로 진입이 제한됩니다.
- 로그인 화면은 렌더링되며, 실제 시나리오 검증(세션 복구/글 목록/댓글/설정 저장)은 불가합니다.

### 권장 iOS 개발 실행 루틴
1. `backend` 실행 대기
2. `mobile/ios/scripts/sync-web-assets.sh`로 현재 웹 자산 동기화
3. iOS 앱 build
4. 로그인(이메일 또는 Google/GitHub) → 피드 진입 → 글쓰기/댓글/설정까지 시나리오 점검
5. 인증 만료/리로그인 경로 검증
6. `sdd status`, `sdd sync --ci --threshold 80` 수행

## 운영 UX 규칙

- iOS 화면은 웹 UI를 그대로 복제하지 않고 `NavigationStack + tab shell + native 제스처` 기준으로 최적화합니다.
- 로그인 실패 5회 누적, 401/토큰 만료, refresh 실패는 `LoginView`에서 즉시 사용자 안내 + 재로그인 버튼을 노출합니다.
- 프로필/커뮤니티/블로그 설정은 동일한 탭 안에서 stack으로 분리해 추후 Android 분리 시 모듈 이관이 쉬운 구조를 유지합니다.

## 실행 상태

- Simulator bootstrap and launch check currently uses:
  - iOS scheme: `MyBlogIOSApp`
  - Device (iOS 18.5): `AF9D69C4-9D68-4063-9B90-B72CBFED028E`
  - Command set: build → launch
  - Deep docs: `docs/sdd/ios-scalable-implementation-roadmap.md`

## 소셜 로그인 운영 메모

- 소셜 로그인은 현재 웹 라우트(`/auth/google`, `/auth/github`)로 이동합니다.
- 앱은 로그인 완료 후 `restoreSession` 복구가 되지 않으면 로그인 화면에서 다시 수동 로그인 절차를 안내합니다.
