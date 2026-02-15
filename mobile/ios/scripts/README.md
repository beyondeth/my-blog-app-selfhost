# iOS Scripts

- `setup-sdd.sh`: install and initialize SDD workspace.
- `generate-contract-summary.sh`: placeholder for local contract validation.
- `sync-web-assets.sh`: copy production web assets (브랜드 로고 / 로그인 아이콘 / character / user sample image) into iOS 리소스 번들.
- `run-simulator-flow.sh`: backend health check + 시뮬레이터 빌드/런치 자동 실행.
- `verify-community-fallback.sh`: feed의 community 항목 대상 상세/댓글 API fallback 경로 점검.
- `run-ios-session-expiry-smoke.sh`: 만료 토큰 fixture로 토스트/로그인 복귀를 자동 점검.
- `run-ios-session-expiry-suite.sh`: 여러 세션 만료 시나리오를 일괄 점검.

### 자산 동기화

```bash
cd /Users/sihyungpark/Desktop/code/my-blog-app/mobile/ios
./scripts/sync-web-assets.sh
./scripts/run-simulator-flow.sh
```

`run-simulator-flow.sh`는 다음 환경변수를 지원합니다.
- `MOBILE_IOS_BUNDLE_ID`: 런타임 앱 번들 ID (기본값: `kr.sihyung.MyBlogIOSApp`)
- `MOBILE_IOS_SIMULATOR_UDID`: 타깃 시뮬레이터 UDID
- `MOBILE_BACKEND_URL`: 헬스체크 대상 백엔드 URL
- `MOBILE_IOS_TEST_ACCESS_TOKEN`: fallback 검증 시 feed 접근용 Bearer 토큰
- `MOBILE_IOS_FEED_LIMIT`: `/api/v1/feed?limit=` 값(최대 50)
- `MOBILE_IOS_COMMUNITY_FALLBACK_MAX_POSTS`: 검증할 feed 아이템 최대 개수
- `MOBILE_IOS_COMMUNITY_FALLBACK_COMMENT_LIMIT`: 댓글 fallback 후보 API에서 limit 값
- `MOBILE_IOS_SESSION_EXPIRY_MODES`: suite 실행 시 사용할 모드 목록 (공백 구분)
- `MOBILE_IOS_SESSION_FIXTURE`: expired/invalid/expired_refresh/missing_refresh/force_refresh_fail
- `MOBILE_IOS_FIXTURE_ACCESS_TOKEN`: 세션 만료 시뮬레이션용 access token
- `MOBILE_IOS_FIXTURE_REFRESH_TOKEN`: 세션 만료 시뮬레이션용 refresh token
- `MOBILE_IOS_FIXTURE_EXPIRED_AT`: refreshAt override (Unix timestamp)
- `MOBILE_IOS_TRACE_SECONDS`: 시뮬레이터 런치 trace 수집 시간
- `MOBILE_IOS_TRACE_LOG`: trace 로그 저장 경로

실행 예시
```bash
# 커뮤니티 fallback 실검증(실데이터 계정 토큰 사용)
MOBILE_IOS_TEST_ACCESS_TOKEN=ey... MOBILE_IOS_FEED_LIMIT=40 ./scripts/verify-community-fallback.sh

# 세션 만료 강제 + 토스트/복귀 플로우 smoke
MOBILE_IOS_FIXTURE_ACCESS_TOKEN=expired_token \
MOBILE_IOS_FIXTURE_REFRESH_TOKEN=expired_refresh \
MOBILE_IOS_SESSION_TRACE_SECONDS=40 \
./scripts/run-ios-session-expiry-smoke.sh expired

# 세션 만료 시나리오 전체 suite 실행
MOBILE_IOS_SESSION_EXPIRY_MODES="expired invalid expired_refresh missing_refresh force_refresh_fail" \
./scripts/run-ios-session-expiry-suite.sh

실행 시 주의사항
- `run-ios-session-expiry-smoke.sh`는 모드별로 기본 fixture 토큰을 구성합니다.
- `missing_refresh`는 refresh token이 빈값으로 들어가 `auth.expired`와 `auth.toast_shown`, `auth.login_shown` 플래그를 검증합니다.
- `force_refresh_fail`은 refresh 시도 흔적(`request.refresh_failed`)과 로그인 복귀 흔적을 함께 검증합니다.
```

복사/생성 규칙
- GitHub 로그인: `frontend/public/assets/auth_login/github/*.png`
- Google 로그인: `frontend/public/assets/auth_icons/google/*.svg`를 `sips`로 PNG 변환
- 앱 로고: `frontend/public/assets/block-logo.png`
- 다크 로고: `frontend/public/assets/block-logo(dark)*.png` -> `Resources/App/block-logo-dark*.png`
- 프로필 샘플: `frontend/public/user_images/*` -> `Resources/SampleProfiles/*`
- 캐릭터 샘플: `frontend/public/character/*` -> `Resources/Character/*`
