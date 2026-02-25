# NestJS 현구조 유지 리팩토링 계획서 v3 (교정 반영 + Read-Only 확장 대비)

## 요약
목표는 비대한 서비스와 결합도를 줄이되 DB/API 계약은 철저히 유지하는 것입니다.
이번 계획은 "나중에 파일 추가"를 막기 위해 수정 대상 파일을 먼저 고정하고, 그 범위 내에서만 진행합니다. 단, 테스트 파일(`*.spec.ts`), 모듈 프로바이더(`*.module.ts`), 일부 공용 이벤트 리스너 등은 필수 동반 수정 대상으로 인정합니다.

## 범위 고정 (이번 배치에서만)

### 1. 핵심 도메인 파일 (수정/생성 대상)
- **대상 모듈:** `posts`, `users`, `auth`, `comments`의 `module` / `controller` / `service` / `repository` 관련 파일
- **필수 동반 파일:**
  - 각 도메인의 `*.spec.ts` (Unit/Integration)
  - `backend/test/**` 중 영향을 받는 E2E 테스트 파일들
  - `backend/src/common/events/cache.events.ts` (이벤트 버전 추가 시)
- **문서:**
  - `docs/backend-ubiquitous-language.md` (용어 사전)

### 2. 절대 제외 (Out of Scope)
- DB 마이그레이션 (`Migration`)
- 클라이언트 노출용 DTO 스키마 변경
- API 엔드포인트 버전 범프 (e.g., `/v2/...`) 작업

## 구현 원칙
1. **외부 계약 불변:** 외부 DTO 필드, JSON 응답 구조, 에러 코드는 절대 변경하지 않는다.
2. **사이드 이펙트 격리:** Entity 및 DB 컬럼명은 불변으로 유지한다.
3. **용어 강제 변환 (Mapping):** Controller에서 외부의 범용 용어(Generic term)를 내부 도메인 용어로 반드시 매핑하여 Service로 넘긴다.
4. **위험 구문 수동 점검:** Raw SQL alias (`select("... as ...")`)는 리팩토링 후 수동 점검 체크리스트로 운영한다.
5. **PR 1개 1종류 작업:** 하나의 PR에서 네이밍 변경, 구조 분리, 행위 변경을 섞지 않는다.
6. **Fat Service 강제 분리:** 600줄을 초과하는 서비스는 반드시 분리(CQS) 대상으로 삼는다. (단, 파사드(Facade) 역할의 위임 코드는 제외)

## 단계별 실행

### 1. Baseline 고정
- 현재 소스의 라인수, `forwardRef` 개수, 핵심 API 스냅샷을 기록한다.
- 성능 지표(P95 응답속도, 쿼리 수, 캐시 히트율)를 리팩토링 전 기록해둔다.

### 2. Posts 모듈 정리
- `posts.service.ts`를 위임용 파사드(Facade)로 축소한다.
- 조회용 `QueryBuilder` 로직을 `posts-read.repository.ts`로 이관한다.
- 쓰기(Write) 경로에 결합된 캐시/알림/통계 업데이트를 이벤트 리스너로 분리하기 시작한다.

### 3. Users 모듈 분리
- 1500줄이 넘는 `users.service.ts`를 `users-query`, `users-command`, `users-cache`, `users-event` 로 분리한다.
- Controller 단에서 매핑을 통해 내부 도메인 용어를 강제한다.

### 4. Auth 모듈 분리
- 검증 및 조회는 `auth-query.service.ts`로, 상태 변경(토큰, 로그인, 가입)은 `auth-command.service.ts`로 분리한다.
- 토큰/로그인/회원가입 등 핵심 보안 영역이므로 E2E 회귀 테스트를 다른 도메인보다 2배 강화한다.

### 5. Comments 모듈 분리
- `comments-query`, `comments-command`, `comments-cache`, `comments-event` 책임으로 체계화한다.
- 복잡한 대댓글/트리 조회 로직은 `comments-read.repository.ts`의 SQL/QueryBuilder 층으로 내린다.

### 6. 결합도 개선 확인
- 추출된 대상 모듈(`posts`, `users`, `auth`, `comments`) 내부의 직접적인 상호 호출을 이벤트 중심으로 변환하여 축소한다.
- 타깃 모듈과 연관된 `forwardRef`가 실제로 감소했는지 확인한다.

### 7. 용어사전 강제
- `docs/backend-ubiquitous-language.md`에 정의된 금지어/권장어 규칙을 적용한다.
- 신규 작성되거나 수정되는 코드의 PR 리뷰 시 핵심 체크 항목으로 강제한다.

### 8. Read-Only 확장 대비 (구조 심기)
이번 리팩토링에서 향후 시스템 확장을 위한 **읽기 라우팅(Read Routing)** 기반 추상화 코드를 심어둔다.
- **`ReadPolicy` 인터페이스:** 기본 타입으로 `primary`, `replica`, `cache_first` 도입.
- **기본 Hybrid 정책 적용:**
  - 일반 조회(목록 등): `replica` / `cache_first` 정책 할당.
  - 정합성 민감(결제, 권한, 수정 직후 조회): `primary` 강제 할당.
- **캐시 패턴:** 조회(Query)는 Look-aside 패턴을 따르고, 작성/수정(Command)은 이벤트 기반의 Invalidation(무효화) 패턴을 구축한다.
- **이벤트 버저닝:** 하위 호환성을 위해 `*.v1`을 유지하며 `*.v2`를 병행 송출하되, "7일간 호출 0건 시 제거" 조건을 코드 주석에 명시한다.

## 테스트/검증 게이트
- `pnpm --dir backend build`
- `pnpm --dir backend test`
- `pnpm --dir backend test:e2e`
- **API 스냅샷 / OpenAPI diff 테스트**
- **Tier 2 내부 품질 검증:**
  - 신규 생성된 Query / Command / Repository에 대한 단위 및 통합 테스트.
  - 이벤트 리스너 동작이 실패하더라도 메인 쓰기 트랜잭션이 성공하는지 격리 테스트.
- **수동 점검 필수 사항 (Human Review):**
  - TypeORM의 `select("... as ...")` alias 누락 여부.
  - 리팩토링 후 캐시 키 및 이벤트 Payload의 소비자(Consumer) 호환성 유지 여부.
  - Web, iOS, AOS 등 다중 클라이언트의 소비 필드 구조 불변 여부 교차 검증.

## 완료 기준 (DoD - Definition of Done)
- `users`, `auth`, `comments` 대형 서비스 클래스는 파사드(Facade) + 서브서비스 구조로 완전히 재편되며, 각각 600줄 이하 기준을 충족한다. (기준 초과 시 명확한 예외 사유 문서화 必)
- `posts.service.ts`는 직접 로직을 처리하지 않는 위임(Delegate) 파사드 역할로 정리된다.
- **외부 API 계약(DTO/응답) Diff 0건.**
- 리팩토링 대상 모듈 경로의 `forwardRef` 개수가 유의미하게 감소하였다.
- 코드 내부에 `ReadPolicy` 인터페이스와 `primary fallback` 방어 코드가 반영되었다.

## 가정/기본값
- 아키텍처는 "NestJS 현 구조 유지"를 채택하며 거창한 DDD 도입은 지양한다.
- API 및 DB 계약은 하위 호환성을 완벽히 유지한다.
- 이번 배치 작업은 **backend 레포지토리** 중심이며 클라이언트 코드는 일절 수정하지 않되, "클라이언트 계약 파손 여부 검증"은 백엔드 파트의 책임 수문에 포함된다.
