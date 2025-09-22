# 🧠 블로그 SaaS 플랫폼 사용자별 특화 추천 알고리즘 시스템 설계

## 📊 Executive Summary

블로그 SaaS 플랫폼에서 사용자 체류 시간과 재방문을 극대화하기 위한 개인화된 추천 알고리즘 시스템 설계 문서입니다. 본 시스템은 사용자의 행동 패턴, 관심사, 상호작용 이력을 분석하여 각 사용자에게 최적화된 콘텐츠를 제공합니다.

### 핵심 목표
- **체류 시간 증대**: 평균 세션 시간 40% 증가
- **재방문율 향상**: DAU/MAU 비율 25% 개선
- **사용자 만족도**: 관련성 스코어 85% 이상
- **플랫폼 활성화**: 사용자당 일일 평균 조회수 5배 증가

---

## 🏗️ 시스템 아키텍처

### 1. 계층 구조

```
┌─────────────────────────────────────────────────────┐
│                   Frontend Layer                     │
│         (Next.js - 개인화된 UI/UX)                   │
├─────────────────────────────────────────────────────┤
│                    API Gateway                       │
│         (NestJS - 추천 엔드포인트)                   │
├─────────────────────────────────────────────────────┤
│              Recommendation Engine                   │
│   ┌─────────────┬───────────┬─────────────┐        │
│   │  실시간     │   배치    │    ML       │        │
│   │  처리       │   처리    │   파이프라인│        │
│   └─────────────┴───────────┴─────────────┘        │
├─────────────────────────────────────────────────────┤
│                  Data Layer                          │
│   ┌──────────────┬───────────┬──────────┐          │
│   │ PostgreSQL   │  Redis    │  S3      │          │
│   │ (영구저장)   │  (캐시)   │ (모델)   │          │
│   └──────────────┴───────────┴──────────┘          │
└─────────────────────────────────────────────────────┘
```

---

## 📈 Phase 1: 사용자 행동 데이터 수집 시스템

### 1.1 수집 대상 데이터

#### 명시적 신호 (Explicit Signals)
```typescript
interface ExplicitSignals {
  // 직접적인 사용자 액션
  likes: string[];           // 좋아요한 포스트 ID
  comments: Comment[];        // 작성한 댓글
  follows: string[];          // 팔로우한 블로그/사용자
  bookmarks: string[];        // 북마크한 포스트
  shares: ShareAction[];      // 공유한 콘텐츠
}
```

#### 암묵적 신호 (Implicit Signals)
```typescript
interface ImplicitSignals {
  // 간접적인 행동 패턴
  viewHistory: ViewEvent[];   // 조회 이력
  readTime: ReadTimeEvent[];  // 읽기 시간
  scrollDepth: number;         // 스크롤 깊이 (%)
  returnVisits: number;        // 재방문 횟수
  searchQueries: string[];     // 검색어
  categoryClicks: CategoryClick[];  // 카테고리 클릭
  deviceContext: DeviceInfo;   // 디바이스 정보
}
```

### 1.2 데이터 수집 구현

#### Backend: 이벤트 트래킹 엔티티
```typescript
// backend/src/analytics/entities/user-event.entity.ts
@Entity('user_events')
@Index(['userId', 'eventType', 'createdAt'])
@Index(['targetId', 'targetType'])
export class UserEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  eventType: EventType; // view, read, like, comment, share, etc.

  @Column({ type: 'varchar', length: 50 })
  targetType: TargetType; // post, blog, user, category

  @Column('uuid')
  targetId: string;

  @Column('jsonb', { nullable: true })
  metadata: {
    duration?: number;        // 체류 시간 (초)
    scrollDepth?: number;     // 스크롤 깊이 (%)
    referrer?: string;        // 유입 경로
    deviceType?: string;      // mobile, desktop, tablet
    searchQuery?: string;     // 검색어 (검색 유입시)
    position?: number;        // 노출 순위
    sessionId?: string;       // 세션 식별자
  };

  @Column({ type: 'float', default: 1.0 })
  weight: number; // 이벤트 가중치 (중요도)

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date; // 배치 처리 시점

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
```

#### Frontend: 사용자 행동 트래킹
```typescript
// frontend/src/services/analytics.service.ts
class AnalyticsService {
  private sessionId = generateSessionId();
  private eventQueue: UserEvent[] = [];
  private flushInterval = 5000; // 5초마다 전송

  /**
   * 포스트 조회 이벤트 트래킹
   * - 페이지 진입시 자동 호출
   * - 스크롤 깊이, 읽기 시간 측정
   */
  trackPostView(postId: string, metadata: ViewMetadata) {
    const startTime = Date.now();
    let maxScrollDepth = 0;

    // 스크롤 추적
    const scrollHandler = throttle(() => {
      const depth = calculateScrollDepth();
      maxScrollDepth = Math.max(maxScrollDepth, depth);
    }, 100);

    window.addEventListener('scroll', scrollHandler);

    // 페이지 이탈시 이벤트 전송
    const sendEvent = () => {
      const duration = (Date.now() - startTime) / 1000;

      this.queueEvent({
        eventType: 'view',
        targetType: 'post',
        targetId: postId,
        metadata: {
          duration,
          scrollDepth: maxScrollDepth,
          ...metadata
        },
        weight: calculateWeight(duration, maxScrollDepth)
      });

      window.removeEventListener('scroll', scrollHandler);
    };

    // 페이지 이탈 감지
    window.addEventListener('beforeunload', sendEvent);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sendEvent();
    });
  }

  /**
   * 이벤트 가중치 계산
   * - 체류시간과 스크롤 깊이 기반
   */
  private calculateWeight(duration: number, scrollDepth: number): number {
    const timeWeight = Math.min(duration / 60, 5); // 최대 5분까지 가중치 증가
    const scrollWeight = scrollDepth / 100;

    return (timeWeight * 0.6 + scrollWeight * 0.4);
  }

  /**
   * 배치 전송
   */
  private async flush() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch('/api/v1/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          events,
          sessionId: this.sessionId
        })
      });
    } catch (error) {
      // 실패한 이벤트는 다시 큐에 추가
      this.eventQueue.unshift(...events);
    }
  }
}
```

---

## 🤖 Phase 2: 추천 알고리즘 핵심 엔진

### 2.1 하이브리드 추천 시스템 구조

#### 알고리즘 구성 요소
```typescript
interface RecommendationEngine {
  // 1. 협업 필터링 (Collaborative Filtering)
  collaborativeScore: (userId: string, postId: string) => Promise<number>;

  // 2. 콘텐츠 기반 필터링 (Content-Based Filtering)
  contentScore: (userId: string, postId: string) => Promise<number>;

  // 3. 인기도 기반 (Popularity-Based)
  popularityScore: (postId: string, timeWindow: TimeWindow) => Promise<number>;

  // 4. 시간 감쇠 (Time Decay)
  freshnessScore: (postId: string) => number;

  // 5. 다양성 보장 (Diversity)
  diversityBoost: (posts: Post[], userHistory: string[]) => Post[];
}
```

### 2.2 사용자 프로파일 모델링

#### 사용자 관심사 프로파일
```typescript
// backend/src/recommendation/entities/user-profile.entity.ts
@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  // 카테고리별 관심도 (0-1 정규화)
  @Column('jsonb')
  categoryInterests: {
    [category: string]: {
      score: number;          // 관심도 점수
      viewCount: number;      // 조회 횟수
      totalTime: number;      // 총 체류 시간
      lastInteraction: Date;  // 마지막 상호작용
    };
  };

  // 태그별 관심도
  @Column('jsonb')
  tagInterests: {
    [tag: string]: {
      score: number;
      frequency: number;
      recency: number;  // 최신성 가중치
    };
  };

  // 작가/블로그 선호도
  @Column('jsonb')
  authorPreferences: {
    [authorId: string]: {
      score: number;
      interactionCount: number;
      engagementRate: number; // 좋아요/댓글 비율
    };
  };

  // 읽기 패턴
  @Column('jsonb')
  readingPattern: {
    avgReadTime: number;        // 평균 읽기 시간
    preferredLength: string;    // short, medium, long
    activeHours: number[];      // 활동 시간대 [0-23]
    devicePreference: string;   // mobile, desktop
    scrollBehavior: string;     // fast, normal, slow
  };

  // 콘텐츠 선호도
  @Column('jsonb')
  contentPreferences: {
    hasVideo: boolean;          // 비디오 포함 선호
    hasImages: boolean;         // 이미지 포함 선호
    hasCode: boolean;          // 코드 포함 선호
    preferredFormats: string[]; // tutorial, news, review, etc.
  };

  @Column('float8', { array: true, nullable: true })
  embeddingVector: number[]; // 사용자 임베딩 벡터 (ML용)

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp' })
  lastCalculatedAt: Date;
}
```

### 2.3 추천 점수 계산 알고리즘

#### 협업 필터링 구현
```typescript
// backend/src/recommendation/services/collaborative-filtering.service.ts
@Injectable()
export class CollaborativeFilteringService {
  /**
   * 사용자 유사도 기반 추천 점수 계산
   * - 코사인 유사도 사용
   * - 상위 K명의 유사 사용자 기준
   */
  async calculateCollaborativeScore(
    userId: string,
    postId: string
  ): Promise<number> {
    // 1. 유사한 사용자 찾기 (캐시 활용)
    const similarUsers = await this.findSimilarUsers(userId, 50);

    // 2. 유사 사용자들의 해당 포스트 평가 수집
    const interactions = await this.getUserInteractions(
      similarUsers.map(u => u.userId),
      postId
    );

    // 3. 가중 평균 계산
    let weightedSum = 0;
    let weightSum = 0;

    for (const similar of similarUsers) {
      const interaction = interactions.find(i => i.userId === similar.userId);
      if (interaction) {
        const rating = this.calculateImplicitRating(interaction);
        weightedSum += similar.similarity * rating;
        weightSum += similar.similarity;
      }
    }

    return weightSum > 0 ? weightedSum / weightSum : 0;
  }

  /**
   * 암묵적 평점 계산
   * - 행동 기반 점수화
   */
  private calculateImplicitRating(interaction: UserInteraction): number {
    let rating = 0;

    // 조회: 1점
    if (interaction.viewed) rating += 1;

    // 읽기 완료 (80% 이상 스크롤): 2점
    if (interaction.scrollDepth > 80) rating += 2;

    // 체류 시간 (1분당 0.5점, 최대 2점)
    rating += Math.min(interaction.duration / 60 * 0.5, 2);

    // 좋아요: 3점
    if (interaction.liked) rating += 3;

    // 댓글: 4점
    if (interaction.commented) rating += 4;

    // 공유: 5점
    if (interaction.shared) rating += 5;

    // 0-10 스케일로 정규화
    return Math.min(rating / 17 * 10, 10);
  }

  /**
   * 사용자 간 유사도 계산
   * - 벡터 공간 모델 사용
   */
  private async calculateUserSimilarity(
    userA: string,
    userB: string
  ): Promise<number> {
    const [profileA, profileB] = await Promise.all([
      this.getUserProfile(userA),
      this.getUserProfile(userB)
    ]);

    // 카테고리 관심사 유사도
    const categorySim = this.cosineSimilarity(
      Object.values(profileA.categoryInterests).map(c => c.score),
      Object.values(profileB.categoryInterests).map(c => c.score)
    );

    // 태그 관심사 유사도
    const tagSim = this.jaccardSimilarity(
      Object.keys(profileA.tagInterests),
      Object.keys(profileB.tagInterests)
    );

    // 작가 선호도 유사도
    const authorSim = this.jaccardSimilarity(
      Object.keys(profileA.authorPreferences),
      Object.keys(profileB.authorPreferences)
    );

    // 가중 조합
    return categorySim * 0.4 + tagSim * 0.3 + authorSim * 0.3;
  }
}
```

#### 콘텐츠 기반 필터링 구현
```typescript
// backend/src/recommendation/services/content-filtering.service.ts
@Injectable()
export class ContentFilteringService {
  /**
   * 콘텐츠 유사도 기반 추천 점수
   * - TF-IDF + 카테고리/태그 매칭
   */
  async calculateContentScore(
    userId: string,
    postId: string
  ): Promise<number> {
    const [userProfile, post] = await Promise.all([
      this.getUserProfile(userId),
      this.getPost(postId)
    ]);

    // 1. 카테고리 매칭 점수
    const categoryScore = userProfile.categoryInterests[post.category]?.score || 0;

    // 2. 태그 매칭 점수
    const tagScore = this.calculateTagMatchScore(
      userProfile.tagInterests,
      post.tagList
    );

    // 3. 작가 선호도 점수
    const authorScore = userProfile.authorPreferences[post.authorId]?.score || 0;

    // 4. 콘텐츠 특성 매칭
    const formatScore = this.calculateFormatScore(
      userProfile.contentPreferences,
      post
    );

    // 5. 텍스트 유사도 (임베딩 기반)
    const textSimilarity = await this.calculateTextSimilarity(
      userProfile.embeddingVector,
      post.embeddingVector
    );

    // 가중 조합
    return (
      categoryScore * 0.25 +
      tagScore * 0.20 +
      authorScore * 0.20 +
      formatScore * 0.15 +
      textSimilarity * 0.20
    );
  }

  /**
   * 태그 매칭 점수 계산
   */
  private calculateTagMatchScore(
    userTags: Record<string, TagInterest>,
    postTags: string[]
  ): number {
    if (postTags.length === 0) return 0;

    let score = 0;
    for (const tag of postTags) {
      if (userTags[tag]) {
        score += userTags[tag].score * userTags[tag].recency;
      }
    }

    return score / postTags.length;
  }
}
```

### 2.4 실시간 추천 엔진

#### 추천 API 구현
```typescript
// backend/src/recommendation/controllers/recommendation.controller.ts
@Controller('api/v1/recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly cacheService: CacheService
  ) {}

  /**
   * 개인화 피드 추천
   */
  @Get('feed')
  async getPersonalizedFeed(
    @CurrentUser() user: User,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 20,
    @Query('strategy') strategy: RecommendStrategy = 'hybrid'
  ) {
    // 캐시 확인 (5분 TTL)
    const cacheKey = `feed:${user.id}:${page}:${strategy}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    // 추천 생성
    const recommendations = await this.recommendationService.generateFeed({
      userId: user.id,
      page,
      limit,
      strategy,
      filters: {
        excludeViewed: true,
        minQualityScore: 60,
        publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30일
      }
    });

    // 캐시 저장
    await this.cacheService.set(cacheKey, recommendations, 300);

    return recommendations;
  }

  /**
   * 유사 포스트 추천
   */
  @Get('similar/:postId')
  async getSimilarPosts(
    @Param('postId') postId: string,
    @CurrentUser() user: User,
    @Query('limit', ParseIntPipe) limit = 10
  ) {
    return this.recommendationService.findSimilarPosts({
      postId,
      userId: user?.id,
      limit,
      excludeAuthor: false
    });
  }

  /**
   * 트렌딩 포스트 (개인화된)
   */
  @Get('trending')
  async getTrendingPosts(
    @CurrentUser() user: User,
    @Query('timeWindow') timeWindow: TimeWindow = '24h',
    @Query('limit', ParseIntPipe) limit = 20
  ) {
    return this.recommendationService.getPersonalizedTrending({
      userId: user?.id,
      timeWindow,
      limit
    });
  }
}
```

#### 추천 서비스 핵심 로직
```typescript
// backend/src/recommendation/services/recommendation.service.ts
@Injectable()
export class RecommendationService {
  constructor(
    private readonly collaborativeService: CollaborativeFilteringService,
    private readonly contentService: ContentFilteringService,
    private readonly popularityService: PopularityService,
    private readonly diversityService: DiversityService,
    private readonly redisClient: Redis
  ) {}

  /**
   * 하이브리드 추천 생성
   */
  async generateFeed(options: FeedOptions): Promise<RecommendationResult> {
    const { userId, limit, strategy } = options;

    // 1. 후보 포스트 수집 (3배수)
    const candidates = await this.getCandidatePosts(userId, limit * 3);

    // 2. 각 알고리즘별 점수 계산 (병렬 처리)
    const scoredPosts = await Promise.all(
      candidates.map(async (post) => {
        const [collaborative, content, popularity, freshness] = await Promise.all([
          this.collaborativeService.calculateScore(userId, post.id),
          this.contentService.calculateScore(userId, post.id),
          this.popularityService.calculateScore(post.id),
          this.calculateFreshnessScore(post.publishedAt)
        ]);

        // 전략별 가중치 적용
        const weights = this.getStrategyWeights(strategy);
        const finalScore =
          collaborative * weights.collaborative +
          content * weights.content +
          popularity * weights.popularity +
          freshness * weights.freshness;

        return { ...post, score: finalScore, breakdown: {
          collaborative, content, popularity, freshness
        }};
      })
    );

    // 3. 점수순 정렬
    scoredPosts.sort((a, b) => b.score - a.score);

    // 4. 다양성 보장 (같은 작가/카테고리 연속 방지)
    const diversified = this.diversityService.applyDiversity(
      scoredPosts.slice(0, limit * 2),
      userId
    );

    // 5. 최종 선택
    const selected = diversified.slice(0, limit);

    // 6. 노출 로깅 (비동기)
    this.logImpressions(userId, selected.map(p => p.id));

    return {
      posts: selected,
      metadata: {
        strategy,
        totalCandidates: candidates.length,
        timestamp: new Date(),
        nextPage: options.page + 1
      }
    };
  }

  /**
   * 전략별 가중치 설정
   */
  private getStrategyWeights(strategy: RecommendStrategy): Weights {
    const weights = {
      hybrid: { collaborative: 0.35, content: 0.30, popularity: 0.20, freshness: 0.15 },
      collaborative: { collaborative: 0.60, content: 0.20, popularity: 0.10, freshness: 0.10 },
      content: { collaborative: 0.20, content: 0.60, popularity: 0.10, freshness: 0.10 },
      trending: { collaborative: 0.10, content: 0.10, popularity: 0.60, freshness: 0.20 },
      fresh: { collaborative: 0.15, content: 0.25, popularity: 0.10, freshness: 0.50 }
    };

    return weights[strategy] || weights.hybrid;
  }

  /**
   * 시간 감쇠 점수 계산
   * - 최신 콘텐츠 가중치
   */
  private calculateFreshnessScore(publishedAt: Date): number {
    const hoursSincePublished = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);

    // 지수 감쇠 함수
    // 24시간: 1.0, 48시간: 0.7, 7일: 0.3, 30일: 0.1
    return Math.exp(-hoursSincePublished / 168); // 1주일 반감기
  }
}
```

---

## 📊 Phase 3: 실시간 개인화 구현

### 3.1 Redis 기반 실시간 처리

#### 실시간 사용자 세션 관리
```typescript
// backend/src/recommendation/services/realtime-session.service.ts
@Injectable()
export class RealtimeSessionService {
  private readonly SESSION_TTL = 1800; // 30분

  constructor(
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * 실시간 세션 컨텍스트 업데이트
   */
  async updateSessionContext(userId: string, event: UserEvent): Promise<void> {
    const sessionKey = `session:${userId}`;

    // 현재 세션 가져오기
    const session = await this.redis.hgetall(sessionKey) || {};

    // 세션 업데이트
    const updated = {
      ...session,
      lastActivity: Date.now(),
      viewedPosts: JSON.parse(session.viewedPosts || '[]'),
      recentCategories: JSON.parse(session.recentCategories || '[]'),
      recentTags: JSON.parse(session.recentTags || '[]'),
      engagementScore: parseFloat(session.engagementScore || '0')
    };

    // 이벤트 타입별 처리
    switch (event.eventType) {
      case 'view':
        updated.viewedPosts.push(event.targetId);
        if (updated.viewedPosts.length > 100) {
          updated.viewedPosts.shift(); // FIFO
        }
        break;

      case 'like':
      case 'comment':
        updated.engagementScore += event.weight;
        break;

      case 'category_click':
        updated.recentCategories.unshift(event.targetId);
        updated.recentCategories = updated.recentCategories.slice(0, 10);
        break;
    }

    // Redis 저장
    await this.redis.hmset(sessionKey, {
      ...updated,
      viewedPosts: JSON.stringify(updated.viewedPosts),
      recentCategories: JSON.stringify(updated.recentCategories),
      recentTags: JSON.stringify(updated.recentTags)
    });

    await this.redis.expire(sessionKey, this.SESSION_TTL);
  }

  /**
   * 실시간 추천 조정
   * - 세션 컨텍스트 기반 점수 부스팅
   */
  async applyRealtimeBoost(
    userId: string,
    posts: ScoredPost[]
  ): Promise<ScoredPost[]> {
    const session = await this.getSessionContext(userId);
    if (!session) return posts;

    return posts.map(post => {
      let boost = 1.0;

      // 최근 본 카테고리 부스팅
      if (session.recentCategories.includes(post.category)) {
        const recency = session.recentCategories.indexOf(post.category);
        boost *= (1 + 0.2 * Math.exp(-recency / 3)); // 최근일수록 높은 부스트
      }

      // 최근 관심 태그 부스팅
      const matchingTags = post.tagList.filter(tag =>
        session.recentTags.includes(tag)
      );
      boost *= (1 + 0.1 * matchingTags.length);

      // 높은 참여도 사용자는 더 다양한 콘텐츠
      if (session.engagementScore > 50) {
        boost *= 0.95; // 약간의 패널티로 다양성 증가
      }

      return {
        ...post,
        score: post.score * boost,
        realtimeBoost: boost
      };
    });
  }
}
```

### 3.2 WebSocket 기반 실시간 업데이트

#### 실시간 추천 업데이트 구현
```typescript
// backend/src/recommendation/gateways/recommendation.gateway.ts
@WebSocketGateway({
  namespace: 'recommendations',
  cors: { origin: process.env.FRONTEND_URL }
})
export class RecommendationGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * 사용자 연결시 개인화 채널 구독
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket
  ) {
    // 개인 채널 참여
    client.join(`user:${data.userId}`);

    // 초기 추천 전송
    const recommendations = await this.recommendationService.getQuickRecommendations(
      data.userId,
      5
    );

    client.emit('initial-recommendations', recommendations);
  }

  /**
   * 실시간 추천 업데이트 푸시
   */
  @OnEvent('recommendation.update')
  async handleRecommendationUpdate(payload: {
    userId: string;
    type: 'new-trending' | 'similar-liked' | 'author-posted';
    posts: Post[];
  }) {
    this.server.to(`user:${payload.userId}`).emit('recommendation-update', {
      type: payload.type,
      posts: payload.posts,
      timestamp: new Date()
    });
  }

  /**
   * 실시간 행동 피드백
   */
  @SubscribeMessage('feedback')
  async handleFeedback(
    @MessageBody() data: {
      userId: string;
      postId: string;
      action: 'dismiss' | 'not-interested' | 'save-later';
    }
  ) {
    // 부정적 피드백 즉시 반영
    await this.recommendationService.applyNegativeFeedback(
      data.userId,
      data.postId,
      data.action
    );

    // 대체 추천 제공
    const replacement = await this.recommendationService.getReplacementRecommendation(
      data.userId,
      data.postId
    );

    return { replacement };
  }
}
```

---

## 📈 Phase 4: A/B 테스팅 및 성과 측정

### 4.1 실험 프레임워크

#### 실험 설정 엔티티
```typescript
// backend/src/experiments/entities/experiment.entity.ts
@Entity('experiments')
export class Experiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('jsonb')
  config: {
    algorithm: RecommendStrategy;
    weights: Weights;
    parameters: Record<string, any>;
  };

  @Column({ type: 'float', default: 0.5 })
  trafficAllocation: number; // 0-1 비율

  @Column('jsonb')
  targetCriteria: {
    newUsers?: boolean;
    activeUsers?: boolean;
    segments?: string[];
  };

  @Column('jsonb')
  metrics: {
    primary: string;    // 'session_duration', 'ctr', 'retention'
    secondary: string[];
  };

  @Column({ type: 'enum', enum: ['draft', 'running', 'paused', 'completed'] })
  status: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column('jsonb', { nullable: true })
  results: {
    control: MetricResults;
    variant: MetricResults;
    significance: number;
    winner?: 'control' | 'variant';
  };
}
```

#### A/B 테스트 서비스
```typescript
// backend/src/experiments/services/ab-test.service.ts
@Injectable()
export class ABTestService {
  /**
   * 사용자 실험 그룹 할당
   */
  async assignUserToExperiment(
    userId: string,
    experimentId: string
  ): Promise<'control' | 'variant'> {
    // 일관된 할당을 위한 해싱
    const hash = this.hashUserId(userId, experimentId);
    const experiment = await this.getExperiment(experimentId);

    // 트래픽 비율에 따라 할당
    return hash < experiment.trafficAllocation ? 'variant' : 'control';
  }

  /**
   * 실험 메트릭 수집
   */
  @Cron('0 */10 * * * *') // 10분마다
  async collectMetrics() {
    const runningExperiments = await this.getRunningExperiments();

    for (const experiment of runningExperiments) {
      const metrics = await this.calculateMetrics(experiment);

      // 통계적 유의성 검증
      const significance = this.calculateStatisticalSignificance(
        metrics.control,
        metrics.variant
      );

      // 결과 업데이트
      await this.updateExperimentResults(experiment.id, {
        ...metrics,
        significance,
        winner: significance > 0.95 ?
          (metrics.variant.primary > metrics.control.primary ? 'variant' : 'control') :
          null
      });

      // 조기 종료 조건 확인
      if (this.shouldStopExperiment(metrics, significance)) {
        await this.stopExperiment(experiment.id);
      }
    }
  }

  /**
   * 핵심 지표 계산
   */
  private async calculateMetrics(experiment: Experiment): Promise<MetricResults> {
    const timeWindow = {
      start: experiment.startedAt,
      end: new Date()
    };

    return {
      control: await this.getGroupMetrics('control', experiment, timeWindow),
      variant: await this.getGroupMetrics('variant', experiment, timeWindow)
    };
  }

  private async getGroupMetrics(
    group: string,
    experiment: Experiment,
    timeWindow: TimeWindow
  ): Promise<GroupMetrics> {
    const users = await this.getUsersInGroup(experiment.id, group);

    // 주요 지표 계산
    const metrics = {
      sessionDuration: await this.avgSessionDuration(users, timeWindow),
      clickThroughRate: await this.calculateCTR(users, timeWindow),
      returnRate: await this.calculateReturnRate(users, timeWindow),
      engagementScore: await this.calculateEngagement(users, timeWindow),
      postsViewed: await this.avgPostsViewed(users, timeWindow),
      userCount: users.length
    };

    return metrics;
  }
}
```

### 4.2 성과 대시보드

#### 실시간 메트릭 API
```typescript
// backend/src/analytics/controllers/metrics.controller.ts
@Controller('api/v1/metrics')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('admin')
export class MetricsController {
  /**
   * 추천 시스템 성과 대시보드
   */
  @Get('recommendation-performance')
  async getRecommendationMetrics(
    @Query('timeRange') timeRange: TimeRange = '7d'
  ) {
    const [overall, byStrategy, userSegments, trends] = await Promise.all([
      this.metricsService.getOverallMetrics(timeRange),
      this.metricsService.getMetricsByStrategy(timeRange),
      this.metricsService.getMetricsByUserSegment(timeRange),
      this.metricsService.getTrendMetrics(timeRange)
    ]);

    return {
      overall: {
        sessionDuration: overall.avgSessionDuration,
        pageViews: overall.totalPageViews,
        clickThroughRate: overall.ctr,
        returnRate: overall.returnRate,
        engagementRate: overall.engagementRate
      },
      byStrategy: byStrategy.map(s => ({
        strategy: s.strategy,
        users: s.userCount,
        avgSession: s.avgSessionDuration,
        ctr: s.clickThroughRate,
        satisfaction: s.satisfactionScore
      })),
      userSegments: {
        newUsers: userSegments.new,
        returningUsers: userSegments.returning,
        powerUsers: userSegments.power
      },
      trends: {
        daily: trends.daily,
        comparison: {
          vsLastPeriod: trends.vsLastPeriod,
          vsLastYear: trends.vsLastYear
        }
      },
      timestamp: new Date()
    };
  }

  /**
   * 실험 결과 보고서
   */
  @Get('experiments/:id/report')
  async getExperimentReport(@Param('id') experimentId: string) {
    const experiment = await this.experimentService.getExperiment(experimentId);
    const analysis = await this.analysisService.analyzeExperiment(experimentId);

    return {
      experiment: {
        name: experiment.name,
        status: experiment.status,
        duration: this.calculateDuration(experiment),
        traffic: experiment.trafficAllocation
      },
      results: {
        winner: analysis.winner,
        confidence: analysis.confidence,
        lift: analysis.lift,
        metrics: analysis.metrics
      },
      recommendations: analysis.recommendations,
      visualizations: {
        conversionFunnel: analysis.funnelData,
        timeSeriesChart: analysis.timeSeriesData,
        segmentAnalysis: analysis.segmentData
      }
    };
  }
}
```

---

## 💾 Phase 5: 데이터베이스 스키마 최적화

### 5.1 인덱싱 전략

```sql
-- 사용자 이벤트 테이블 인덱싱
CREATE INDEX idx_user_events_composite ON user_events (
  user_id,
  event_type,
  created_at DESC
);

CREATE INDEX idx_user_events_target ON user_events (
  target_id,
  target_type
);

CREATE INDEX idx_user_events_processing ON user_events (
  processed_at NULLS FIRST,
  created_at
) WHERE processed_at IS NULL;

-- 사용자 프로파일 인덱싱
CREATE INDEX idx_user_profiles_updated ON user_profiles (
  last_calculated_at,
  updated_at
);

-- GIN 인덱스 for JSONB 쿼리
CREATE INDEX idx_user_profiles_categories ON user_profiles
USING gin (category_interests);

CREATE INDEX idx_user_profiles_tags ON user_profiles
USING gin (tag_interests);

-- 포스트 추천용 복합 인덱스
CREATE INDEX idx_posts_recommendation ON posts (
  is_published,
  published_at DESC,
  quality_score DESC
) WHERE is_published = true AND quality_score >= 60;
```

### 5.2 파티셔닝 전략

```sql
-- 이벤트 테이블 시간 기반 파티셔닝
CREATE TABLE user_events_2025_01 PARTITION OF user_events
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 자동 파티션 생성 함수
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
BEGIN
  partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  partition_name := 'user_events_' || TO_CHAR(partition_date, 'YYYY_MM');

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF user_events
     FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    partition_date,
    partition_date + INTERVAL '1 month'
  );
END;
$$ LANGUAGE plpgsql;

-- 매월 자동 실행 스케줄링
SELECT cron.schedule('create-partition', '0 0 25 * *', 'SELECT create_monthly_partition()');
```

### 5.3 구체화된 뷰 (Materialized Views)

```sql
-- 인기 포스트 구체화 뷰
CREATE MATERIALIZED VIEW mv_trending_posts AS
SELECT
  p.id,
  p.title,
  p.author_id,
  p.category,
  p.tag_list,
  p.published_at,
  COUNT(DISTINCT ue.user_id) as unique_viewers,
  AVG(ue.metadata->>'duration')::float as avg_read_time,
  SUM(CASE WHEN ue.event_type = 'like' THEN 1 ELSE 0 END) as like_count,
  SUM(CASE WHEN ue.event_type = 'comment' THEN 1 ELSE 0 END) as comment_count,
  SUM(CASE WHEN ue.event_type = 'share' THEN 1 ELSE 0 END) as share_count,
  LOG(COUNT(DISTINCT ue.user_id) + 1) *
    EXP(-EXTRACT(EPOCH FROM (NOW() - p.published_at)) / 604800) as trending_score
FROM posts p
LEFT JOIN user_events ue ON ue.target_id = p.id AND ue.target_type = 'post'
WHERE
  p.is_published = true
  AND p.published_at > NOW() - INTERVAL '30 days'
GROUP BY p.id
WITH DATA;

-- 1시간마다 리프레시
CREATE INDEX idx_mv_trending_score ON mv_trending_posts (trending_score DESC);
SELECT cron.schedule('refresh-trending', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_posts');
```

---

## 🚀 Phase 6: 운영 및 모니터링

### 6.1 시스템 모니터링 지표

#### 핵심 KPI
```typescript
interface SystemKPIs {
  // 성능 지표
  performance: {
    avgRecommendationLatency: number;  // < 100ms 목표
    p95RecommendationLatency: number;  // < 200ms 목표
    cacheHitRate: number;              // > 80% 목표
    databaseQueryTime: number;         // < 50ms 목표
  };

  // 품질 지표
  quality: {
    clickThroughRate: number;          // > 15% 목표
    dwellTime: number;                 // > 2분 목표
    returnRate: number;                // > 40% DAU/MAU
    diversityScore: number;            // > 0.7 (0-1 scale)
  };

  // 비즈니스 지표
  business: {
    dailyActiveUsers: number;
    postsViewedPerUser: number;
    engagementRate: number;
    viralCoefficient: number;          // 공유를 통한 신규 유입
  };
}
```

### 6.2 알림 및 자동 조정

```typescript
// backend/src/monitoring/services/alert.service.ts
@Injectable()
export class AlertService {
  /**
   * 자동 품질 모니터링
   */
  @Cron('*/5 * * * *') // 5분마다
  async monitorRecommendationQuality() {
    const metrics = await this.metricsService.getCurrentMetrics();

    // 임계값 확인
    const alerts = [];

    if (metrics.performance.avgRecommendationLatency > 150) {
      alerts.push({
        level: 'warning',
        metric: 'latency',
        value: metrics.performance.avgRecommendationLatency,
        action: 'increase-cache-ttl'
      });
    }

    if (metrics.quality.clickThroughRate < 0.10) {
      alerts.push({
        level: 'critical',
        metric: 'ctr',
        value: metrics.quality.clickThroughRate,
        action: 'adjust-algorithm-weights'
      });
    }

    if (metrics.quality.diversityScore < 0.5) {
      alerts.push({
        level: 'warning',
        metric: 'diversity',
        value: metrics.quality.diversityScore,
        action: 'increase-diversity-penalty'
      });
    }

    // 자동 조정 실행
    for (const alert of alerts) {
      await this.executeAutoAdjustment(alert);
      await this.notifyAdmins(alert);
    }
  }

  /**
   * 자동 조정 실행
   */
  private async executeAutoAdjustment(alert: Alert) {
    switch (alert.action) {
      case 'increase-cache-ttl':
        await this.configService.update('cache.ttl', 600); // 10분으로 증가
        break;

      case 'adjust-algorithm-weights':
        // CTR이 낮으면 인기도 가중치 증가
        const currentWeights = await this.configService.get('algorithm.weights');
        await this.configService.update('algorithm.weights', {
          ...currentWeights,
          popularity: Math.min(currentWeights.popularity * 1.2, 0.5)
        });
        break;

      case 'increase-diversity-penalty':
        await this.configService.update('diversity.penalty', 1.5);
        break;
    }
  }
}
```

### 6.3 운영 체크리스트

#### 일일 운영 작업
- [ ] 메트릭 대시보드 확인 (CTR, 체류시간, 재방문율)
- [ ] 알림 확인 및 대응
- [ ] A/B 테스트 진행 상황 확인
- [ ] 캐시 히트율 모니터링
- [ ] 느린 쿼리 분석

#### 주간 운영 작업
- [ ] 사용자 프로파일 재계산
- [ ] 알고리즘 가중치 조정 검토
- [ ] A/B 테스트 결과 분석
- [ ] 데이터베이스 인덱스 효율성 검토
- [ ] 파티션 관리 및 오래된 데이터 아카이빙

#### 월간 운영 작업
- [ ] 전체 시스템 성능 리뷰
- [ ] 알고리즘 업데이트 계획
- [ ] 사용자 세그먼트 분석
- [ ] 인프라 확장 계획 수립
- [ ] 경쟁사 벤치마킹

---

## 🎯 구현 로드맵

### Phase 1 (Week 1-2): 기초 인프라
- [x] 사용자 이벤트 트래킹 시스템 구축
- [x] 데이터베이스 스키마 설계
- [x] Redis 캐싱 레이어 구현
- [ ] 기본 API 엔드포인트 개발

### Phase 2 (Week 3-4): 핵심 알고리즘
- [ ] 협업 필터링 구현
- [ ] 콘텐츠 기반 필터링 구현
- [ ] 하이브리드 점수 계산 시스템
- [ ] 다양성 보장 로직 구현

### Phase 3 (Week 5-6): 실시간 개인화
- [ ] 실시간 세션 관리 구현
- [ ] WebSocket 기반 업데이트 시스템
- [ ] 실시간 피드백 처리
- [ ] 동적 추천 조정

### Phase 4 (Week 7-8): 실험 및 최적화
- [ ] A/B 테스팅 프레임워크
- [ ] 메트릭 수집 시스템
- [ ] 성과 대시보드 구축
- [ ] 자동 최적화 시스템

### Phase 5 (Week 9-10): 운영 준비
- [ ] 모니터링 시스템 구축
- [ ] 알림 시스템 구현
- [ ] 운영 문서 작성
- [ ] 성능 튜닝 및 스트레스 테스트

---

## 💡 핵심 성공 요인

1. **점진적 개선**: 완벽한 시작보다 지속적 개선에 집중
2. **데이터 기반 의사결정**: 모든 변경은 A/B 테스트로 검증
3. **사용자 피드백 수렴**: 명시적/암묵적 피드백 모두 활용
4. **실시간 대응**: 사용자 컨텍스트 변화에 즉각 반응
5. **다양성과 관련성 균형**: 필터 버블 방지하며 만족도 유지

---

## 📚 참고 자료

- [Netflix Prize 알고리즘](https://netflixprize.com/)
- [YouTube 추천 시스템](https://research.google/pubs/pub45530/)
- [Pinterest Related Pins](https://medium.com/pinterest-engineering)
- [Spotify Discover Weekly](https://engineering.atspotify.com/)
- [TikTok For You Algorithm](https://newsroom.tiktok.com/)

---

*이 문서는 지속적으로 업데이트되며, 실제 운영 경험을 바탕으로 개선됩니다.*