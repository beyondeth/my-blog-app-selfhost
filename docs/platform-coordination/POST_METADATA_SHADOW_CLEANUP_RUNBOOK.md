# Post Metadata Shadow Cleanup Runbook

## 목적

- 이 문서는 `posts`를 정본으로 유지하고 `post_metadata`를 shadow/확장 계층으로 운용한 뒤,
  안정화 기간이 지난 후 중복 shadow 필드와 관련 코드를 정리할지 판단하기 위한 실행 절차다.
- 기준일은 **2026-03-21 이후**다.
- 이 문서는 바로 컬럼을 지우기 위한 문서가 아니다.
  먼저 `drift가 정말 0인지`, `새로 쓰이는 데이터도 계속 일치하는지`, `MCP read v1이 운영에서 문제 없는지`
  확인한 뒤 cleanup으로 넘어가기 위한 문서다.

## 현재 기준

- 정본(canonical source): `posts`
- shadow 대상: `post_metadata`
- 이미 배포된 보정 요소:
  - shadow sync service
  - search vector 공통 서비스
  - backfill migration `BackfillPostMetadataShadowFields1805401000000`
  - MCP read v1 endpoint/tool

## 정확히 언제 실행하나

- 권장 시작 시점: **2026-03-21 ~ 2026-03-28**
- 전제:
  - migration이 이미 적용되어 있어야 함
  - 그 사이 운영에서 create/update/publish/unpublish/search/reindex/MCP read가 실제로 사용되어야 함
  - 긴급 hotfix로 posts/post_metadata write path가 다시 변경되지 않았어야 함

## 최종 목표

1. 운영에서 shadow drift가 0인지 확인
2. 새로 생성/수정된 포스트도 drift가 생기지 않는지 확인
3. MCP read v1과 기존 post 조회/검색이 정상인지 확인
4. 조건이 만족되면 shadow write 제거 및 `post_metadata`의 중복 컬럼 제거 작업을 시작

## 아직 제거하면 안 되는 것

- `posts`의 정본 필드
- `post_metadata`의 실제 메타 전용 필드:
  - `wordCount`
  - `readingTimeMinutes`
  - `lastEditedAt`
  - `editCount`
  - `isEditorPick`
  - `editorPickedAt`
- `content_rendered_at`은 별도 감사 전에는 제거하지 말 것

## 나중에 제거 후보인 shadow 필드

- `post_metadata.excerpt`
- `post_metadata.tags`
- `post_metadata.category`
- `post_metadata.content_type`
- `post_metadata.publishedAt`
- `post_metadata.processingError`
- `post_metadata.processingCompletedAt`
- `post_metadata.indexedAt`
- `post_metadata.searchVector`

## 1. 시작 전 확인

### 1-1. 코드 기준점 확인

다음 파일이 아직 source-of-truth 정책을 따르고 있는지 먼저 확인한다.

- [post-metadata-sync.service.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/services/post-metadata-sync.service.ts)
- [post-search-vector.service.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/services/post-search-vector.service.ts)
- [post-creator.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/services/post-creator.ts)
- [post-updater.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/services/post-updater.ts)
- [post-processing.processor.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/processors/post-processing.processor.ts)
- [search-indexing.service.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/search-indexing.service.ts)
- [mcp-proxy.controller.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/mcp/controllers/mcp-proxy.controller.ts)
- [PublishedPostsHandlers.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/mcp-proxy-server/src/core/handlers/PublishedPostsHandlers.ts)

### 1-2. migration 적용 상태 확인

```bash
pnpm --dir backend migration:status
```

정상 기준:

- `BackfillPostMetadataShadowFields1805401000000`가 `[X]` 상태여야 함

## 2. 운영 데이터 drift 확인

### 2-1. 전체 mismatch count

아래 SQL을 운영 DB에서 실행한다.

```sql
SELECT
  COUNT(*) FILTER (
    WHERE COALESCE(pm."excerpt", '') IS DISTINCT FROM COALESCE(p.excerpt, '')
  ) AS excerpt_mismatch,
  COUNT(*) FILTER (
    WHERE COALESCE(pm."tags", '[]'::jsonb) IS DISTINCT FROM COALESCE(p.tags, '[]'::jsonb)
  ) AS tags_mismatch,
  COUNT(*) FILTER (
    WHERE COALESCE(pm."category", '') IS DISTINCT FROM COALESCE(p.category, '')
  ) AS category_mismatch,
  COUNT(*) FILTER (
    WHERE COALESCE(pm."content_type", '') IS DISTINCT FROM COALESCE(p.content_type, '')
  ) AS content_type_mismatch,
  COUNT(*) FILTER (
    WHERE pm."publishedAt" IS DISTINCT FROM p."publishedAt"
  ) AS published_at_mismatch,
  COUNT(*) FILTER (
    WHERE COALESCE(pm."processingError", '') IS DISTINCT FROM COALESCE(p.processing_error, '')
  ) AS processing_error_mismatch,
  COUNT(*) FILTER (
    WHERE pm."processingCompletedAt" IS DISTINCT FROM p.processing_completed_at
  ) AS processing_completed_at_mismatch,
  COUNT(*) FILTER (
    WHERE pm."indexedAt" IS DISTINCT FROM p.indexed_at
  ) AS indexed_at_mismatch,
  COUNT(*) FILTER (
    WHERE COALESCE(pm."searchVector"::text, '') IS DISTINCT FROM COALESCE(p.search_vector::text, '')
  ) AS search_vector_mismatch
FROM posts p
LEFT JOIN post_metadata pm ON pm."postId" = p.id
WHERE p."isDeleted" = false;
```

정상 기준:

- 모든 mismatch가 `0`

### 2-2. 표본 확인

mismatch가 1건 이상이면 아래 SQL로 샘플을 본다.

```sql
SELECT
  p.id,
  p.slug,
  p."updatedAt",
  p.excerpt AS post_excerpt,
  pm."excerpt" AS metadata_excerpt,
  p.tags AS post_tags,
  pm."tags" AS metadata_tags,
  p.category AS post_category,
  pm."category" AS metadata_category,
  p.content_type AS post_content_type,
  pm."content_type" AS metadata_content_type,
  p."publishedAt" AS post_published_at,
  pm."publishedAt" AS metadata_published_at,
  p.processing_error AS post_processing_error,
  pm."processingError" AS metadata_processing_error,
  p.processing_completed_at AS post_processing_completed_at,
  pm."processingCompletedAt" AS metadata_processing_completed_at,
  p.indexed_at AS post_indexed_at,
  pm."indexedAt" AS metadata_indexed_at
FROM posts p
JOIN post_metadata pm ON pm."postId" = p.id
WHERE p."isDeleted" = false
  AND (
    COALESCE(pm."excerpt", '') IS DISTINCT FROM COALESCE(p.excerpt, '')
    OR COALESCE(pm."tags", '[]'::jsonb) IS DISTINCT FROM COALESCE(p.tags, '[]'::jsonb)
    OR COALESCE(pm."category", '') IS DISTINCT FROM COALESCE(p.category, '')
    OR COALESCE(pm."content_type", '') IS DISTINCT FROM COALESCE(p.content_type, '')
    OR pm."publishedAt" IS DISTINCT FROM p."publishedAt"
    OR COALESCE(pm."processingError", '') IS DISTINCT FROM COALESCE(p.processing_error, '')
    OR pm."processingCompletedAt" IS DISTINCT FROM p.processing_completed_at
    OR pm."indexedAt" IS DISTINCT FROM p.indexed_at
    OR COALESCE(pm."searchVector"::text, '') IS DISTINCT FROM COALESCE(p.search_vector::text, '')
  )
ORDER BY p."updatedAt" DESC
LIMIT 50;
```

## 3. 신규 write path 검증

오래된 데이터만 맞는지 보면 부족하다.
최근 2주 동안 실제로 생성/수정된 포스트가 계속 일치했는지도 확인해야 한다.

### 3-1. 최근 변경 데이터만 따로 확인

```sql
SELECT
  COUNT(*) FILTER (
    WHERE COALESCE(pm."excerpt", '') IS DISTINCT FROM COALESCE(p.excerpt, '')
  ) AS excerpt_mismatch,
  COUNT(*) FILTER (
    WHERE COALESCE(pm."tags", '[]'::jsonb) IS DISTINCT FROM COALESCE(p.tags, '[]'::jsonb)
  ) AS tags_mismatch,
  COUNT(*) FILTER (
    WHERE COALESCE(pm."category", '') IS DISTINCT FROM COALESCE(p.category, '')
  ) AS category_mismatch,
  COUNT(*) FILTER (
    WHERE COALESCE(pm."content_type", '') IS DISTINCT FROM COALESCE(p.content_type, '')
  ) AS content_type_mismatch,
  COUNT(*) FILTER (
    WHERE pm."publishedAt" IS DISTINCT FROM p."publishedAt"
  ) AS published_at_mismatch,
  COUNT(*) FILTER (
    WHERE pm."indexedAt" IS DISTINCT FROM p.indexed_at
  ) AS indexed_at_mismatch
FROM posts p
LEFT JOIN post_metadata pm ON pm."postId" = p.id
WHERE p."isDeleted" = false
  AND p."updatedAt" >= NOW() - INTERVAL '14 days';
```

정상 기준:

- 최근 14일 대상도 모두 `0`

### 3-2. 수동 시나리오

dev 또는 staging에서 아래를 직접 해본다.

1. MCP로 새 글 발행
2. 일반 수정 API로 제목/본문/태그/카테고리 수정
3. 비공개 전환 후 재공개 또는 publish 상태 변경
4. 검색 인덱스 재생성
5. MCP read로 목록/검색/단건 읽기

각 단계 직후 위 mismatch SQL을 다시 확인한다.

정상 기준:

- 시나리오 실행 후에도 mismatch `0`

## 4. 기능 회귀 확인

### 4-1. MCP read v1

다음이 모두 정상이어야 한다.

- `GET /api/v1/mcp/posts`
- `GET /api/v1/mcp/posts?search=...`
- `GET /api/v1/mcp/posts/:postId`
- generic MCP `/mcp`, `/mcp-remote`에서
  - `list_my_published_posts`
  - `search_my_published_posts`
  - `read_my_published_post`

확인 포인트:

- 본인 글만 반환되는지
- draft / deleted / 타인 글이 섞이지 않는지
- `publishedAt`, `excerpt`, `tags`, `category`가 기대값과 같은지

### 4-2. 기존 post read/search

다음도 같이 본다.

- 일반 post 상세 조회
- 내 글 목록
- public search
- related posts
- editor pick 관련 조회

확인 포인트:

- 정렬 기준이 깨지지 않았는지
- publish date가 null로 보이지 않는지
- search 결과가 create 직후와 reindex 후에 크게 달라지지 않는지

## 5. 판정 기준

### cleanup 진행 가능

아래를 모두 만족하면 cleanup 단계로 넘어간다.

1. 전체 mismatch가 `0`
2. 최근 14일 데이터 mismatch도 `0`
3. 수동 시나리오 후에도 mismatch가 다시 생기지 않음
4. MCP read v1 및 기존 post read/search 회귀 없음
5. 운영 에러 로그에 post metadata sync 관련 오류가 없음

### cleanup 진행 금지

아래 중 하나라도 해당되면 컬럼 제거 금지다.

- mismatch가 1건이라도 남음
- 신규 생성/수정 후 다시 drift가 생김
- MCP read 응답이 잘못됨
- search ranking 또는 publish date 정렬이 깨짐

## 6. 문제가 있으면 어떻게 수정하나

### 경우 A. 오래된 데이터만 mismatch

증상:

- 최근 14일은 `0`
- 전체 mismatch만 남아 있음

조치:

1. 즉시 컬럼 제거 작업은 중단
2. 아래 SQL로 운영 데이터만 다시 동기화
3. 재검증 후 `0`이 되면 cleanup 여부 재판단

```sql
UPDATE "post_metadata" pm
SET
  "excerpt" = p.excerpt,
  "tags" = COALESCE(p.tags, '[]'::jsonb),
  "category" = COALESCE(p.category, '기타'),
  "content_type" = COALESCE(p.content_type, 'html'),
  "publishedAt" = p."publishedAt",
  "processingError" = p.processing_error,
  "processingCompletedAt" = p.processing_completed_at,
  "indexedAt" = p.indexed_at,
  "searchVector" = p.search_vector,
  "updatedAt" = NOW()
FROM "posts" p
WHERE pm."postId" = p.id
  AND p."isDeleted" = false
  AND (
    COALESCE(pm."excerpt", '') IS DISTINCT FROM COALESCE(p.excerpt, '')
    OR COALESCE(pm."tags", '[]'::jsonb) IS DISTINCT FROM COALESCE(p.tags, '[]'::jsonb)
    OR COALESCE(pm."category", '') IS DISTINCT FROM COALESCE(p.category, '')
    OR COALESCE(pm."content_type", '') IS DISTINCT FROM COALESCE(p.content_type, '')
    OR pm."publishedAt" IS DISTINCT FROM p."publishedAt"
    OR COALESCE(pm."processingError", '') IS DISTINCT FROM COALESCE(p.processing_error, '')
    OR pm."processingCompletedAt" IS DISTINCT FROM p.processing_completed_at
    OR pm."indexedAt" IS DISTINCT FROM p.indexed_at
    OR COALESCE(pm."searchVector"::text, '') IS DISTINCT FROM COALESCE(p.search_vector::text, '')
  );
```

### 경우 B. 최근 14일 데이터도 mismatch

증상:

- 새 글이나 수정된 글에서 drift가 다시 생김

조치:

1. 컬럼 제거 작업 금지
2. 아래 write path를 우선 점검
   - [post-creator.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/services/post-creator.ts)
   - [post-updater.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/services/post-updater.ts)
   - [post-processing.processor.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/processors/post-processing.processor.ts)
   - [search-indexing.service.ts](/Users/sihyungpark/Desktop/code/my-blog-app-integ/backend/src/posts/search-indexing.service.ts)
3. 어떤 필드가 drift 나는지 먼저 표본으로 확인
4. write path 수정 후 수동 시나리오 재검증
5. 그 후에만 cleanup 재논의

## 7. 2주 후 실제 cleanup에서 해야 할 코드 수정

이 단계는 **위 판정 기준을 모두 만족할 때만** 진행한다.

### 7-1. write path 정리

다음 작업을 한다.

1. `PostMetadataSyncService` 사용 제거
2. `PostSearchVectorService`에서 `post_metadata.searchVector/indexedAt` 업데이트 제거
3. `post_creator`, `post_updater`, `post_processing_processor`, `search_indexing_service`에서
   shadow 필드 쓰기 제거
4. `post_metadata`는 메타 전용 필드만 저장하게 축소

### 7-2. read path 확인

다음이 아직 `post_metadata` shadow 필드를 읽지 않는지 확인한다.

- mapper
- repository query
- search query
- MCP response builder

### 7-3. DB schema cleanup migration

새 migration을 만들어 아래 후보 컬럼만 제거한다.

- `excerpt`
- `tags`
- `category`
- `content_type`
- `publishedAt`
- `processingError`
- `processingCompletedAt`
- `indexedAt`
- `searchVector`

주의:

- `wordCount`, `readingTimeMinutes`, `lastEditedAt`, `editCount`, `isEditorPick`, `editorPickedAt`, `content_rendered_at`은 이 migration에서 건드리지 말 것

### 7-4. cleanup 직후 확인

1. migration 적용
2. backend build
3. targeted test
4. MCP list/search/read 실제 호출
5. publish/update/reindex 수동 시나리오 재검증

## 8. 그때 실행할 권장 명령

```bash
pnpm --dir backend migration:status
pnpm --dir backend build
pnpm --dir backend test -- --runInBand src/mcp/controllers/mcp-proxy.controller.spec.ts src/posts/services/post-read.service.spec.ts
pnpm --dir mcp-proxy-server build
pnpm --dir mcp-proxy-server verify:tool-parity
```

cleanup 코드까지 들어갔다면 추가로:

```bash
pnpm --dir backend migration:run
```

## 9. 메모

- **2026-03-21에 바로 컬럼 삭제하지 않는다.**
- 먼저 관측값이 `0`인지 본다.
- 새로 쓰이는 데이터에서 drift가 다시 생기면 cleanup이 아니라 write path 수정이 우선이다.
- 이 작업의 목적은 저장공간 절감보다 `정합성 확보`와 `코드 단순화`다.
