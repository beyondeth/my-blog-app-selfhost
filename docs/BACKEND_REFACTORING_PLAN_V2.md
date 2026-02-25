# NestJS 현구조 유지 리팩토링 계획서 v2 (범위 고정형, DDD 미도입)

## 요약
목표는 비대한 서비스와 결합도를 줄이되 DB/API 계약은 유지하는 것입니다.
이번 계획은 "나중에 파일 추가"를 막기 위해 수정 대상 파일을 먼저 고정하고, 그 범위 내에서만 진행합니다.

## 범위 고정 (Scope Freeze)
아래 파일만 이번 리팩토링 대상입니다. 이 목록 외 파일은 절대 수정하지 않습니다.

### 기존 파일(수정)
- `backend/src/posts/posts.module.ts`
- `backend/src/posts/posts.service.ts`
- `backend/src/posts/posts.controller.ts`
- `backend/src/posts/services/post-read.service.ts`
- `backend/src/posts/services/post-creation.service.ts`
- `backend/src/posts/services/post-interaction.service.ts`
- `backend/src/posts/services/post-cache.service.ts`
- `backend/src/posts/services/post-file.service.ts`
- `backend/src/posts/services/post-mapper.service.ts`
- `backend/src/users/users.module.ts`
- `backend/src/users/users.service.ts`
- `backend/src/users/users.controller.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/mobile-auth.controller.ts`
- `backend/src/comments/comments.module.ts`
- `backend/src/comments/comments.service.ts`
- `backend/src/comments/comments.controller.ts`
- `backend/src/comments/mobile-comments.controller.ts`
- `backend/src/common/events/cache.events.ts`

### 신규 파일(생성)
- `backend/src/users/services/users-query.service.ts`
- `backend/src/users/services/users-command.service.ts`
- `backend/src/users/services/users-cache.service.ts`
- `backend/src/users/services/users-event.service.ts`
- `backend/src/users/repositories/users-read.repository.ts`
- `backend/src/auth/services/auth-command.service.ts`
- `backend/src/auth/services/auth-query.service.ts`
- `backend/src/comments/services/comments-query.service.ts`
- `backend/src/comments/services/comments-command.service.ts`
- `backend/src/comments/services/comments-cache.service.ts`
- `backend/src/comments/services/comments-event.service.ts`
- `backend/src/comments/repositories/comments-read.repository.ts`
- `backend/src/posts/repositories/posts-read.repository.ts`
- `docs/backend-ubiquitous-language.md`

## 구현 원칙
- **DB 컬럼/Entity 필드명 변경 금지.**
- **외부 DTO/응답 스펙 변경 금지.**
- Controller에서 내부 도메인명으로 매핑.
- `select("... as ...")` 같은 Raw alias는 수동 점검.
- **posts -> users -> auth -> comments 순서**로 모듈별 진행.
- PR 1개는 1종류 작업만 수행 (네이밍/구조/행위 변경 혼합 금지).

## 단계별 실행

### 1. 기준선 고정
- 대상 API 응답 스냅샷 고정.
- `forwardRef` 및 대형 서비스 라인 수 baseline 기록.

### 2. Posts 정리 (파사드 고도화 + QueryBuilder 분리)
- `posts.service.ts`를 "위임 파사드(Delegate Facade)"로 축소.
- 복잡한 조회 쿼리를 `posts-read.repository.ts`로 이관.
- 캐시/이벤트 등 부작용(Side effects) 로직은 기존 하위 서비스 유지 및 위임.

### 3. Users CQS 분리
- `users.service.ts`의 read/write/cache/event 책임 분리.
- `users-query`, `users-command`, `users-cache`, `users-event` 서비스로 로직 이동.
- Controller는 기존 DTO 유지, 내부 계층으로 넘길 때 변수명만 도메인 용어로 변경.

### 4. Auth CQS 최소 분리
- 인증 조회/검증 로직은 `auth-query.service.ts`로 분리.
- 로그인/회원가입/토큰 발급 등 상태 변경 흐름은 `auth-command.service.ts`로 분리.
- 외부 API 계약 유지 보장 및 내부 명칭 정리.

### 5. Comments CQS + 부작용 분리
- 조회/작성/캐시/이벤트 책임 분리 설계.
- `comments-read.repository.ts`를 생성하여 복잡한 조회 SQL 및 `QueryBuilder` 로직 이관.

### 6. 결합도 정리
- 대상 파일 내 모듈 간 직접 서비스 상호 호출 축소.
- 대상 모듈 내 `forwardRef` 우선 제거 또는 최소화 적용.

### 7. 용어사전 적용
- `docs/backend-ubiquitous-language.md` 문서를 생성하여 금지어/권장어 확정.
- 신규 작성 코드 및 변경되는 코드에 용어사전 규칙 강제 적용.

## 테스트 및 검증
- **Tier 1 (외부 계약 유지 검증):**
  - `pnpm --dir backend build`
  - `pnpm --dir backend test`
- **Tier 2 (내부 신구 분리 검증):**
  - 추출된 `Repository` 단위 통합 테스트로 쿼리 결과 검증.
- **수동 체크리스트:**
  - `QueryBuilder` 내부 alias 문자열 수동 검토.
  - 리팩토링 후 이벤트 Payload 및 캐시 키 하위호환성 유지 확인.
  - Web/iOS/Android 클라이언트 소비 필드 불변 크로스 체크.

## 멀티플랫폼 동기화 항목
- **변경 없음 원칙:** DTO 필드, 응답 구조, 에러코드는 일절 변경하지 않음.
- **예외 발생 시:** 불가피한 변경 시 `/v2` 등으로 경로를 분리하고 플랫폼 개발팀에 동시 공지.
- **배포 순서:** 백엔드 하위호환 레이어를 먼저 배포한 후, 클라이언트(앱/웹)를 업데이트.

### 8. 성능 확장(Read-Only Scaling)을 위한 읽기 라우팅 설계
이번 리팩토링에서 CQS 구조를 강제하는 궁극적 이유는 향후 **"무중단 수준의 DB Read Replica 및 Redis 읽기 노드 도입"**을 위함입니다. 이를 위한 단단한 추상화를 지금 통합합니다.

- **8.1 기본 일관성 정책: Hybrid (하이브리드)**
  - 일반적인 읽기 트래픽(피드 목록, 인기글)은 Read Replica나 캐시(지연 일관성)를 허용합니다.
  - 결제, 권한, 계정 상태 변경 직후 등 민감도 높은 작업은 항상 Primary(강한 일관성)에서 읽어야 합니다.

- **8.2 ReadPreference 인터페이스 도입 (`*query.service.ts`)**
  - 조회 쿼리 서비스의 메서드는 내부 옵션으로 `ReadPreference(primary | replica | cache-first)`를 주입받을 수 있도록 설계합니다.
  - 이를 통해 특정 도메인 쿼리가 어느 정도로 지연 일관성(Stale Data)을 허용하는지 외부 파사드에서 제어할 수 있습니다.

- **8.3 정합성 가드 (Read-Your-Write)**
  - 사용자가 "방금 작성한 글"이나 "수정한 프로필"을 즉시 다시 읽을 때 캐시 지연으로 예전 데이터가 보이는 현상을 막기 위해, 특정 트랜잭션 문맥 내에서는 `primary fallback`이 발동되도록 안전장치를 설계합니다.

- **8.4 운영 전환 준비 (FeatureFlags & Metrics)**
  - 나중에 코드를 뒤집지 않기 위해, 환경 변수로 언제든 트래픽을 넘길 수 있는 플래그(`READS_FROM_REPLICA=false`, `REDIS_READONLY_ENABLED=false`)를 적용할 수 있는 `Config` 주입부를 미리 마련해둡니다.
  - 주요 모니터링 대상으로 Replica Lag, Cache Hit Ratio, Stale Read 비율 등을 측정할 수 있는 로깅 포인트를 `*query.service.ts` 주변(Decorator나 Interceptor)에 심어둘 수 있도록 고려합니다.

## 완료 기준 (DoD - Definition of Done)
- `users.service.ts`, `auth.service.ts`, `comments.service.ts` 코드는 위임 파사드 역할만 수행하거나 **600줄 이하**로 축소 완료됨.
- `posts.service.ts`는 위임 파사드 역할로 유지됨.
- 신규 분리된 CQS 서비스들과 Repository의 정상 동작 검증 완료.
- 외부 API 계약(응답 JSON) 차이 **0건**.
- 리팩토링 대상 모듈 내 `forwardRef` 개수 감소.

## 가정 및 기본값
- 이번 리팩토링 작업은 `backend/**` 영역에서만 수행하며 프론트엔드/iOS/AOS 레포지토리 코드는 일절 수정하지 않는다.
- 플랫폼 파급 효과(Impact)는 백엔드의 계약(Contract) 검증을 통해서만 완벽히 통제한다.
- 범위 고정(Scope Freeze) 목록 외의 파일 수정은 다음 배치 작업에서 별도 계획으로 다룬다.
