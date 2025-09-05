# 🚀 데이터베이스 기술적 개선 가이드

## 🎯 핵심 성능 병목 지점 분석

### 1. N+1 쿼리 문제 해결

#### 현재 문제점
```typescript
// ❌ 현재: N+1 쿼리 발생
// posts 조회 시 author, blog 정보 각각 쿼리
@OneToMany(() => Post, post => post.author, { lazy: true })
posts: Promise<Post[]>;
```

#### 개선 방안
```typescript
// ✅ 개선: Eager Loading 또는 Query Builder 사용
// posts.service.ts
async findAllWithRelations() {
  return this.postRepository
    .createQueryBuilder('post')
    .leftJoinAndSelect('post.author', 'author')
    .leftJoinAndSelect('post.blog', 'blog')
    .leftJoinAndSelect('post.comments', 'comments')
    .where('post.isPublished = :published', { published: true })
    .orderBy('post.publishedAt', 'DESC')
    .getMany();
}
```

### 2. 쿼리 최적화 패턴

#### 복잡한 집계 쿼리 개선
```sql
-- ❌ 현재: 비효율적인 서브쿼리
SELECT 
  p.*,
  (SELECT COUNT(*) FROM comments WHERE postId = p.id) as comment_count,
  (SELECT COUNT(*) FROM post_likes WHERE postId = p.id) as like_count
FROM posts p;

-- ✅ 개선: JOIN과 GROUP BY 사용
SELECT 
  p.*,
  COUNT(DISTINCT c.id) as comment_count,
  COUNT(DISTINCT pl.userId) as like_count
FROM posts p
LEFT JOIN comments c ON c.postId = p.id
LEFT JOIN post_likes pl ON pl.postId = p.id
GROUP BY p.id;
```

### 3. 데이터베이스 레벨 최적화

#### 컬럼 타입 최적화
```sql
-- 현재 분석
ALTER TABLE posts ALTER COLUMN content TYPE TEXT; -- 무제한
ALTER TABLE posts ALTER COLUMN tags TYPE TEXT[]; -- 배열

-- 개선 제안
ALTER TABLE posts ADD COLUMN content_preview VARCHAR(500); -- 미리보기용
CREATE TABLE post_tags (
  post_id UUID,
  tag_id UUID,
  PRIMARY KEY(post_id, tag_id)
); -- 정규화
```

---

## 🔍 상세 인덱스 전략

### 1. 커버링 인덱스 구현
```sql
-- 자주 사용되는 쿼리에 대한 커버링 인덱스
CREATE INDEX idx_posts_covering ON posts(
  blogId, 
  isPublished, 
  publishedAt DESC
) INCLUDE (title, thumbnail, viewCount, likeCount);

-- 알림 조회 최적화
CREATE INDEX idx_notifications_covering ON notifications(
  recipientId,
  read,
  createdAt DESC  
) INCLUDE (type, message, issuerId);
```

### 2. 부분 인덱스 활용
```sql
-- 활성 사용자만 인덱싱
CREATE INDEX idx_users_active ON users(email, username) 
WHERE isActive = true AND isEmailVerified = true;

-- 공개 포스트만 인덱싱
CREATE INDEX idx_posts_public ON posts(publishedAt DESC, viewCount DESC)
WHERE isPublished = true;

-- 읽지 않은 알림만 인덱싱
CREATE INDEX idx_notifications_unread ON notifications(recipientId, createdAt DESC)
WHERE read = false;
```

### 3. 복합 인덱스 순서 최적화
```sql
-- 카디널리티 고려한 인덱스 순서
-- 카디널리티: userId(높음) > fileType(낮음) > createdAt(높음)
CREATE INDEX idx_files_optimized ON files(userId, fileType, createdAt DESC);

-- 범위 검색 컬럼은 마지막에
CREATE INDEX idx_posts_search ON posts(blogId, category, createdAt DESC);
```

---

## 💾 캐싱 전략

### 1. Redis 캐싱 구조
```typescript
// 캐시 키 전략
const CACHE_KEYS = {
  POST_LIST: (blogId: string) => `posts:blog:${blogId}:list`,
  POST_DETAIL: (id: string) => `posts:${id}:detail`,
  USER_PROFILE: (id: string) => `users:${id}:profile`,
  POPULAR_POSTS: 'posts:popular:daily',
  TRENDING_TAGS: 'tags:trending:weekly',
};

// TTL 전략
const CACHE_TTL = {
  POST_LIST: 300,      // 5분
  POST_DETAIL: 3600,   // 1시간
  USER_PROFILE: 1800,  // 30분
  POPULAR_POSTS: 900,  // 15분
  TRENDING_TAGS: 3600, // 1시간
};
```

### 2. 캐시 무효화 전략
```typescript
// 이벤트 기반 캐시 무효화
class CacheInvalidator {
  @OnEvent('post.created')
  async handlePostCreated(event: PostCreatedEvent) {
    await this.redis.del(`posts:blog:${event.blogId}:list`);
    await this.redis.del('posts:popular:daily');
  }

  @OnEvent('post.updated')
  async handlePostUpdated(event: PostUpdatedEvent) {
    await this.redis.del(`posts:${event.postId}:detail`);
    await this.redis.del(`posts:blog:${event.blogId}:list`);
  }
}
```

---

## 🌐 다국어 지원 구현

### 1. 번역 테이블 구조
```sql
-- 콘텐츠 번역 테이블
CREATE TABLE content_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  translated_value TEXT,
  is_auto_translated BOOLEAN DEFAULT false,
  translator_id UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(entity_type, entity_id, language_code, field_name),
  INDEX idx_entity_lookup (entity_type, entity_id, language_code)
);

-- 언어 설정 테이블
CREATE TABLE supported_languages (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100),
  native_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_rtl BOOLEAN DEFAULT false,
  fallback_language VARCHAR(10) DEFAULT 'en'
);
```

### 2. TypeORM 엔티티 구현
```typescript
@Entity('content_translations')
export class ContentTranslation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string;

  @Column('uuid')
  entityId: string;

  @Column({ length: 10 })
  languageCode: string;

  @Column({ length: 50 })
  fieldName: string;

  @Column('text', { nullable: true })
  translatedValue: string;

  @Column({ default: false })
  isAutoTranslated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

---

## 📊 모니터링 및 분석

### 1. 슬로우 쿼리 로깅
```sql
-- PostgreSQL 설정
ALTER SYSTEM SET log_min_duration_statement = 100; -- 100ms 이상 쿼리 로깅
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
SELECT pg_reload_conf();

-- 슬로우 쿼리 분석 뷰
CREATE VIEW slow_queries AS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;
```

### 2. 인덱스 사용률 모니터링
```sql
-- 사용되지 않는 인덱스 찾기
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 인덱스 히트율 확인
SELECT 
  tablename,
  100 * idx_scan / (seq_scan + idx_scan) as index_hit_rate
FROM pg_stat_user_tables
WHERE seq_scan + idx_scan > 0
ORDER BY index_hit_rate ASC;
```

### 3. 테이블 팽창(Bloat) 모니터링
```sql
-- 테이블 팽창 확인
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
  round(100 * pg_total_relation_size(schemaname||'.'||tablename) / pg_database_size(current_database()))::numeric, 2) as percent_of_db
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

---

## 🔄 마이그레이션 실행 계획

### Phase 1: 즉시 적용 (무중단)
```bash
# 1. 인덱스 생성 (CONCURRENTLY 옵션으로 무중단)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < phase1_indexes.sql

# 2. 통계 정보 갱신
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "ANALYZE;"

# 3. 캐시 레이어 배포
kubectl apply -f redis-deployment.yaml
npm run deploy:cache-service
```

### Phase 2: 점진적 적용 (Blue-Green)
```bash
# 1. 새 스키마로 마이그레이션
npm run migration:generate -- AddGlobalFeatures
npm run migration:run

# 2. 듀얼 라이트 (기존 + 새 구조)
npm run deploy:dual-write

# 3. 데이터 마이그레이션
npm run migrate:data -- --batch-size=1000

# 4. 검증 후 전환
npm run switch:to-new-schema
```

### Phase 3: 샤딩 준비
```sql
-- 1. 샤드 키 추가
ALTER TABLE users ADD COLUMN shard_id INT DEFAULT 0;
ALTER TABLE posts ADD COLUMN shard_id INT DEFAULT 0;

-- 2. 샤드별 라우팅 함수
CREATE OR REPLACE FUNCTION get_shard_id(user_id UUID)
RETURNS INT AS $$
BEGIN
  RETURN abs(hashtext(user_id::text)) % 4; -- 4개 샤드
END;
$$ LANGUAGE plpgsql;

-- 3. 트리거로 자동 샤드 할당
CREATE TRIGGER set_shard_id_trigger
BEFORE INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION set_shard_id();
```

---

## 📈 성능 벤치마크

### 예상 개선 효과
```yaml
인덱스 최적화:
  - 포스트 목록 조회: 50ms → 5ms (90% 개선)
  - 사용자 검색: 200ms → 20ms (90% 개선)
  - 알림 조회: 100ms → 10ms (90% 개선)

캐싱 적용:
  - 캐시 히트율: 0% → 80%
  - API 응답 시간: 평균 30% 감소
  - DB 부하: 70% 감소

쿼리 최적화:
  - N+1 제거: 쿼리 수 95% 감소
  - 집계 쿼리: 500ms → 50ms (90% 개선)
  
전체 시스템:
  - 동시 접속자: 100 → 10,000 (100배 증가)
  - 응답 시간: P95 < 100ms
  - 가용성: 99.9% → 99.99%
```

### 부하 테스트 시나리오
```javascript
// k6 부하 테스트 스크립트
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // 램프업
    { duration: '5m', target: 100 },  // 유지
    { duration: '2m', target: 200 },  // 스파이크
    { duration: '5m', target: 200 },  // 유지
    { duration: '2m', target: 0 },    // 램프다운
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // 95%가 100ms 이하
    http_req_failed: ['rate<0.1'],    // 에러율 10% 미만
  },
};

export default function() {
  let response = http.get('https://api.myblog.com/posts');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
  sleep(1);
}
```

이 기술적 개선 가이드를 통해 데이터베이스 성능을 획기적으로 향상시키고 글로벌 서비스를 위한 견고한 기반을 구축할 수 있습니다.