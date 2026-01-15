# Feed Performance Plan

## 1. Index Strategy

| 대상 | 목적 | 작업 |
| --- | --- | --- |
| `community_posts(createdAt, id)` | 홈 피드 최신순 정렬을 인덱스 스캔으로 처리 | `idx_community_posts_home` 추가 (partial index, `status='published'` AND `deletedAt IS NULL`) |
| `community_posts(likeCount, commentCount, createdAt)` | 인기/Top 정렬 대비 | `idx_community_posts_hot_global` 추가 (partial index) |
| `post_stats(likeCount, commentCount)` | 블로그 포스트 Top/Hot 정렬 대비 | `idx_post_stats_hot_global` 추가 |

*TypeORM migration*: `backend/src/migrations/1785000000000-AddFeedSortingIndexes.ts`

## 2. Query Plan Measurements

### 최신순 (`sort=recent`)
- `EXPLAIN (ANALYZE, BUFFERS)` 결과 `Limit → Sort(top-N heapsort) → Append` 경로
- Buffers: shared hit 104, 실제 실행 시간 2.2ms (로컬 dev DB, 162 rows 기준)
- 결론: 인덱스만으로 충분히 처리 가능

### 인기순 (`sort=hot`)
- 정렬 키: `like_count + comment_count`
- 결과: `Sort(top-N heapsort)` 직전에 `Append`가 실행되고 각 소스는 Hash/Seq Scan (shared hit 104, 1.4ms)
- 병목: 계산식 정렬 → 인덱스 사용 불가

### TOP (`sort=top`)
- 정렬 키: `like_count DESC, comment_count DESC, created_at DESC`
- 결과: `Sort(top-N heapsort)` (실행 시간 1.3ms, shared hit 104)
- 부분 인덱스가 없으므로 full sort 발생

## 3. Roadmap

### 3.1. 단기 (즉시 적용)
- 위 인덱스들을 운영에 반영
- 정렬 쿼리 검사 자동화 (EXPLAIN 결과를 Grafana/Loki 등에 저장)

### 3.2. 중기 (트래픽 ↑)
- **Redis TTL 캐시**  
  - 최신순: Key `feed:recent:<cursor>` → TTL 5~30초  
  - 무효화: 새 글 등록/삭제 시 해당 키 삭제
- **Hot/Top Score Pre-compute**  
  - `BullMQ` 워커가 일정 주기마다 `score = log(1+like) + 0.5·log(1+comment) - decay` 계산  
  - 결과를 `Redis Sorted Set` 또는 `feed_rankings` 테이블에 저장  
  - API는 DB 대신 캐시를 조회하여 정렬 부하 제거

### 3.3. 장기 (대규모)
- **Feed Service 분리**
  - 블로그/커뮤니티/추천 피드를 별도 마이크로 서비스로 나눔
  - ElasticSearch 혹은 벡터DB 기반 추천 시스템 연동
- **개인화 추천**
  - 사용자 행동 이벤트 → Feature Store → 모델 추론 → Personalized ranking

## 4. 운영 지표
- 피드 API P95 latency
- 캐시 HIT/MISS
- 워커 처리 지연
- 인덱스/ANALYZE 통계 체크 (Autovacuum)

본 문서를 기준으로 단계별로 성능 개선을 진행하고, 각 단계 완료 시 EXPLAIN 및 대시보드 지표를 업데이트합니다.

## 5. Redis TTL & Warming Implementation

- 통합 피드 캐시는 `CacheKeys.FEED_UNIFIED(filter, sort, { limit, cursor })` 표준 키를 사용하며, 키 내부 커서는 MD5 해시로 축약되어 Redis 메모리를 절약한다.
- `FeedService`는 사용자 컨텍스트가 없을 때만 `CacheTTL.HOME_FEED(30s)`으로 캐시를 기록하고, 동일 키 요청은 곧바로 반환된다.
- `FeedCacheWarmingService`(`backend/src/feed/feed-cache-warming.service.ts`)가 30초 주기로 `recent/hot/top` 1페이지를 사전 로딩하여 냉 캐시 구간을 줄인다. `DISABLE_FEED_WARMING=true`로 비활성화 가능.
- `CacheInvalidationListener`가 `feed:unified:*` 패턴을 함께 삭제하여 게시/수정/삭제 이벤트에 즉시 반응한다.
- 커뮤니티 상세 피드(`CommunityPostService.findAll`)도 동일한 원칙을 적용하여 `community:<id>:posts:<sort>:limit:<n>:first` 키로 초기 페이지 데이터를 30초 캐시하고, 검색·필터·로그인 사용자가 포함된 경우에는 캐시하지 않는다. 기존의 `invalidatePostListCache`가 `community:<id>:posts:*` 패턴을 지우므로 별도 무효화 코드 추가 없이 연동된다.
- 커뮤니티 게시물 API는 홈피드와 동일한 커서 기반 페이지네이션(JSON 커서를 base64로 인코딩)을 사용하므로, 프런트는 `nextCursor`만으로 무한 스크롤을 구현하고, 서버는 `(정렬 값, createdAt, id)` 조합으로 안정적인 정렬/필터를 유지한다.
- `CommunityFeedWarmingService`(`backend/src/communities/community-feed-warming.service.ts`)는 상위 커뮤니티(postCount 기준) 3곳의 최신/인기/TOP 첫 페이지를 45초 주기로 워밍하며, `COMMUNITY_FEED_WARM_LIMIT`와 `DISABLE_COMMUNITY_FEED_WARMING`으로 동작을 제어한다.

## 6. Hot/Top Worker Blueprint

1. **BullMQ Ranking Queue**
   - Queue: `feed-ranking`
   - Job payload: `{ postId, source: 'blog' | 'community', likeCount, commentCount, createdAt }`
   - Producer: `post_stats` & `community_posts` 트리거 또는 cron이 1분 주기로 변경분 enqueue.

2. **Worker Responsibilities**
   - 점수 계산: `score = log1p(likeCount) * 0.6 + log1p(commentCount) * 0.4 - decay(createdAt)`
   - Redis Sorted Set 업데이트: `zadd feed:ranking:hot <score> <resourceKey>`
   - TTL 보조 저장소: `feed_rankings` 테이블(Optional)로 최근 스코어 스냅샷 유지.

3. **API Integration**
   - `FeedService.executeUnifiedQuery`는 `sort=hot/top` 시 Redis Sorted Set에서 ID 리스트를 먼저 가져오고, 부족분만 DB에서 채운다.
   - 캐시 키는 `feed:ranking:<strategy>:cursor:<hash>` 패턴으로 분리하여 일반 최신순 캐시와 충돌 방지.

4. **Operational Notes**
   - 워커 Health (BullMQ) + Redis Sorted Set 메모리 사용량을 Grafana에 노출.
   - Fallback: Sorted Set 미스 시 기존 DB 정렬 경로 실행 후 결과를 워커 큐에 enqueue하여 자동 학습.
