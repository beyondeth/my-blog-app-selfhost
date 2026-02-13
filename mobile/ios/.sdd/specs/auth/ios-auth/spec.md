---
id: ios-auth
title: "iOS 인증"
status: draft
created: 2026-02-12
domain: auth
depends: null
constitution_version: 1.0.0
---

# iOS 인증

> 토큰 기반 인증, 키체인 저장, 갱신 플로우

---

## 개요

모바일 앱은 백엔드의 웹 쿠키 인증과 분리된 `mobile` 토큰 방식으로 동작한다. 로그인 성공 시 access/refresh 토큰을 iOS Keychain에 안전 저장하고, 만료·갱신·로그아웃이 일관된 규칙으로 동작해야 한다.

---

## 요구사항

### REQ-01: 인증은 `/api/v1/mobile/auth/login`로 시작해야 한다(SHALL).

- 로그인은 모바일 전용 인증 API를 호출해 accessToken/refreshToken/사용자 정보를 받아야 한다(SHALL).
- 토큰은 평문 저장 없이 보안 저장소에 보관해야 한다(SHALL).
- 로그인 실패 시 에러 코드를 분기해 사용자에게 명확히 안내해야 한다(SHALL).

### REQ-02: 권한이 필요한 API 요청은 Bearer 헤더를 사용해야 한다(SHALL).

- accessToken은 모든 보호 API 요청 헤더에 `Authorization: Bearer <token>` 형태로 첨부해야 한다(SHALL).
- 토큰 미보유 시 인증 화면으로 이동해야 한다(SHALL).

### REQ-03: 토큰 갱신은 단일 in-flight로 처리해야 한다(SHALL).

- 동시에 여러 요청이 401/토큰 만료를 받더라도 refresh API는 1회만 호출해야 한다(SHALL).
- 갱신 성공 시 대기 요청은 새 토큰으로 재시도해야 한다(SHALL).
- 갱신 실패 2회 연속 시 세션을 종료하고 로그인 화면으로 이동해야 한다(SHALL).

### REQ-04: 로그아웃은 로컬과 원격 상태를 동기 정리해야 한다(SHALL).

- `POST /api/v1/mobile/auth/logout` 후 로컬 Keychain의 토큰을 즉시 삭제해야 한다(SHALL).
- 사용자 캐시 데이터도 인증 단계를 초기화해야 한다(SHALL).

---

## 시나리오

### Scenario 1: 로그인 성공

- **GIVEN** 사용자가 유효한 자격 증명을 입력한다.
- **WHEN** `/api/v1/mobile/auth/login` 성공 응답을 받는다.
- **THEN** 토큰이 Keychain에 저장되고 피드 홈으로 이동한다.

### Scenario 2: access 토큰 만료

- **GIVEN** 만료된 accessToken으로 보호 API를 호출했다.
- **WHEN** 401/토큰 만료가 발생한다.
- **THEN** 단일 refresh 호출 후 재요청하여 화면 상태를 유지한다.

### Scenario 3: 다중 동시 만료

- **GIVEN** 화면에서 동시 호출이 여러 개 401을 받는다.
- **WHEN** 갱신 트리거가 동시에 발생한다.
- **THEN** refresh 동시 호출을 차단하고, 갱신 완료 후 대기 요청을 재실행한다.

### Scenario 4: 세션 복구 실패

- **GIVEN** 토큰 갱신이 반복 실패한다.
- **WHEN** 재시도 정책을 초과한다.
- **THEN** 로그인으로 강제 이동하고, 로컬 세션을 비운다.

---

## 비기능 요구사항

### 성능

- 토큰 갱신은 P95 400ms 이내 완료되어야 한다(SHOULD).
- 앱 시작 후 인증 상태 결정은 3초 이내 완료되어야 한다(SHOULD).

### 보안

- 토큰은 Keychain + 앱 액세스 제어 수준으로 보호해야 한다(SHALL).
- 인증 실패 로그에는 토큰 값이나 PII를 기록해서는 안 된다(SHALL NOT).

## 제약사항

- 웹 쿠키 세션은 iOS 기본 인증 플로우에서 우회 처리한다(SHALL).
- 백엔드 응답 스키마 변경 시 계약 파일이 먼저 갱신되어야 한다(SHALL).

## 용어 정의

| 용어 | 정의 |
|------|------|
| accessToken | API 호출용 단기 JWT |
| refreshToken | accessToken 갱신용 장기 토큰 |
| in-flight 갱신 | 동시 갱신 요청을 합쳐 한 번만 수행하는 동작 |
