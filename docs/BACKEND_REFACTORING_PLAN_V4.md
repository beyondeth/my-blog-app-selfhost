# NestJS 현구조 유지 리팩토링 계획서 v4 (최종 실행 버전)

## 🎯 목표
비대한 서비스 파일과 결합도를 축소하고, DB/API 계약(하위 호환성)은 완벽히 유지합니다. 향후 DB Read Replica 및 Redis 캐시 노드 확장을 위한 "읽기 채널 분리(Read-Only)" 아키텍처를 도입합니다.

> **작업 브랜치:** `feature/backend-refactoring-v4` (해당 브랜치에서 모든 단계별 작업 수행)

---

## 🔒 1. 범위 확정 (Scope Freeze)

### [ ] 핵심 도메인 파일 (수정/생성 대상)
- [ ] `posts`, `users`, `auth`, `comments` 모듈의 `module`, `controller`, `service`, `repository` 관련 파일
### [ ] 필수 동반 파일
- [ ] 각 도메인의 `*.spec.ts` (unit/integration)
- [ ] `backend/test/**` 중 영향받는 E2E 테스트 파일들
- [ ] `backend/src/common/events/cache.events.ts` (이벤트 버전 관리 용도)
### [ ] 산출 문서
- [ ] `docs/backend-ubiquitous-language.md` (용어 사전)
### [ ] 제외 사항 (수정 금지)
- [ ] DB Migration
- [ ] 클라이언트 노출용 DTO 스키마 변경
- [ ] API version bump (`/v2` 등)

---

## ⚖️ 2. 구현 원칙
- [ ] **외부 스펙 불변:** 외부 DTO, 응답 JSON, 에러코드는 1바이트도 수정하지 않는다.
- [ ] **Entity 패턴 불변:** Entity 및 DB 컬럼명 변경 금지.
- [ ] **용어 매핑:** Controller 단에서 외부의 모호한 변수를 내부 도메인 용어로 반드시 매핑(Adapting)한다.
- [ ] **수동 점검:** `select("... as ...")` 같은 Raw SQL alias는 문자열 스캔으로 수동 점검한다.
- [ ] **PR 룰:** 1개 PR 당 1종류의 작업(네이밍 변경 OR 구조 분리 OR 행위 변경)만 담는다.
- [ ] **서비스 크기:** 서비스 로직이 600줄 초과 시 분리를 의무화한다.

---

## 🏃 3. 단계별 실행 (TODO List)

### Phase 1. Baseline 고정
- [ ] 핵심 API의 현재 응답 스냅샷 작성 및 고정.
- [ ] 타깃 모듈들의 현재 코드 라인수 측정 및 기록.
- [ ] 현재 `forwardRef` 의존성 개수 측정 및 기록.
- [ ] 리팩토링 전 성능 지표(P95 응답속도, 쿼리 수, 캐시 히트율) 백업.

### Phase 2. 용어사전 강제 확립
- [ ] `docs/backend-ubiquitous-language.md` 에 금지어/권장어 확정 작성.
- [ ] 신규 분리될 컨트롤러/서비스 라인에 용어 사전 강제 매핑 룰 적용.

### Phase 3. Posts 도메인 정리
- [ ] `posts.service.ts`의 로직들을 다른 서비스로 위임하여 파사드(Facade) 역할로만 축소.
- [ ] 복잡한 조회 `QueryBuilder` 로직을 `posts-read.repository.ts` 로 이관.
- [ ] Write 로직 내부의 캐시 무효화, 알림 발송, 통계 업데이트 로직을 분리하여 이벤트 리스너로 전환 시작.

### Phase 4. Users 도메인 분리 (Fat Service 타파)
- [ ] `users.service.ts` 내부를 4가지 계층으로 분리:
  - [ ] `users-query.service.ts`
  - [ ] `users-command.service.ts`
  - [ ] `users-cache.service.ts`
  - [ ] `users-event.service.ts`
- [ ] Controller를 수정하여 내부 도메인 용어 매핑 코드 작성.

### Phase 5. Auth 도메인 분리
- [ ] 검증 및 조회 역할 ➡️ `auth-query.service.ts`
- [ ] 토큰, 로그인, 회원가입 등 상태 변경 역할 ➡️ `auth-command.service.ts`
- [ ] 핵심 보안 검증 (토큰/로그아웃 테스트) E2E 회귀 테스트 강화.

### Phase 6. Comments 도메인 분리
- [ ] 댓글 조회, 작성, 캐시, 이벤트를 CQS 원칙으로 분리 (`comments-query/command/cache/event`).
- [ ] 복잡한 트리 계층 조회 쿼리를 `comments-read.repository.ts` 별도 파일로 이동.

### Phase 7. 결합도 개선 확인
- [ ] 분리된 파일 내부의 직접적인 상호 서비스 호출 대신 이벤트를 발행하는지 검토.
- [ ] Phase 1에서 측정한 대상 모듈의 `forwardRef` 수치 감소 확인.

### Phase 8. Read-Only 확장 대비 구조 이식
- [ ] **`ReadPolicy` 인터페이스 도입:** `enum ReadPolicy { Primary, Replica, CacheFirst }`
- [ ] 기본 하이브리드 정책 적용 테스트:
  - [ ] 일반 조회 시 `replica` / `cache_first` 옵션 동작 확인.
  - [ ] 결제, 권한 체크, 본인 작성글 직후 조회 등 정합성 민감 쿼리 시 `primary` 가드 적용.
- [ ] **이벤트 버저닝 적용:** 하위 호환성을 위해 `event.v1` 유지 및 `event.v2` 병행 송출 처리. (주석에 7일간 0건 시 제거 조건 명시)

---

## 🚧 4. 테스트 / 검증 게이트
아래의 명령어가 모두 성공해야 머지(Merge) 가능합니다.
- [ ] `pnpm --dir backend build` 성공 확인
- [ ] `pnpm --dir backend test` 전체 통과
- [ ] `pnpm --dir backend test:e2e` 전체 통과
- [ ] 신규 쿼리/커맨드/리포지토리에 대한 단위(Unit) 및 통합(Integration) 테스트 통과
- [ ] 이벤트 리스너 실패 시 메인 트랜잭션 정상 커밋 격리 통과 (Isolation Test)
- [ ] 수동 점검 리스트:
  - [ ] `select("... as ...")` QueryBuilder Alias 누락 체크.
  - [ ] 캐시 키 이름 변경에 의한 하위 호환성 체크.
  - [ ] 이벤트 버저닝 누락 체크.
  - [ ] Web / iOS / Android 의 API 파싱용 스펙에 어긋나는 응답 필드 변경이 1개라도 있는지 교차 체크.

---

## 🏁 5. 프로젝트 종료 기준 (DoD)
- [ ] `users`, `auth`, `comments` 파일은 Facade + SubService 구조로 개편되었으며 핵심 로직 파일 기준 800줄 이하인가? (초과 시 합당한 예외사유가 문서로 존재하는가?)
- [ ] `posts.service.ts`는 직접 로직 없이 타 서비스로 위임하는 형태로만 존재하는가?
- [ ] 클라이언트 대응 외부 계약(API Diff) 차이가 `0`건 임을 증명했는가?
- [ ] 대상 경로 모듈들의 `forwardRef` 횟수가 실제로 감소했는가?
- [ ] `ReadPolicy` 인터페이스와 Fallback 경로 코드가 실제 쿼리 서비스에 정상적으로 주입되어 반영되었는가?

---

## 🔒 6. Phase 4 완료 — 아키텍처 Freeze 선언

> **선언일:** 2026-02-25
> **해제 예정일:** 2026-04-08 (6주 후)

### Freeze 범위
아래 항목에 해당하는 **구조적 변경(Structural Refactoring)**을 6주간 전면 금지합니다:
- 서비스 파일 신규 분리 또는 병합
- 모듈 간 의존성 그래프 변경
- 이벤트 발행/구독 경로 변경
- `TransactionEventBuffer` 또는 캐시 무효화 흐름 변경

### Freeze 기간 허용 항목
- 버그 수정 (hotfix)
- 기능 개발 (새 API 엔드포인트, 새 필드 추가 등)
- 테스트 추가/보강
- 성능 튜닝 (쿼리 최적화, 인덱스 추가 등)

### Phase 4 완료 성과 요약

| 항목 | Before | After |
|---|---|---|
| `PostCreationService` | 1,199줄 (모든 로직 한 파일) | 128줄 Facade |
| 포스트 생성 전담 | — | `PostCreator` 381줄 |
| 포스트 수정 전담 | — | `PostUpdater` 606줄 |
| 포스트 삭제/복원 전담 | — | `PostDeleter` 296줄 |
| 캐시 무효화 경로 | 2개 (이중 삭제 버그) | 1개 (CacheInvalidationListener 전담) |
| `permanentDelete` | fire-and-forget (버그) | TransactionEventBuffer 패턴 |
| 큐 jobId | 24시간 재처리 차단 | Date.now() suffix로 해소 |
| TransactionEventBuffer | 로깅 없음 | correlationId + 성공/실패 카운터 |

### 재리팩토링 재개 조건 (트리거 기반)
아래 **하나라도 해당 시** Freeze를 해제하고 리팩토링을 재개합니다:
1. P95/SLO 2주 연속 실패
2. 동일 모듈 장애 월 2회 이상
3. 릴리즈 2회 연속 롤백

