---
feature: android-architecture
created: 2026-02-13
status: draft
---

# 구현 계획: Android 앱 아키텍처

> Kotlin + Compose + 계층형 구조 + 플랫폼 격리 운영

---

## 개요

Android 앱은 iOS와 동일한 feature 중심 구조를 채택하되, Android 네이티브 패턴(Compose, ViewModel, StateFlow)에 맞춰 구현한다. 모바일 계약은 `mobile/contracts` 단일 소스로 유지한다.

---

## 기술 결정

### 결정 1: App/Core/Feature 모듈 분리(SHALL)

- `app`(엔트리), `core`(network/auth/designsystem/common), `feature`(auth/feed/community/profile/compose)로 나눈다.
- 의존성은 `app -> feature -> core` 방향으로 제한한다.

**근거:** iOS의 계층 분리와 역할 대응이 쉬우며, 장기적으로 Android 단독 릴리즈와 테스트 분리가 쉽다.

### 결정 2: Compose + ViewModel + StateFlow 상태관리(SHALL)

- UI 상태는 `StateFlow`로 공개하고 내부 mutable state는 숨긴다.
- 단발성 이벤트는 `SharedFlow`로 분리한다.

---

## 구현 단계

### Phase 1: 스켈레톤

- Gradle 멀티모듈 스켈레톤 생성.
- 앱 엔트리, 네비게이션 shell, 테마 토큰 적용.

**산출물:**
- [ ] 모듈 트리 고정
- [ ] 공통 DI 엔트리
- [ ] 탭 기반 라우팅 shell

### Phase 2: 공통 인프라

- API 클라이언트, 에러 모델, 로거, 토큰 스토어 구현.
- `/api/v1/mobile/*` 계약 매핑 DTO 생성.

**산출물:**
- [ ] 공통 네트워크 레이어
- [ ] 공통 에러 핸들링
- [ ] 인증 저장소

### Phase 3: 성능/품질

- 리스트 렌더링 최적화, 이미지 로딩 정책, 오프라인 배너 구현.
- 접근성(글자 크기, TalkBack 라벨) 점검.

**산출물:**
- [ ] 성능 체크리스트
- [ ] 접근성 체크리스트
- [ ] 오프라인 회복 전략

---

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 모듈 과분리 | 중간 | 초기에는 최소 모듈부터 시작 후 점진 확장 |
| 계약 불일치 | 높음 | `mobile/contracts` 변경 동기화 리뷰를 필수화 |
| iOS 대비 UX 괴리 | 중간 | parity 체크리스트로 핵심 플로우 동등성 검증 |

---

## 승인 게이트 시나리오

### Scenario: 비-Android 경로 변경 감지

- **GIVEN** Android 구현 중 추가 변경 필요 사항이 확인됨
- **WHEN** 대상 경로가 `mobile/android/**`를 벗어남
- **THEN** 즉시 작업을 중단하고 사용자 승인 후 진행한다

## 다음 단계

1. `feature/kotlin`에서 모듈 스켈레톤을 고정한다.
2. `core-network`, `core-auth`, `feature-auth` 순서로 구현한다.
3. `sdd validate --strict`로 문서 검증을 수행한다.
