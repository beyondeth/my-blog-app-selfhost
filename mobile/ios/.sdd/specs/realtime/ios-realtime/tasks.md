---
feature: ios-realtime
created: 2026-02-12
total: 10
completed: 0
---

# 작업 목록: 실시간 연결

> 총 10개 작업

---

## 진행 상황

- 대기: 10
- 진행 중: 0
- 완료: 0
- 차단됨: 0

---

## 작업 목록

### ios-realtime-task-001: 상태 머신 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- disconnected/connecting/connected/error 상태 정의

### ios-realtime-task-002: Token 기반 연결 초기화

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- access 토큰으로 handshake 실행

### ios-realtime-task-003: 앱 생명주기 훅

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- foreground/background에서 연결/해제 정책 적용

### ios-realtime-task-004: 재연결 정책

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- 실패 시 exponential backoff 구현

### ios-realtime-task-005: 실시간 이벤트 디듀핑

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- eventId 또는 timestamp 기반 중복 방지

### ios-realtime-task-006: 채널 재구독

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- reconnect 후 rooms/subscription 재등록

### ios-realtime-task-007: 오프라인 배너

- **상태:** 대기
- **우선순위:** 🟢 LOW
- 연결 상실 시 사용자 메시지 표시

### ios-realtime-task-008: 메시지 큐 정책

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- 발송/수신 동시성에서 순서를 보장하고 누락 감지

### ios-realtime-task-009: 모니터링 포인트

- **상태:** 대기
- **우선순위:** 🟢 LOW
- 연결 횟수/재연결 횟수 로깅 규칙 정립

### ios-realtime-task-010: 테스트/문서 정합

- **상태:** 대기
- **우선순위:** 🟢 LOW
- 시나리오 테스트 표 작성 및 문서 갱신
