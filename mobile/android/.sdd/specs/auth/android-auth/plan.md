---
feature: android-auth
created: 2026-02-13
status: draft
---

# 구현 계획: Android 인증

> 모바일 전용 토큰 인증 + 단일 refresh 제어 + 보안 저장

---

## 개요

Android 인증은 웹 세션 경로를 직접 재사용하지 않고 모바일 계약(`/api/v1/mobile/auth/*`)을 기준으로 구현한다. iOS auth 플로우와 동일한 실패/복구 의미를 유지한다.

---

## 기술 결정

### 결정 1: Retrofit/OkHttp + TokenStore + RefreshCoordinator(SHALL)

- Authorization 헤더 주입 인터셉터를 표준화한다.
- 401 시 단일 in-flight refresh를 보장한다.
- 토큰은 EncryptedSharedPreferences + Keystore 기반으로 저장한다.

**근거:** iOS의 Keychain + refresh coordinator 패턴과 동등한 보안/일관성 확보.

---

## 구현 단계

### Phase 1: 인증 클라이언트 및 모델

- login/refresh/me/logout DTO 및 매퍼 구현.
- 인증 에러 타입(자격 증명 실패, 토큰 만료, 네트워크 오류) 정의.

**산출물:**
- [ ] Auth API 인터페이스
- [ ] TokenStore 인터페이스/구현
- [ ] 에러 매핑 모델

### Phase 2: 자동 복구 플로우

- 앱 시작 시 `me` 기반 세션 복구.
- refresh 실패 시 로그인 화면으로 즉시 폴백.
- 다중 요청 401 동시 처리 정책 적용.

**산출물:**
- [ ] 세션 복구 로직
- [ ] refresh coordinator
- [ ] 재로그인 유도 UI 상태

### Phase 3: 안정화

- 재시도 정책 및 로딩/오류 문구 통일.
- 인증 이벤트 로그 분류(민감 데이터 마스킹).

**산출물:**
- [ ] UX 상태 표준화
- [ ] 로그 정책 문서
- [ ] 테스트 시나리오 문서

---

## 테스트 전략

- 단위 테스트: TokenStore, RefreshCoordinator, 에러 매핑.
- 통합 테스트: login 성공/실패, refresh 성공/실패, logout.
- 수동 테스트: 앱 재시작 세션 복구, 토큰 만료 후 자동 복구.

---

## 승인 게이트 시나리오

### Scenario: 계약 외 경로 의존 요구

- **GIVEN** 인증 구현 중 웹 전용 API 의존 필요성이 제기됨
- **WHEN** `/api/v1/mobile/auth/*` 외 경로를 호출하려고 함
- **THEN** 구현을 중단하고 사용자 승인 후 계약 변경 절차를 진행한다

## 다음 단계

1. `core-auth`와 `feature-auth` 분리 구현.
2. iOS 인증 실패/복구 문구와 Android 문구 parity 매핑.
3. 인증 관련 계약 변경은 `mobile/contracts`에서만 반영.
