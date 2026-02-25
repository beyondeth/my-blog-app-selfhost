---
feature: ios-auth
created: 2026-02-12
total: 10
completed: 0
---

# 작업 목록: iOS 인증

> 총 10개 작업

---

## 진행 상황

- 대기: 10
- 진행 중: 0
- 완료: 0
- 차단됨: 0

---

## 작업 목록

### ios-auth-task-001: API 모델 및 엔드포인트 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- `/api/v1/mobile/auth/login|refresh|logout|me` 요청/응답 DTO 정의
- 오류 코드 공통 모델 작성

### ios-auth-task-002: Keychain 스토리지 구축

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- `TokenStore` 프로토콜 + Keychain 구현체 구성
- access/refresh 만료일, rotation 메타데이터 저장

### ios-auth-task-003: 요청 파이프라인과 인증 헤더 삽입

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- 모든 보호 API 요청 전 Authorization 헤더 주입
- 미인증 경로 예외 처리

### ios-auth-task-004: 단일 갱신(Refresh) 동기화

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- 동시 401을 대기 큐로 합치고 성공 시 일괄 재시도
- 갱신 실패 재시도 횟수 및 임계치 적용

### ios-auth-task-005: 인증 상태 루트 바인딩

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- 시작 시 세션 판별(me) 후 루트 화면 라우팅

### ios-auth-task-006: 로그인/로그아웃 UI 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- 로그인 입력 유효성 검증 + 스피너/에러 바인딩
- 로그아웃 시 세션 클리어

### ios-auth-task-007: 보안 로깅 및 디버그 제약 추가

- **상태:** 대기
- **우선순위:** 🟢 LOW
- 토큰 값/PII 마스킹
- 예외 유형별 사용자 메시지 매핑

### ios-auth-task-008: 인증 실패 재시도 UX

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- 오프라인/만료/불일치 케이스에 대한 CTA 제공

### ios-auth-task-009: 계약 테스트 정합

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- 스펙 계약 예시와 응답 스키마 매칭 샘플 작성

### ios-auth-task-010: 문서 및 SDD sync 점검

- **상태:** 대기
- **우선순위:** 🟢 LOW
- `mobile/contracts` 연동 문구 정리
- `sdd validate` 점검 및 상태 갱신
