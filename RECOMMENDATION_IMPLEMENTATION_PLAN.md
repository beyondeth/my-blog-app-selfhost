# 📋 추천 알고리즘 구현 실행 계획

## 🎯 즉시 구현 가능한 Quick Wins (1-2일)

### 1. 기본 인기도 기반 추천
```typescript
// backend/src/recommendation/services/popularity.service.ts
/**
 * 즉시 구현 가능한 인기도 기반 추천
 * 복잡한 알고리즘 없이 바로 사용 가능
 */
@Injectable()
export class PopularityService {
  async getTrendingPosts(timeWindow: '24h' | '7d' | '30d' = '7d') {
    const query = `
      SELECT
        p.*,
        -- 인기도 점수 계산 (조회수 + 좋아요*3 + 댓글*2)
        (p.view_count + p.like_count * 3 + p.comment_count * 2) *
        -- 시간 감쇠 적용 (최신일수록 높은 점수)
        EXP(-EXTRACT(EPOCH FROM (NOW() - p.published_at)) / (7 * 86400))
        AS trending_score
      FROM posts p
      WHERE
        p.is_published = true
        AND p.published_at > NOW() - INTERVAL '${timeWindow}'
      ORDER BY trending_score DESC
      LIMIT 20
    `;

    return await this.entityManager.query(query);
  }
}
```

### 2. 카테고리 기반 추천
```typescript
// 사용자가 자주 본 카테고리의 최신 글 추천
async getCategoryBasedRecommendations(userId: string) {
  // 사용자가 최근 본 카테고리 통계
  const userCategories = await this.getUserTopCategories(userId, 5);

  // 각 카테고리에서 최신 인기글 가져오기
  const posts = await this.postsRepository.find({
    where: {
      category: In(userCategories),
      isPublished: true,
      publishedAt: MoreThan(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    },
    order: {
      viewCount: 'DESC',
      publishedAt: 'DESC'
    },
    take: 20
  });

  return posts;
}
```

---

## 🚀 Phase 1: MVP 구현 (1주)

### 1.1 데이터베이스 마이그레이션
```bash
# 마이그레이션 파일 생성
npx typeorm migration:create -n AddRecommendationTables

# 실행할 SQL
```

```sql
-- 사용자 이벤트 테이블
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  metadata JSONB,
  weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 인덱스 생성
CREATE INDEX idx_user_events_user ON user_events(user_id, event_type, created_at DESC);
CREATE INDEX idx_user_events_target ON user_events(target_id, target_type);
CREATE INDEX idx_user_events_processing ON user_events(processed_at NULLS FIRST)
  WHERE processed_at IS NULL;

-- 사용자 프로파일 테이블
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  category_interests JSONB DEFAULT '{}',
  tag_interests JSONB DEFAULT '{}',
  author_preferences JSONB DEFAULT '{}',
  reading_pattern JSONB DEFAULT '{}',
  content_preferences JSONB DEFAULT '{}',
  embedding_vector FLOAT8[],
  confidence_score FLOAT DEFAULT 0,
  total_events_analyzed INTEGER DEFAULT 0,
  diversity_preference FLOAT DEFAULT 0.5,
  freshness_preference FLOAT DEFAULT 0.5,
  profile_version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_updated ON user_profiles(last_calculated_at);
```

### 1.2 Analytics 모듈 구현
```typescript
// backend/src/analytics/analytics.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEvent]),
    BullModule.registerQueue({ name: 'analytics' }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, EventProcessor],
  exports: [AnalyticsService]
})
export class AnalyticsModule {}

// backend/src/analytics/analytics.controller.ts
@Controller('api/v1/analytics')
export class AnalyticsController {
  /**
   * 프론트엔드에서 이벤트 배치 전송
   */
  @Post('events')
  @UseGuards(OptionalJwtAuthGuard)
  async trackEvents(
    @CurrentUser() user: User | null,
    @Body() dto: TrackEventsDto
  ) {
    // 사용자가 로그인한 경우에만 저장
    if (!user) return { success: false };

    const events = dto.events.map(event => ({
      ...event,
      userId: user.id,
      weight: this.calculateWeight(event)
    }));

    await this.analyticsService.saveEvents(events);

    // 비동기로 프로파일 업데이트 큐에 추가
    await this.eventQueue.add('update-profile', {
      userId: user.id
    }, {
      delay: 5000, // 5초 후 처리
      removeOnComplete: true
    });

    return { success: true };
  }
}
```

### 1.3 Frontend 트래킹 구현
```typescript
// frontend/src/hooks/useAnalytics.ts
export function useAnalytics() {
  const { user } = useAuth();
  const eventQueue = useRef<AnalyticsEvent[]>([]);
  const flushTimer = useRef<NodeJS.Timeout>();

  /**
   * 포스트 조회 트래킹
   */
  const trackPostView = useCallback((postId: string, metadata?: any) => {
    if (!user) return;

    const startTime = Date.now();
    let maxScrollDepth = 0;

    // 스크롤 깊이 추적
    const handleScroll = throttle(() => {
      const scrolled = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      maxScrollDepth = Math.max(maxScrollDepth, (scrolled / height) * 100);
    }, 100);

    window.addEventListener('scroll', handleScroll);

    // 페이지 이탈시 이벤트 전송
    const cleanup = () => {
      window.removeEventListener('scroll', handleScroll);

      const duration = (Date.now() - startTime) / 1000;

      // 3초 이상 머문 경우에만 기록
      if (duration >= 3) {
        queueEvent({
          eventType: 'view',
          targetType: 'post',
          targetId: postId,
          metadata: {
            duration,
            scrollDepth: maxScrollDepth,
            deviceType: getDeviceType(),
            ...metadata
          }
        });

        // 80% 이상 스크롤한 경우 읽기 완료 이벤트 추가
        if (maxScrollDepth >= 80) {
          queueEvent({
            eventType: 'read',
            targetType: 'post',
            targetId: postId
          });
        }
      }
    };

    // 페이지 이탈 감지
    window.addEventListener('beforeunload', cleanup);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cleanup();
    });

    return cleanup;
  }, [user]);

  /**
   * 이벤트 큐에 추가
   */
  const queueEvent = (event: AnalyticsEvent) => {
    eventQueue.current.push({
      ...event,
      timestamp: new Date().toISOString()
    });

    // 큐가 10개 이상이거나 5초 후 전송
    if (eventQueue.current.length >= 10) {
      flush();
    } else {
      clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, 5000);
    }
  };

  /**
   * 서버로 이벤트 전송
   */
  const flush = async () => {
    if (eventQueue.current.length === 0) return;

    const events = [...eventQueue.current];
    eventQueue.current = [];

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ events })
      });
    } catch (error) {
      // 실패시 다시 큐에 추가
      eventQueue.current.unshift(...events);
    }
  };

  return {
    trackPostView,
    trackLike: (postId: string) => queueEvent({
      eventType: 'like',
      targetType: 'post',
      targetId: postId
    }),
    trackComment: (postId: string) => queueEvent({
      eventType: 'comment',
      targetType: 'post',
      targetId: postId
    }),
    trackShare: (postId: string) => queueEvent({
      eventType: 'share',
      targetType: 'post',
      targetId: postId
    }),
    flush
  };
}
```

### 1.4 포스트 상세 페이지에 트래킹 적용
```tsx
// frontend/src/app/blog/[blogSlug]/posts/[postSlug]/page.tsx
export default function PostPage({ params }) {
  const { trackPostView } = useAnalytics();
  const { data: post } = useQuery(['post', params.postSlug], () =>
    fetchPost(params.postSlug)
  );

  useEffect(() => {
    if (post) {
      // 페이지 진입시 트래킹 시작
      const cleanup = trackPostView(post.id, {
        referrer: document.referrer,
        searchQuery: new URLSearchParams(window.location.search).get('q')
      });

      return cleanup; // 컴포넌트 언마운트시 정리
    }
  }, [post, trackPostView]);

  // ... 나머지 컴포넌트 로직
}
```

---

## 📊 Phase 2: 기본 추천 시스템 (2주차)

### 2.1 추천 서비스 구현
```typescript
// backend/src/recommendation/recommendation.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserProfile, UserEvent, Post]),
    BullModule.registerQueue({ name: 'recommendation' }),
    CacheModule.register({
      ttl: 300, // 5분 캐시
      max: 1000 // 최대 1000개 항목
    }),
  ],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    PopularityService,
    ContentFilteringService,
    ProfileCalculator
  ],
  exports: [RecommendationService]
})
export class RecommendationModule {}
```

### 2.2 간단한 협업 필터링
```typescript
// backend/src/recommendation/services/simple-collaborative.service.ts
@Injectable()
export class SimpleCollaborativeService {
  /**
   * 유사한 사용자가 좋아한 포스트 추천
   * 초기 버전: 좋아요 기반 간단한 추천
   */
  async getCollaborativeRecommendations(userId: string, limit = 20) {
    // 사용자가 좋아요한 포스트들
    const userLikedPosts = await this.getUserLikedPosts(userId);

    // 같은 포스트를 좋아요한 다른 사용자들 찾기
    const similarUsers = await this.entityManager.query(`
      SELECT
        ue2.user_id,
        COUNT(*) as common_likes
      FROM user_events ue1
      JOIN user_events ue2 ON
        ue2.target_id = ue1.target_id AND
        ue2.user_id != ue1.user_id
      WHERE
        ue1.user_id = $1 AND
        ue1.event_type = 'like' AND
        ue2.event_type = 'like'
      GROUP BY ue2.user_id
      ORDER BY common_likes DESC
      LIMIT 50
    `, [userId]);

    // 유사 사용자들이 좋아했지만 현재 사용자가 안 본 포스트
    const recommendations = await this.entityManager.query(`
      SELECT DISTINCT
        p.*,
        COUNT(ue.user_id) as like_count_by_similar_users
      FROM posts p
      JOIN user_events ue ON
        ue.target_id = p.id AND
        ue.event_type = 'like'
      WHERE
        ue.user_id = ANY($1::uuid[]) AND
        p.id NOT IN (
          SELECT target_id
          FROM user_events
          WHERE user_id = $2 AND event_type = 'view'
        ) AND
        p.is_published = true
      GROUP BY p.id
      ORDER BY like_count_by_similar_users DESC
      LIMIT $3
    `, [similarUsers.map(u => u.user_id), userId, limit]);

    return recommendations;
  }
}
```

### 2.3 홈 피드 통합
```tsx
// frontend/src/components/PersonalizedFeed.tsx
export function PersonalizedFeed() {
  const { user } = useAuth();
  const [strategy, setStrategy] = useState<'trending' | 'personalized'>('trending');

  const { data: posts, isLoading } = useQuery(
    ['feed', user?.id, strategy],
    async () => {
      if (!user) {
        // 비로그인 사용자: 인기 포스트
        return fetchTrendingPosts();
      }

      if (strategy === 'personalized') {
        // 로그인 사용자: 개인화 추천
        return fetchPersonalizedFeed();
      }

      return fetchTrendingPosts();
    },
    {
      staleTime: 5 * 60 * 1000, // 5분
      cacheTime: 10 * 60 * 1000 // 10분
    }
  );

  return (
    <div>
      {user && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setStrategy('trending')}
            className={strategy === 'trending' ? 'font-bold' : ''}
          >
            인기
          </button>
          <button
            onClick={() => setStrategy('personalized')}
            className={strategy === 'personalized' ? 'font-bold' : ''}
          >
            맞춤 추천
          </button>
        </div>
      )}

      {isLoading ? (
        <div>로딩중...</div>
      ) : (
        <PostList posts={posts} />
      )}
    </div>
  );
}
```

---

## 🔧 Phase 3: 프로파일 계산 배치 작업 (3주차)

### 3.1 프로파일 계산 Worker
```typescript
// backend/src/recommendation/workers/profile-calculator.processor.ts
@Processor('recommendation')
export class ProfileCalculatorProcessor {
  /**
   * 사용자 프로파일 업데이트
   * 큐를 통해 비동기 처리
   */
  @Process('calculate-profile')
  async calculateUserProfile(job: Job<{ userId: string }>) {
    const { userId } = job.data;

    // 최근 30일간 이벤트 수집
    const events = await this.getRecentEvents(userId, 30);

    if (events.length < 10) {
      // 데이터 부족시 스킵
      return;
    }

    // 카테고리 관심도 계산
    const categoryInterests = this.calculateCategoryInterests(events);

    // 태그 관심도 계산
    const tagInterests = this.calculateTagInterests(events);

    // 작가 선호도 계산
    const authorPreferences = this.calculateAuthorPreferences(events);

    // 읽기 패턴 분석
    const readingPattern = this.analyzeReadingPattern(events);

    // 프로파일 업데이트
    await this.userProfileRepository.upsert({
      userId,
      categoryInterests,
      tagInterests,
      authorPreferences,
      readingPattern,
      confidenceScore: this.calculateConfidence(events.length),
      totalEventsAnalyzed: events.length,
      lastCalculatedAt: new Date(),
      profileVersion: 1
    }, ['userId']);

    // 캐시 무효화
    await this.cacheManager.del(`profile:${userId}`);
  }

  /**
   * 카테고리 관심도 계산
   */
  private calculateCategoryInterests(events: UserEvent[]) {
    const categoryStats: Record<string, any> = {};

    for (const event of events) {
      // 포스트 정보 가져오기 (실제로는 JOIN으로 최적화)
      const post = await this.getPost(event.targetId);
      if (!post?.category) continue;

      const cat = post.category;
      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          viewCount: 0,
          totalTime: 0,
          likeCount: 0,
          commentCount: 0,
          interactions: []
        };
      }

      const stats = categoryStats[cat];

      switch (event.eventType) {
        case 'view':
          stats.viewCount++;
          stats.totalTime += event.metadata?.duration || 0;
          break;
        case 'like':
          stats.likeCount++;
          break;
        case 'comment':
          stats.commentCount++;
          break;
      }

      stats.interactions.push(event.createdAt);
    }

    // 점수 계산 및 정규화
    const interests: Record<string, CategoryInterest> = {};
    const maxScore = Math.max(...Object.values(categoryStats).map(s =>
      s.viewCount + s.likeCount * 3 + s.commentCount * 5
    ));

    for (const [category, stats] of Object.entries(categoryStats)) {
      const rawScore = stats.viewCount + stats.likeCount * 3 + stats.commentCount * 5;
      interests[category] = {
        score: rawScore / maxScore, // 0-1 정규화
        viewCount: stats.viewCount,
        totalTime: stats.totalTime,
        avgTime: stats.totalTime / stats.viewCount,
        likeRate: stats.likeCount / stats.viewCount,
        commentRate: stats.commentCount / stats.viewCount,
        lastInteraction: stats.interactions[stats.interactions.length - 1]
      };
    }

    return interests;
  }
}
```

### 3.2 스케줄러 설정
```typescript
// backend/src/recommendation/schedulers/profile-scheduler.service.ts
@Injectable()
export class ProfileSchedulerService {
  constructor(
    @InjectQueue('recommendation') private recommendationQueue: Queue
  ) {}

  /**
   * 매일 새벽 2시에 모든 활성 사용자 프로파일 재계산
   */
  @Cron('0 2 * * *')
  async scheduleProfileCalculation() {
    // 최근 7일 내 활동한 사용자들
    const activeUsers = await this.userRepository.find({
      where: {
        lastLoginAt: MoreThan(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      },
      select: ['id']
    });

    // 각 사용자별로 큐에 작업 추가
    for (const user of activeUsers) {
      await this.recommendationQueue.add(
        'calculate-profile',
        { userId: user.id },
        {
          delay: Math.random() * 3600000, // 1시간 내 랜덤 분산
          removeOnComplete: true,
          removeOnFail: false
        }
      );
    }

    console.log(`Scheduled profile calculation for ${activeUsers.length} users`);
  }

  /**
   * 실시간 업데이트 트리거
   * 중요한 이벤트 발생시 즉시 프로파일 업데이트
   */
  @OnEvent('user.important-action')
  async handleImportantAction(payload: { userId: string, action: string }) {
    // 좋아요, 댓글 등 중요 액션시 5분 후 프로파일 업데이트
    if (['like', 'comment', 'follow'].includes(payload.action)) {
      await this.recommendationQueue.add(
        'calculate-profile',
        { userId: payload.userId },
        {
          delay: 300000, // 5분 후
          removeOnComplete: true
        }
      );
    }
  }
}
```

---

## 🎨 Phase 4: UI/UX 개선 (4주차)

### 4.1 추천 이유 표시
```tsx
// frontend/src/components/PostCard.tsx
interface PostCardProps {
  post: Post;
  recommendation?: {
    reason: string;
    score: number;
    badges: string[];
  };
}

export function PostCard({ post, recommendation }: PostCardProps) {
  return (
    <div className="border rounded-lg p-4">
      {recommendation && (
        <div className="mb-2 flex items-center gap-2">
          {recommendation.badges.map(badge => (
            <span key={badge} className="text-xs bg-gray-100 px-2 py-1 rounded">
              {badge === 'trending' && '🔥 인기'}
              {badge === 'similar' && '👥 유사 사용자'}
              {badge === 'category' && '📁 관심 카테고리'}
              {badge === 'author' && '✍️ 선호 작가'}
            </span>
          ))}
          <span className="text-xs text-gray-500">
            {recommendation.reason}
          </span>
        </div>
      )}

      {/* 포스트 내용 */}
      <h3 className="text-lg font-bold">{post.title}</h3>
      {/* ... */}
    </div>
  );
}
```

### 4.2 피드백 수집
```tsx
// frontend/src/components/FeedbackButtons.tsx
export function FeedbackButtons({ postId }: { postId: string }) {
  const { trackFeedback } = useAnalytics();

  return (
    <div className="flex gap-2 text-sm">
      <button
        onClick={() => trackFeedback(postId, 'not-interested')}
        className="text-gray-500 hover:text-gray-700"
      >
        관심 없음
      </button>
      <button
        onClick={() => trackFeedback(postId, 'save-later')}
        className="text-gray-500 hover:text-gray-700"
      >
        나중에 보기
      </button>
      <button
        onClick={() => trackFeedback(postId, 'report')}
        className="text-gray-500 hover:text-red-500"
      >
        신고
      </button>
    </div>
  );
}
```

---

## 📊 모니터링 대시보드 구현

### 관리자 대시보드 페이지
```tsx
// frontend/src/app/admin/recommendations/page.tsx
export default function RecommendationDashboard() {
  const { data: metrics } = useQuery(['recommendation-metrics'],
    fetchRecommendationMetrics
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">추천 시스템 대시보드</h1>

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="평균 세션 시간"
          value={metrics?.sessionDuration}
          unit="분"
          change={metrics?.sessionDurationChange}
        />
        <MetricCard
          title="클릭률 (CTR)"
          value={metrics?.clickThroughRate}
          unit="%"
          change={metrics?.ctrChange}
        />
        <MetricCard
          title="재방문율"
          value={metrics?.returnRate}
          unit="%"
          change={metrics?.returnRateChange}
        />
        <MetricCard
          title="추천 정확도"
          value={metrics?.accuracy}
          unit="%"
          change={metrics?.accuracyChange}
        />
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg">
          <h3 className="font-bold mb-4">일별 추세</h3>
          <LineChart data={metrics?.dailyTrends} />
        </div>

        <div className="bg-white p-4 rounded-lg">
          <h3 className="font-bold mb-4">알고리즘별 성과</h3>
          <BarChart data={metrics?.algorithmPerformance} />
        </div>
      </div>

      {/* A/B 테스트 결과 */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">진행중인 실험</h2>
        <ExperimentTable experiments={metrics?.activeExperiments} />
      </div>
    </div>
  );
}
```

---

## 🚨 중요 고려사항

### 1. 개인정보 보호
- 모든 사용자 데이터는 익명화 처리
- GDPR/KISA 가이드라인 준수
- 사용자 동의 획득 프로세스 구현
- 데이터 삭제 요청 처리 기능

### 2. 성능 최적화
- Redis 캐싱 적극 활용
- 데이터베이스 인덱스 최적화
- 배치 처리로 실시간 부하 분산
- CDN을 통한 정적 콘텐츠 제공

### 3. 확장성
- 마이크로서비스 아키텍처 고려
- 메시지 큐(RabbitMQ/Kafka) 도입 검토
- 수평적 확장 가능한 설계
- 데이터베이스 샤딩 전략

### 4. 비용 관리
- AWS/GCP 비용 모니터링
- 불필요한 데이터 정기 삭제
- 효율적인 쿼리 작성
- 캐시 TTL 최적화

---

## 📈 성공 지표

### 단기 목표 (1개월)
- [ ] CTR 10% → 15% 증가
- [ ] 평균 세션 시간 5분 → 7분
- [ ] 일일 재방문율 30% → 40%
- [ ] 사용자당 일평균 조회수 3 → 5

### 중기 목표 (3개월)
- [ ] MAU 50% 증가
- [ ] 사용자 만족도 80% 이상
- [ ] 추천 정확도 75% 이상
- [ ] 플랫폼 체류시간 2배 증가

### 장기 목표 (6개월)
- [ ] 바이럴 계수 1.2 이상
- [ ] 유료 전환율 5% 달성
- [ ] 추천 시스템 자체 최적화
- [ ] ML 모델 도입 및 고도화

---

## 🔄 반복 개선 프로세스

1. **매주 금요일**: A/B 테스트 결과 분석
2. **격주 월요일**: 알고리즘 가중치 조정
3. **매월 1일**: 프로파일 알고리즘 업데이트
4. **분기별**: 전체 시스템 리뷰 및 개선

---

*이 문서는 실제 구현 진행에 따라 지속적으로 업데이트됩니다.*