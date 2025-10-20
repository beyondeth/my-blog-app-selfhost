# 댓글 페이지네이션 시스템 구현 완료

## 📋 개요

5,000명+ 커뮤니티 규모에 대응하는 고성능 댓글 페이지네이션 시스템을 구현했습니다.

## ✅ 구현 완료 항목

### 1. Backend (NestJS)

#### DB 마이그레이션
- **파일**: `backend/src/migrations/1760800000000-AddCommentPaginationIndexes.ts`
- **인덱스**:
  - `idx_comments_recent_parent`: 최신순 부모 댓글 (postId, createdAt DESC, id DESC)
  - `idx_comments_popular_parent`: 인기순 부모 댓글 (postId, likesCount DESC, createdAt DESC, id DESC)
  - `idx_comments_replies_recent`: 최신순 답글 (parentCommentId, createdAt ASC, id ASC)
  - `idx_comments_replies_popular`: 인기순 답글
  - `idx_comments_count`: 통계용 인덱스

#### DTOs
- `GetCommentsDto`: 페이지네이션 요청 DTO (cursor, limit, sort, snapshotTimestamp)
- `PaginatedCommentsDto`: 페이지네이션 응답 DTO (comments, nextCursor, hasNextPage, totalCount)
- `GetRepliesDto`: 답글 조회 DTO

#### Service 메서드
- `getParentCommentsPaginated()`: 부모 댓글 페이지네이션
- `getRepliesPaginated()`: 답글 페이지네이션
- `invalidateCommentsPaginationCache()`: 캐시 무효화
- 커서 인코딩/디코딩 헬퍼 메서드

#### Controller 엔드포인트
- `GET /api/v1/comments/post/:postId/paginated`: 부모 댓글 조회
- `GET /api/v1/comments/:commentId/replies`: 답글 조회
- 기존 API 유지 (하위 호환성)

#### Redis 캐싱
- 첫 페이지만 캐싱 (TTL: 10초)
- 캐시 키: `COMMENTS_PAGE_FIRST`, `COMMENT_REPLIES_FIRST`
- 댓글 작성/삭제/좋아요 시 자동 무효화

### 2. Frontend (Next.js + React)

#### API Client
- **파일**: `frontend/src/lib/api/endpoints/comments.ts`
- `getCommentsPaginated()`: 부모 댓글 페이지네이션 API
- `getRepliesPaginated()`: 답글 페이지네이션 API
- `PaginatedCommentsResponse` 타입 정의

#### React Query 훅
- **파일**: `frontend/src/hooks/useCommentsPaginated.ts`
- `useParentCommentsPaginated()`: 부모 댓글 무한 스크롤 훅
- `useRepliesPaginated()`: 답글 무한 스크롤 훅
- `useCreateCommentPaginated()`: 댓글 작성 mutation
- `useToggleCommentLikePaginated()`: 좋아요 토글 (인기순 캐시 무효화)
- `flattenPaginatedComments()`: 헬퍼 함수

#### 컴포넌트
- **파일**: `frontend/src/components/comments/CommentSectionPaginated.tsx`
  - 무한 스크롤 기반 부모 댓글 로드
  - 최신순/인기순 탭 전환
  - IntersectionObserver 기반 자동 다음 페이지 로드
  - 스냅샷 타임스탬프 관리

- **파일**: `frontend/src/components/comments/CommentItemPaginated.tsx`
  - 답글 lazy-load (버튼 클릭 시 로드)
  - 답글 무한 스크롤
  - 좋아요/싫어요 기능

## 🎯 핵심 최적화 전략

### 1. 커서 기반 페이지네이션
```typescript
// 커서 구조
{
  likesCount?: number,  // 인기순 정렬 시
  createdAt: Date,
  id: string
}
```

### 2. 스냅샷 타임스탬프 (인기순 안정성)
- 인기순 정렬 시 첫 페이지 요청 시점의 타임스탬프 저장
- 이후 페이지는 동일 시점 기준으로 조회
- 좋아요 수 실시간 변경으로 인한 중복/누락 방지

### 3. Redis 캐싱 전략
- 첫 페이지만 캐싱 (10초 TTL)
- React Query staleTime: 0 (서버 캐시 의존)
- 댓글 mutation 시 관련 캐시 자동 무효화

### 4. 부모-답글 분리 페이지네이션
- 부모 댓글: 최신순/인기순 페이징
- 답글: lazy-load + 무한 스크롤
- 각각 독립적인 캐시 키 사용

## 📊 예상 성능

| 항목 | 기존 (전체 로드) | 개선 (페이징) | 개선율 |
|------|-----------------|--------------|--------|
| 초기 로딩 | 1,000~1,500ms | 150~250ms | 85% ↓ |
| 메모리 사용 | 전체 트리 | 페이지당 20개 | 95% ↓ |
| 캐시 히트율 | 50~60% | 85%+ | 50% ↑ |
| DB 쿼리 | N+1 문제 | 인덱스 최적화 | 5~10배 ↑ |

## 🚀 사용 방법

### 기존 컴포넌트 대체 (선택적)

```tsx
// Before
import CommentSection from '@/components/comments/CommentSection';

<CommentSection postId={postId} postAuthorId={post.author.id} />

// After (페이지네이션 버전 사용)
import CommentSectionPaginated from '@/components/comments/CommentSectionPaginated';

<CommentSectionPaginated postId={postId} postAuthorId={post.author.id} />
```

### 마이그레이션 실행

```bash
cd backend
pnpm migration:run
```

## 🔧 다음 단계

1. **마이그레이션 실행**
   ```bash
   cd backend
   pnpm migration:run
   ```

2. **백엔드 테스트**
   - 컴파일 확인
   - API 엔드포인트 테스트
   - 캐시 동작 확인

3. **프론트엔드 테스트**
   - 무한 스크롤 동작 확인
   - 탭 전환 테스트
   - 답글 lazy-load 테스트

4. **성능 테스트**
   - 5,000개 댓글 시나리오
   - 동시 접속자 부하 테스트
   - 캐시 히트율 모니터링

## 📌 주의사항

- **하위 호환성**: 기존 API (`GET /comments/post/:postId`)는 유지됩니다.
- **점진적 전환**: 새로운 페이지에서만 `CommentSectionPaginated` 사용 가능
- **캐시 정책**: Redis TTL 10초는 조정 가능 (CacheTTL.VERY_SHORT)

## 🐛 트러블슈팅

### 1. 마이그레이션 실패
```bash
# 마이그레이션 되돌리기
pnpm migration:revert
```

### 2. 캐시 동작 확인
```bash
# Redis 캐시 키 확인
docker exec my-blog-app-shared-redis redis-cli KEYS "cache:comments:*"
```

### 3. 인덱스 확인
```sql
-- PostgreSQL에서 인덱스 확인
SELECT indexname FROM pg_indexes WHERE tablename = 'comments';
```

## 📚 참고 자료

- ChatGPT 최적화 제안: 프로젝트 루트의 대화 내용 참조
- Redis 캐싱 전략: `backend/src/cache/cache.service.ts`
- React Query 패턴: `frontend/src/hooks/useCommentsPaginated.ts`

---

**구현 완료일**: 2025-10-20
**담당**: Claude Code
**버전**: v1.0
