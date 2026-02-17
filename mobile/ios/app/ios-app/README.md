# MyBlog iOS App (Scaffold)

## 실행

- Swift Package Manager 기반 실행용 스캐폴드입니다.
- 앱 스택은 설계-우선 구조입니다.
- iOS 동작 우선 경로는 모바일 계약(`mobile/contracts`)과 동기화합니다.

## 시뮬레이터 실행(현재 기준)

### 1) 백엔드 기동
- `backend`가 `http://localhost:3000`에서 실행돼 있어야 함.
- iOS는 1차로 `MOBILE_API_BASE_URL=http://localhost:3000/api/v1` 사용.

### 2) iOS 앱 실행
- Xcode에서 `mobile/ios/app/ios-app` 경로를 Open
- 대상 스킴: `MyBlogIOSApp`
- 실행 순서:
  1. 백엔드가 올라간 상태에서 `cd /Users/sihyungpark/Desktop/code/my-blog-app-ios/mobile/ios`
  2. `MOBILE_IOS_BUNDLE_ID=kr.sihyung.MyBlogIOSApp ./scripts/run-simulator-flow.sh`
- 환경 변수:
  - `MOBILE_API_BASE_URL` (Debug 기본값: `http://localhost:3000/api/v1`, Release 기본값: `https://www.codebase.blog/api/v1`)
  - `MOBILE_FRONTEND_URL` (Debug 기본값: `http://localhost:3001`, Release 기본값: `https://www.codebase.blog`)
  - `MOBILE_SOCKET_URL` (미지정 시 `MOBILE_API_BASE_URL` 사용)
  - `MOBILE_OAUTH_CALLBACK_URL` (기본값: `codebase://auth/callback`)
  - 시뮬레이터에서 로컬 백엔드가 다르면 로컬 IP를 지정 가능

### 운영/프로덕션 필수 규칙
- 운영 빌드에서는 `MOBILE_API_BASE_URL`, `MOBILE_FRONTEND_URL`를 실제 도메인으로 지정해야 합니다.
- 앱은 `Info.plist`와 런치 환경변수 모두에서 설정을 읽습니다.
- `Release`에서 `localhost` URL이 감지되면 앱 부트스트랩에서 설정 오류를 발생시킵니다.

### 3) 최소 동작 검증
- 로그인 화면에서 계정 로그인
- 홈 피드(`/feed`) 리스트 로드
- 피드 셀 탭 → 상세 화면 이동
- Profile 탭 → 사용자 정보/로그아웃

참고: 현재 SwiftPM 산출물은 `.app` 패키지로 직접 생성되지 않기 때문에, 런타임 래퍼 앱 번들로 감싸서 시뮬레이터에 install/launch합니다.

## 현재 상태

- 스펙 기반으로 핵심 인증/토큰 저장/네트워크 구조 준비됨
- 탭/피드 UI 스켈레톤 구성

## 다음 단계

- `docs/sdd/ios-scalable-implementation-roadmap.md` 기준으로 Profile/Blog/Community 설정 스택 분리부터 진행.

## 다음 단계

1. Xcode 프로젝트 생성 또는 앱 대상 SwiftPM 바인딩
2. Feed/Comment/Realtime 기능 바인딩
3. Keychain 보안 래퍼를 별도 모듈화
