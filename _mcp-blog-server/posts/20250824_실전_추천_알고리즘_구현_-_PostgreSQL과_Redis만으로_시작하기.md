---
title: "실전 추천 알고리즘 구현 - PostgreSQL과 Redis만으로 시작하기"
tags: ["추천알고리즘", "PostgreSQL", "Redis", "콘텐츠기반필터링", "협업필터링", "캠싱", "성능최적화"]
date: 2025-08-24T18:28:11.167348
---

# 실전 추천 알고리즘 구현 - PostgreSQL과 Redis만으로 시작하기

값비싼 ML 인프라 없이도 효과적인 추천 시스템을 구현할 수 있습니다. PostgreSQL과 Redis만으로 실제 동작하는 추천 시스템을 만들어보겠습니다.

## 🛠️ 1인 개발자를 위한 최소 스택

### 필수 구성 요소 (월 $20-50)

**핵심 인프라:**
- **PostgreSQL + pgvector**: 벡터 유사도 계산
- **Redis**: 캐싱 및 실시간 데이터
- **Python/Node.js**: 백엔드 서버

**선택적 도구:**
- **Meilisearch**: 검색 + 추천 통합
- **MindsDB**: SQL로 ML 구현
- **Supabase Vector**: 임베딩 저장

## 📝 실용적인 구현 예시

### 1. 콘텐츠 기반 추천 (Content-Based Filtering)

```python
def get_content_recommendations(post_id):
    """
    비용: PostgreSQL 쿼리 비용만
    성능: 100ms 이내
    """
    current_post = get_post(post_id)
    
    # 같은 카테고리 + 태그 유사도
    similar_posts = db.query("""
        SELECT p.*, 
               (SELECT COUNT(*) FROM unnest(p.tags) 
                INTERSECT 
                SELECT unnest(%s)) as common_tags
        FROM posts p
        WHERE p.category = %s
        AND p.id != %s
        ORDER BY common_tags DESC, views DESC
        LIMIT 10
    """, [current_post.tags, current_post.category, post_id])
    
    return similar_posts
```

### 2. 사용자 행동 기반 추천

```python
def get_user_based_recommendations(user_id):
    """
    비용: Redis 캐싱으로 최소화
    성능: 캐시 히트 시 10ms
    """
    # 캐시 확인
    cached = redis.get(f"rec:{user_id}")
    if cached:
        return json.loads(cached)
    
    # 사용자가 본 포스트들의 카테고리/태그 분석
    user_interests = analyze_user_history(user_id)
    
    # 관심사 기반 추천
    recommendations = db.query("""
        SELECT * FROM posts
        WHERE category = ANY(%s)
        OR tags && %s
        ORDER BY 
            CASE WHEN author_id IN (
                SELECT following_id FROM follows 
                WHERE user_id = %s
            ) THEN 1 ELSE 0 END DESC,
            created_at DESC
        LIMIT 20
    """, [user_interests.categories, 
         user_interests.tags, 
         user_id])
    
    # 24시간 캐싱
    redis.setex(f"rec:{user_id}", 86400, 
                json.dumps(recommendations))
    return recommendations
```

### 3. 협업 필터링 구현 (Collaborative Filtering)

```python
def get_collaborative_recommendations(user_id):
    """
    유사한 사용자들이 좋아한 콘텐츠 추천
    """
    # Step 1: 유사한 사용자 찾기
    similar_users = db.query("""
        WITH user_likes AS (
            SELECT post_id FROM likes WHERE user_id = %s
        )
        SELECT 
            l.user_id,
            COUNT(*) as common_likes
        FROM likes l
        WHERE l.post_id IN (SELECT post_id FROM user_likes)
        AND l.user_id != %s
        GROUP BY l.user_id
        ORDER BY common_likes DESC
        LIMIT 50
    """, [user_id, user_id])
    
    # Step 2: 유사 사용자들이 좋아한 포스트
    recommendations = db.query("""
        SELECT DISTINCT p.*,
               COUNT(l.user_id) as like_count
        FROM posts p
        JOIN likes l ON p.id = l.post_id
        WHERE l.user_id = ANY(%s)
        AND p.id NOT IN (
            SELECT post_id FROM likes WHERE user_id = %s
        )
        AND p.id NOT IN (
            SELECT post_id FROM views WHERE user_id = %s
        )
        GROUP BY p.id
        ORDER BY like_count DESC
        LIMIT 20
    """, [similar_users, user_id, user_id])
    
    return recommendations
```

## 🚀 점진적 구현 전략

### Phase 1: 인기도 기반 (비용: $0)

```python
class PopularityRecommender:
    def get_trending(self, hours=24):
        """최근 N시간 동안 인기 있는 포스트"""
        return db.query("""
            SELECT p.*, 
                   COUNT(v.id) as recent_views
            FROM posts p
            LEFT JOIN views v ON p.id = v.post_id
            WHERE v.created_at > NOW() - INTERVAL '%s hours'
            GROUP BY p.id
            ORDER BY recent_views DESC
            LIMIT 10
        """, [hours])
    
    def get_popular_by_category(self, category):
        """카테고리별 인기 포스트"""
        return db.query("""
            SELECT * FROM posts
            WHERE category = %s
            ORDER BY 
                (likes_count * 2 + views_count) DESC
            LIMIT 10
        """, [category])
```

### Phase 2: 개인화 추가 (비용: $10-20/월)

```python
class PersonalizedRecommender:
    def __init__(self):
        self.redis = Redis()
        
    def track_user_action(self, user_id, action, item_id):
        """사용자 행동 추적"""
        key = f"user:{user_id}:actions"
        
        # 가중치 적용
        weight = {
            'view': 1,
            'like': 3,
            'comment': 5,
            'share': 10
        }.get(action, 1)
        
        self.redis.zincrby(key, weight, item_id)
        self.redis.expire(key, 30 * 86400)  # 30일 보관
    
    def get_personalized(self, user_id):
        """개인화된 추천"""
        # 사용자 선호도 가져오기
        user_preferences = self.redis.zrevrange(
            f"user:{user_id}:actions", 0, -1, withscores=True
        )
        
        if not user_preferences:
            # 신규 사용자는 인기 콘텐츠
            return self.get_popular()
        
        # 선호도 기반 추천
        return self.recommend_based_on_preferences(
            user_preferences
        )
```

### Phase 3: 벡터 임베딩 활용 (비용: $50-100/월)

```python
class VectorRecommender:
    def create_embeddings(self, text):
        """텍스트를 벡터로 변환"""
        # OpenAI API 또는 로컬 모델 사용
        # 여기서는 간단한 TF-IDF 예시
        from sklearn.feature_extraction.text import TfidfVectorizer
        
        vectorizer = TfidfVectorizer(max_features=100)
        vectors = vectorizer.fit_transform([text])
        return vectors.toarray()[0]
    
    def find_similar_posts(self, post_id, limit=10):
        """pgvector를 사용한 유사 포스트 검색"""
        return db.query("""
            SELECT 
                id,
                title,
                1 - (embedding <=> (
                    SELECT embedding FROM posts WHERE id = %s
                )) as similarity
            FROM posts
            WHERE id != %s
            ORDER BY embedding <=> (
                SELECT embedding FROM posts WHERE id = %s
            )
            LIMIT %s
        """, [post_id, post_id, post_id, limit])
```

## 💾 효율적인 캐싱 전략

### 다층 캐싱 구조

```python
class MultiLayerCache:
    def __init__(self):
        self.memory_cache = {}  # 인메모리 (1분)
        self.redis = Redis()    # Redis (1시간)
        self.db_cache = {}      # DB (24시간)
    
    def get_recommendations(self, user_id):
        # L1: 메모리 캐시
        if user_id in self.memory_cache:
            if time.time() - self.memory_cache[user_id]['time'] < 60:
                return self.memory_cache[user_id]['data']
        
        # L2: Redis 캐시
        redis_key = f"rec:{user_id}"
        cached = self.redis.get(redis_key)
        if cached:
            data = json.loads(cached)
            self.memory_cache[user_id] = {
                'data': data,
                'time': time.time()
            }
            return data
        
        # L3: 실제 계산
        recommendations = self.calculate_recommendations(user_id)
        
        # 캐시 저장
        self.redis.setex(redis_key, 3600, 
                        json.dumps(recommendations))
        self.memory_cache[user_id] = {
            'data': recommendations,
            'time': time.time()
        }
        
        return recommendations
```

## 📊 성능 최적화 팁

### 1. 인덱스 최적화

```sql
-- 추천 쿼리를 위한 인덱스
CREATE INDEX idx_posts_category_created 
ON posts(category, created_at DESC);

CREATE INDEX idx_posts_tags 
ON posts USING gin(tags);

CREATE INDEX idx_views_user_post 
ON views(user_id, post_id);

CREATE INDEX idx_likes_user_post 
ON likes(user_id, post_id);
```

### 2. 배치 처리로 부하 분산

```python
# 크론잡으로 새벽에 실행
def batch_calculate_recommendations():
    """모든 활성 사용자의 추천 미리 계산"""
    active_users = get_active_users_last_7_days()
    
    for user in active_users:
        recommendations = calculate_user_recommendations(user.id)
        
        # Redis에 저장 (24시간)
        redis.setex(
            f"daily_rec:{user.id}",
            86400,
            json.dumps(recommendations)
        )
        
        # 부하 분산을 위한 딜레이
        time.sleep(0.1)
```

### 3. 실시간과 배치의 균형

```python
class HybridRecommendationService:
    def get_recommendations(self, user_id, context):
        # 기본: 미리 계산된 추천
        base_recommendations = self.get_cached_recommendations(user_id)
        
        # 실시간: 컨텍스트 기반 조정
        if context.get('current_category'):
            # 현재 보고 있는 카테고리 가중치 증가
            base_recommendations = self.boost_category(
                base_recommendations,
                context['current_category']
            )
        
        if context.get('time_of_day'):
            # 시간대별 선호도 반영
            base_recommendations = self.apply_time_preference(
                base_recommendations,
                context['time_of_day']
            )
        
        return base_recommendations[:10]
```

## 🎯 핵심 성공 지표

### 측정해야 할 메트릭

1. **추천 클릭률 (CTR)**: 추천된 콘텐츠 클릭 비율
2. **체류 시간**: 추천 콘텐츠에서의 평균 체류 시간
3. **재방문율**: 추천 시스템 도입 후 재방문 증가율
4. **다양성 지표**: 추천 콘텐츠의 카테고리 분포

```python
def track_recommendation_metrics(user_id, recommended_items, clicked_item):
    """추천 성능 추적"""
    # CTR 계산
    redis.hincrby('metrics:recommendations', 'total', len(recommended_items))
    if clicked_item in recommended_items:
        redis.hincrby('metrics:recommendations', 'clicks', 1)
    
    # 다양성 측정
    categories = [item.category for item in recommended_items]
    diversity_score = len(set(categories)) / len(categories)
    redis.hset('metrics:diversity', user_id, diversity_score)
```

## 결론

PostgreSQL과 Redis만으로도 충분히 효과적인 추천 시스템을 구현할 수 있습니다. 핵심은:

1. **단순하게 시작**: 인기도 기반으로 시작
2. **데이터 수집**: 사용자 행동 추적
3. **점진적 개선**: 개인화 → 협업 필터링 → ML
4. **캐싱 활용**: 계산 비용 최소화
5. **측정과 개선**: 지속적인 성능 모니터링

완벽한 추천보다 빠른 시작이 중요합니다. 지금 바로 구현해보세요!