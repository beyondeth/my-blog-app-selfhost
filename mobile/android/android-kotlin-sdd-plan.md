---
feature: android-kotlin-migration
created: 2026-02-13
status: draft
---

# 구현 계획: Android Kotlin 앱 전개

> iOS 디자인 정합성 유지 + 계약 우선(contract-first) + 플랫폼 격리 운영

---

## 개요

Next.js + NestJS 기반 기존 제품을 Android 네이티브 앱(Kotlin)으로 전개한다. Android 구현은 `mobile/android` 내부에서만 진행하며, `mobile/contracts`를 단일 계약 소스로 사용해 iOS/web 작업과 충돌을 차단한다.

---

## 작업 경계 및 승인 게이트

- Android 구현 변경은 `mobile/android/**` 범위로 제한한다(SHALL).
- 공용 계약 변경은 `mobile/contracts/**`에서만 수행한다(SHALL).
- `frontend/**`, `backend/**`, `mobile/ios/**` 수정이 필요한 경우 즉시 중단하고 사용자 승인 후 재개한다(SHALL).
- 플랫폼 간 파생 작업은 독립 브랜치/PR로 분리한다(SHALL).

### Scenario: 플랫폼 충돌 방지 게이트

- **GIVEN** Android 작업 중 iOS/web 영향 가능 변경이 식별됨
- **WHEN** 영향 범위가 `mobile/android/**`를 벗어남
- **THEN** 작업을 즉시 중단하고 승인 요청 후 진행한다

---

## 기술 결정

### 결정 1: Kotlin + Jetpack Compose + MVVM + Repository 패턴 채택(SHALL)

- iOS의 Feature 중심 분리를 Android에서도 동일하게 유지하고, 화면 상태는 단방향 데이터 흐름으로 통일한다.
- 네트워크/인증/피드/커뮤니티/프로필을 feature 모듈로 분리해 팀 병렬 작업을 허용한다.

**근거:** iOS 구현 패턴과 책임 경계가 유사하며, 장기적으로 Android 독립 릴리즈와 테스트 자동화에 유리하다.

**대안 검토:**
- XML View + Fragment 혼합: 기존 사례는 많지만 Compose 대비 일관성/생산성 저하.
- 단일 app 모듈 집중: 초기 속도는 빠르나 기능 확장 시 충돌 위험 증가.

### 결정 2: `mobile/contracts` 기반 API 클라이언트 정합 유지(SHALL)

- 모바일 API는 `/api/v1/mobile/*` 계약을 기준으로 구현한다.
- 계약 변경 시 iOS/Android 공통 영향 분석을 먼저 수행한다.

---

## 구현 단계

### Phase 0: 기반 정리 (격리/브랜치/문서)

- 작업 브랜치: `feature/kotlin`.
- Android 전용 실행 가이드와 폴더 규칙 문서화.
- `kotlin-expert` 스킬 설치 실패 시 조회 문서를 참조한 체크리스트를 로컬 가이드로 고정.

**산출물:**
- [ ] Android 작업 경계 문서
- [ ] 브랜치/PR 규칙 문서
- [ ] Kotlin 코딩 가이드 초안

### Phase 1: 프로젝트 스켈레톤 및 공통 인프라

- Compose 기반 앱 엔트리, 라우팅, 테마(라이트/다크), DI(Hilt 또는 Koin) 구성.
- APIClient, TokenStore(EncryptedSharedPreferences/Keystore), 공통 에러 모델 작성.

**산출물:**
- [ ] App shell + 탭 네비게이션
- [ ] 공통 네트워크 레이어
- [ ] 토큰 저장/복구 모듈

### Phase 2: 인증/피드 우선 구현 (iOS 동등 UX)

- Login, Session restore, Refresh token, Logout 흐름 구현.
- Feed 목록/상세/좋아요/댓글 진입 및 페이지네이션 구현.

**산출물:**
- [ ] 인증 플로우(성공/실패/만료)
- [ ] 피드 목록/상세 핵심 시나리오
- [ ] 로딩/오류/빈 상태 UI

### Phase 3: 커뮤니티/프로필/글쓰기 확장

- Community, Profile, Compose 기능을 iOS 정보구조와 맞춰 확장.
- 접근성(텍스트 스케일/스크린리더) 및 모션 정책 반영.

**산출물:**
- [ ] 커뮤니티 주요 플로우
- [ ] 프로필/설정
- [ ] 글쓰기/수정 핵심 흐름

### Phase 4: 품질 게이트 및 릴리즈 준비

- 계약 회귀 테스트, UI 스냅샷/스크린샷 점검, 성능 기준 점검.
- iOS와 디자인 정합성 리뷰 체크리스트 운영.

**산출물:**
- [ ] 계약 정합성 리포트
- [ ] 디자인 parity 체크리스트
- [ ] Android MVP 릴리즈 체크리스트

---

## iOS 디자인 정합 기준

- 정보 구조(탭 구성, 핵심 플로우 순서)는 iOS와 동일해야 한다(SHALL).
- 시각 스타일(컬러 토큰/타이포 계층/간격 밀도)은 iOS 문서 기준으로 매핑해야 한다(SHALL).
- Android 네이티브 상호작용(뒤로가기, 시스템 제스처)은 플랫폼 규칙에 맞게 해석할 수 있다(MAY).

### Scenario: 디자인 동등성 검증

- **GIVEN** Android 화면 구현 완료
- **WHEN** iOS 디자인 문서와 parity 체크를 수행함
- **THEN** 핵심 구조/상태/피드백이 동일 의미를 전달해야 함

---

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 플랫폼별 UI 해석 차이 | 중간 | parity 체크리스트와 공통 토큰 테이블 운영 |
| 계약 변경 누락 | 높음 | `mobile/contracts` 변경 시 영향 분석 템플릿 강제 |
| 인증 갱신 경합 | 높음 | 단일 refresh in-flight 제어와 재시도 정책 표준화 |
| 워크스트림 충돌 | 높음 | 폴더 경계 + 승인 게이트 + 브랜치 분리 |

---

## 테스트 전략

- 단위 테스트: TokenStore, Refresh coordinator, Repository 매핑.
- 통합 테스트: `/api/v1/mobile/auth/*`, `/feed`, `/posts`, `/comments` 계약 기반 시나리오.
- UI 테스트: 로그인 복구, 피드 페이지네이션, 오류/오프라인 회복.
- 회귀 체크: iOS parity 체크리스트 기반 스모크 검증.

---

## 다음 단계

1. Android용 SDD 스펙(`architecture`, `auth`, `feed-navigation`)을 생성한다.
2. `feature/kotlin` 브랜치에서 Phase 0 산출물을 먼저 고정한다.
3. `kotlin-expert` 설치 재시도 전 GitHub auth 상태를 점검하고, 실패 시 view 출력 기반 로컬 가이드를 유지한다.
