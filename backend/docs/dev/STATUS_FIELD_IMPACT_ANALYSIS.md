# Post Status 필드 영향 분석 및 수정 계획

## 개요
Post 엔티티에 `status` 필드 추가로 인해 기존 쿼리들이 영향을 받음.
`isPublished = true` 조건만으로는 불충분하며, `status = 'published'` 조건도 함께 고려해야 함.

## Status 필드 정의
```typescript
status: 'draft' | 'processing' | 'published' | 'failed'
```

- **draft**: 임시 저장 (향후 확장용)
- **processing**: Fast Path 직후 백그라운드 처리 중
- **published**: Worker 처리 완료, 공개됨
- **failed**: 처리 실패

## 영향을 받는 쿼리 패턴

### 1. 공개 포스트 조회
**기존**: `isPublished = true`
**변경**: `isPublished = true AND status = 'published'`

**이유**:
- `processing` 상태의 포스트는 공개 리스트에 노출되지 않아야 함
- 처리 실패(`failed`) 포스트도 마찬가지로 비공개 유지

### 2. 검색 인덱싱
**기존**: `isPublished = true AND indexedAt IS NULL`
**변경**: `isPublished = true AND status = 'published' AND indexedAt IS NULL`

**이유**:
- `processing` 상태의 포스트는 아직 content 처리가 완료되지 않았으므로 인덱싱 대기
- Worker가 status를 'published'로 변경한 후에만 인덱싱

### 3. 캐시 워밍 쿼리
**기존**: `post.isPublished = true AND blog.isPublic = true`
**변경**: `post.isPublished = true AND post.status = 'published' AND blog.isPublic = true`

## 수정이 필요한 파일 목록

### 우선순위 1: 핵심 서비스 (즉시 수정 필요)

#### 1. `posts/posts.service.ts`
**영향받는 메서드**:
- `findAll()` - 전체 포스트 목록 조회
- `findPublishedPosts()` - 공개 포스트만 조회
- `findBySlug()` - Slug로 조회 (공개 포스트만)
- `findByBlogSlug()` - 블로그별 포스트 조회
- `findByTag()` - 태그별 조회
- `findPopularPosts()` - 인기 포스트 조회
- `searchPosts()` - 전문 검색
- `getEditorPicks()` - 에디터 추천 포스트

**수정 방법**:
```typescript
// Before
.where('post.isPublished = :isPublished', { isPublished: true })

// After
.where('post.isPublished = :isPublished AND post.status = :status', {
  isPublished: true,
  status: 'published'
})
```

#### 2. `posts/search-indexing.service.ts`
**영향받는 메서드**:
- `findUnindexedPosts()` (line 101-113)
- `countUnindexedPosts()` (line 118-125)
- `logIndexingMetrics()` (line 203-210)
- `reindexAll()` (line 267)

**수정 방법**:
```typescript
// Before
where: {
  indexedAt: IsNull(),
  isPublished: true,
}

// After
where: {
  indexedAt: IsNull(),
  isPublished: true,
  status: 'published',
}
```

#### 3. `cache/cache-warming.service.ts`
**영향받는 메서드**:
- `warmPopularPages()` (line 74-106)

**수정 방법**:
```typescript
// Before (line 102)
.where('post.isPublished = :isPublished', { isPublished: true })

// After
.where('post.isPublished = :isPublished AND post.status = :status', {
  isPublished: true,
  status: 'published'
})
```

### 우선순위 2: 관련 서비스

#### 4. `bookmarks/bookmarks.service.ts`
- 북마크된 포스트 조회 시 status 필터 추가

#### 5. `admin/dashboard/admin-dashboard.service.ts`
- 대시보드 통계에 status별 포스트 수 추가
- 처리 중/실패 포스트 모니터링 기능

#### 6. `admin/posts/admin-posts.service.ts`
- 관리자용 포스트 목록에 status 필터링 추가
- 실패한 포스트 재처리 기능

## 필요한 복합 인덱스

현재 migration에서 `status` 단일 인덱스만 생성됨.
추가 복합 인덱스 필요:

### 1. 공개 포스트 조회 최적화
```sql
CREATE INDEX idx_posts_published_status
ON posts (isPublished, status, publishedAt DESC)
WHERE isPublished = true AND status = 'published';
```

### 2. 인덱싱 대기 포스트 조회
```sql
CREATE INDEX idx_posts_indexing_pending
ON posts (isPublished, status, indexed_at)
WHERE isPublished = true AND status = 'published' AND indexed_at IS NULL;
```

### 3. 처리 상태 모니터링
```sql
CREATE INDEX idx_posts_processing_monitor
ON posts (status, createdAt DESC)
WHERE status IN ('processing', 'failed');
```

## 수정 작업 순서

1. ✅ Post 엔티티에 status 필드 추가 (완료)
2. ✅ Database Migration 실행 (완료)
3. **현재**: 기존 쿼리 수정
4. BullMQ Queue 인프라 설정
5. Background Worker 구현
6. createFast() 메서드 구현
7. 복합 인덱스 추가 (성능 테스트 후 결정)

## 테스트 계획

### 단위 테스트
- [ ] status 필터링이 적용된 각 쿼리 메서드 테스트
- [ ] processing 상태 포스트가 공개 목록에 나타나지 않는지 확인
- [ ] published 상태 포스트만 검색 인덱싱되는지 확인

### 통합 테스트
- [ ] Fast Path → Worker 플로우 전체 테스트
- [ ] 캐시 워밍 쿼리 성능 테스트
- [ ] 검색 인덱싱 배치 작업 테스트

### 성능 테스트
- [ ] 기존 인덱스로 충분한지 확인 (EXPLAIN ANALYZE)
- [ ] 복합 인덱스 추가 시 성능 개선 측정
- [ ] 동시 요청 처리 능력 테스트

## 주의사항

1. **하위 호환성**: 기존 포스트는 모두 status='published'로 설정되므로 문제 없음
2. **점진적 롤아웃**: status 필터 추가 → Worker 구현 → Fast Path 적용 순서로 진행
3. **모니터링**: processing 상태 포스트가 오래 유지되는지 모니터링 필요
4. **롤백 계획**: Worker 처리 실패 시 status를 'failed'로 변경하여 재처리 가능하도록

## 예상 소요 시간

- 쿼리 수정 (우선순위 1): **30분**
- 관련 서비스 수정 (우선순위 2): **20분**
- 테스트 및 검증: **20분**
- **총 예상 시간**: **70분**
