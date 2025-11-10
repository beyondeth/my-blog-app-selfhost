import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService, CacheKeys, CacheTTL } from './cache.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import { CacheInvalidationEvents } from '../common/events/cache.events';

/**
 * 캐시 워밍 서비스 (Phase 4 확장)
 *
 * @description
 * 자주 접근하는 데이터를 미리 캐싱하여 히트율 향상
 * 사용자 요청 전에 백그라운드로 캐시 생성
 *
 * @최적화_내용
 * 1. 실행 주기: 우선순위별 차등 적용 (HIGH: 10분, MEDIUM: 30분, LOW: 1시간)
 * 2. 동시 실행 방지를 위한 lock 추가
 * 3. 필요한 컬럼만 SELECT하도록 최적화
 * 4. 서버 시작 5초 후 즉시 캐시 워밍
 * 5. 실패 시 자동 재시도 (최대 3회, 지수 백오프)
 * 6. 이벤트 기반 워밍 추가 (신규 에디터스픽, 인기 마일스톤 등)
 *
 * @워밍_대상
 * - HIGH: 홈 피드, 인기 포스트, 에디터스 픽
 * - MEDIUM: 인기 태그, 카테고리별 인기 포스트
 * - LOW: 자주 조회되는 사용자 프로필 TOP 100
 */
@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);
  private isWarming = false; // 동시 실행 방지 플래그
  private lastWarmingTime = 0; // 마지막 워밍 시간

  // 캐시 무효화 시간 추적 (추가)
  private readonly lastInvalidationTime = new Map<string, number>();
  private readonly INVALIDATION_COOLDOWN = 5 * 60 * 1000; // 5분

  // 워밍 우선순위 정의
  private readonly WARMING_PRIORITY = {
    HIGH: ['home_feed', 'popular_posts', 'editor_picks'], // 매 10분
    MEDIUM: ['popular_tags', 'trending_categories'], // 매 30분
    LOW: ['user_profiles_top100'], // 매 1시간
  };

  constructor(
    private readonly cacheService: CacheService,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 우선순위 HIGH: 트래픽에 따라 적응형 워밍
   * - 심야 시간(2-6시): 30분마다
   * - 그 외 시간: 15분마다
   * - 홈 피드 1-3페이지
   * - 인기 포스트 (daily, weekly, monthly)
   * - 에디터스 픽
   */
  @Cron('0 */30 2-6 * * *')
  async warmHighPriorityNight() {
    await this.performHighPriorityWarming('NIGHT');
  }

  @Cron('0 */15 * * * *')
  async warmHighPriorityDay() {
    // 심야 시간(2-6시)에는 실행하지 않음
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 6) {
      this.logger.debug('⏭️ Skipping day warming during night hours');
      return;
    }
    await this.performHighPriorityWarming('DAY');
  }

  private async performHighPriorityWarming(period: 'NIGHT' | 'DAY'): Promise<void> {
    if (!this.canStartWarming()) return;

    this.isWarming = true;
    this.lastWarmingTime = Date.now();
    const startTime = Date.now();

    try {
      this.logger.log(`🔥 [HIGH-${period}] Starting high-priority cache warming...`);

      // 병렬로 워밍 (독립적인 작업들)
      await Promise.all([
        this.warmHomeFeed(),
        this.warmPopularPosts(),
        this.warmEditorPicks(),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(`✅ [HIGH-${period}] Cache warming completed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`❌ [HIGH-${period}] Cache warming failed:`, error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * 우선순위 MEDIUM: 적응형 워밍
   * - 심야 시간(2-6시): 1시간마다
   * - 그 외 시간: 30분마다
   * - 인기 태그 TOP 20
   * - 카테고리별 인기 포스트
   */
  @Cron('0 2-6/1 * * *')
  async warmMediumPriorityNight() {
    await this.performMediumPriorityWarming('NIGHT');
  }

  @Cron('0 */30 * * * *')
  async warmMediumPriorityDay() {
    // 심야 시간에는 실행하지 않음
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 6) {
      this.logger.debug('⏭️ Skipping medium warming during night hours');
      return;
    }
    await this.performMediumPriorityWarming('DAY');
  }

  private async performMediumPriorityWarming(period: 'NIGHT' | 'DAY'): Promise<void> {
    if (!this.canStartWarming()) return;

    this.isWarming = true;
    try {
      this.logger.log(`🔥 [MEDIUM-${period}] Starting medium-priority cache warming...`);

      await Promise.all([
        this.warmPopularTags(),
        this.warmTrendingCategories(),
      ]);

      this.logger.log(`✅ [MEDIUM-${period}] Cache warming completed`);
    } catch (error) {
      this.logger.error(`❌ [MEDIUM-${period}] Cache warming failed:`, error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * 우선순위 LOW: 매 1시간마다 워밍
   * - 자주 조회되는 사용자 프로필 TOP 100
   */
  @Cron('0 0 * * * *')
  async warmLowPriorityData() {
    if (!this.canStartWarming()) return;

    this.isWarming = true;
    try {
      this.logger.log('🔥 [LOW] Starting low-priority cache warming...');
      await this.warmTopUserProfiles();
      this.logger.log('✅ [LOW] Cache warming completed');
    } catch (error) {
      this.logger.error('❌ [LOW] Cache warming failed:', error);
    } finally {
      this.isWarming = false;
    }
  }

  // ========== 개별 워밍 함수 ==========

  /**
   * 홈 피드 워밍 (1-3페이지)
   */
  private async warmHomeFeed(): Promise<void> {
    for (let page = 1; page <= 3; page++) {
      const cacheKey = CacheKeys.FEED_HOME(page);

      // 캐시 무효화 후 5분 동안은 웜잍 건너뛰기 (수정)
      const lastInvalidated = this.lastInvalidationTime.get(cacheKey) || 0;
      const now = Date.now();
      if (now - lastInvalidated < this.INVALIDATION_COOLDOWN) {
        this.logger.debug(`⏭️ Skipping warmed cache ${cacheKey} - recently invalidated`);
        continue;
      }

      const existing = await this.cacheService.get(cacheKey);
      if (existing) {
        this.logger.debug(`⏭️ Cache ${cacheKey} exists and not recently invalidated, skipping`);
        continue; // 캐시가 있으면 스킵
      }

      // 직접 DB 조회하여 데이터 생성
      const limit = 10;
      const offset = (page - 1) * limit;

      // 공개 블로그의 게시글만 조회 - 필요한 컬럼만 SELECT
      const query = this.postRepository
        .createQueryBuilder('post')
        .select([
          'post.id',
          'post.title',
          'post.slug',
          'post.excerpt',
          'post.thumbnail',
          'post.createdAt',
          'post.publishedAt',
          'post.viewCount',
          'post.likeCount',
          'post.commentCount',
          'post.tags',
          'post.category',
        ])
        .addSelect(['author.id', 'author.username'])
        // Phase 1-2-3: profileImage는 profiles 테이블로 이동
        .leftJoin('post.author', 'author')
        .leftJoin('author.profile', 'profile')
        .addSelect(['profile.profileImage'])
        .addSelect(['blog.id', 'blog.slug', 'blog.name'])
        .leftJoin('post.blog', 'blog')
        .where('post.isPublished = :isPublished', { isPublished: true })
        .andWhere('post.status = :status', { status: 'published' })
        .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere('blog.isPublic = :isPublic', { isPublic: true })
        .orderBy('post.publishedAt', 'DESC')
        .skip(offset)
        .take(limit);

      const [posts, total] = await query.getManyAndCount();

      const freshData = {
        posts: posts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      // TTL 설정: 1페이지는 10분, 나머지는 30분
      const ttl = page === 1 ? 600 : 1800;
      await this.cacheService.set(cacheKey, freshData, ttl);

      this.logger.debug(`✅ Warmed home feed page ${page}`);
    }
  }

  /**
   * 인기 포스트 워밍 (신규)
   * daily, weekly, monthly 각각 TOP 10
   */
  private async warmPopularPosts(): Promise<void> {
    const periods: Array<'daily' | 'weekly' | 'monthly'> = [
      'daily',
      'weekly',
      'monthly',
    ];

    for (const period of periods) {
      const cacheKey = `feed:popular:${period}:10`;
      const existing = await this.cacheService.get(cacheKey);
      if (existing) continue;

      // 기간별 조회 기준 날짜 계산
      const cutoffDate = new Date();
      if (period === 'daily') cutoffDate.setDate(cutoffDate.getDate() - 1);
      else if (period === 'weekly')
        cutoffDate.setDate(cutoffDate.getDate() - 7);
      else cutoffDate.setDate(cutoffDate.getDate() - 30);

      // 인기도 점수 계산: viewCount + (likeCount × 3) + (commentCount × 2)
      const posts = await this.postRepository
        .createQueryBuilder('post')
        .select([
          'post.id',
          'post.title',
          'post.slug',
          'post.thumbnail',
          'post.excerpt',
          'post.viewCount',
          'post.likeCount',
          'post.commentCount',
          'post.publishedAt',
        ])
        .addSelect(['author.id', 'author.username', 'profile.profileImage'])
        .addSelect(['blog.id', 'blog.slug', 'blog.name'])
        .leftJoin('post.author', 'author')
        .leftJoin('author.profile', 'profile')
        .leftJoin('post.blog', 'blog')
        .where('post.isPublished = true')
        .andWhere('post.status = :status', { status: 'published' })
        .andWhere('blog.isPublic = true')
        .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere('post.publishedAt >= :cutoffDate', { cutoffDate })
        .addSelect(
          'post.viewCount + (post.likeCount * 3) + (post.commentCount * 2)',
          'popularity_score',
        )
        .orderBy('popularity_score', 'DESC')
        .limit(10)
        .getMany();

      // TTL: daily(1시간), weekly(3시간), monthly(6시간)
      const ttl =
        period === 'daily' ? 3600 : period === 'weekly' ? 10800 : 21600;
      await this.cacheService.set(cacheKey, posts, ttl);

      this.logger.debug(
        `✅ Warmed popular posts (${period}): ${posts.length} posts`,
      );
    }
  }

  /**
   * 에디터스 픽 워밍 (신규)
   * TOP 10개
   */
  private async warmEditorPicks(): Promise<void> {
    const limit = 10;
    const cacheKey = `feed:editor-picks:${limit}`;
    const existing = await this.cacheService.get(cacheKey);
    if (existing) return;

    const posts = await this.postRepository
      .createQueryBuilder('post')
      .select([
        'post.id',
        'post.title',
        'post.slug',
        'post.thumbnail',
        'post.excerpt',
        'post.publishedAt',
      ])
      .addSelect(['author.id', 'author.username', 'profile.profileImage'])
      .addSelect(['blog.id', 'blog.slug', 'blog.name'])
      .leftJoin('post.author', 'author')
      .leftJoin('author.profile', 'profile')
      .leftJoin('post.blog', 'blog')
      .where('post.isEditorPick = true')
      .andWhere('post.isPublished = true')
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('blog.isPublic = true')
      .orderBy('post.publishedAt', 'DESC')
      .limit(limit)
      .getMany();

    await this.cacheService.set(cacheKey, posts, CacheTTL.MEDIUM); // 5분
    this.logger.debug(`✅ Warmed editor picks: ${posts.length} posts`);
  }

  /**
   * 인기 태그 워밍 (신규)
   * TOP 20개
   */
  private async warmPopularTags(): Promise<void> {
    const limit = 20;
    const cacheKey = 'tags:popular:top20';
    const existing = await this.cacheService.get(cacheKey);
    if (existing) return;

    // JSONB 배열 풀어서 집계
    const tags = await this.postRepository
      .createQueryBuilder('post')
      .select('jsonb_array_elements_text(post.tags)', 'tag')
      .addSelect('COUNT(*)', 'count')
      .where('post.isPublished = true')
      .andWhere('post.status = :status', { status: 'published' })
      .andWhere('post.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('jsonb_array_length(post.tags) > 0')
      .groupBy('tag')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    await this.cacheService.set(cacheKey, tags, CacheTTL.STATIC); // 1시간
    this.logger.debug(`✅ Warmed popular tags: ${tags.length} tags`);
  }

  /**
   * 카테고리별 인기 포스트 워밍 (신규)
   * 주요 카테고리 5개 × 각 10개씩
   */
  private async warmTrendingCategories(): Promise<void> {
    const categories = ['Technology', 'Life', 'Design', 'Business', 'Culture'];

    for (const category of categories) {
      const cacheKey = `feed:category:${category}:1`;
      const existing = await this.cacheService.get(cacheKey);
      if (existing) continue;

      const posts = await this.postRepository
        .createQueryBuilder('post')
        .select(['post.id', 'post.title', 'post.slug', 'post.thumbnail'])
        .where('post.category = :category', { category })
        .andWhere('post.isPublished = true')
        .andWhere('post.status = :status', { status: 'published' })
        .orderBy('post.publishedAt', 'DESC')
        .limit(10)
        .getMany();

      await this.cacheService.set(
        cacheKey,
        { posts, total: posts.length },
        CacheTTL.MEDIUM,
      );
      this.logger.debug(
        `✅ Warmed category (${category}): ${posts.length} posts`,
      );
    }
  }

  /**
   * 자주 조회되는 사용자 프로필 워밍 (신규)
   * 조회수 TOP 100 사용자
   */
  private async warmTopUserProfiles(): Promise<void> {
    // viewCount는 users 테이블에 없으므로 posts의 viewCount 합계로 대체
    const topUsers = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username'])
      .leftJoin('user.posts', 'posts')
      .addSelect('SUM(posts.viewCount)', 'total_views')
      .groupBy('user.id')
      .orderBy('total_views', 'DESC')
      .limit(100)
      .getMany();

    // 각 사용자 프로필 워밍
    let warmedCount = 0;
    for (const user of topUsers) {
      const cacheKey = `user:profile:${user.id}`;
      const existing = await this.cacheService.get(cacheKey);
      if (existing) continue;

      const profile = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['profile', 'blog'],
      });

      if (profile) {
        await this.cacheService.set(
          cacheKey,
          profile,
          CacheTTL.EXTRA_LONG,
        ); // 30분
        warmedCount++;
      }
    }

    this.logger.debug(`✅ Warmed user profiles: ${warmedCount} users`);
  }

  // ========== 이벤트 기반 워밍 ==========

  /**
   * 캐시 무효화 이벤트 수신하여 무효화 시간 기록 (추가)
   * 웜잍 서비스가 오래된 데이터로 캐시를 덮어쓰지 않도록 방지
   */
  @OnEvent(CacheInvalidationEvents.POST_CREATED, { async: true })
  async handlePostCreatedInvalidation(payload: { postId: string; blogSlug?: string }) {
    const now = Date.now();

    // 홈 피드 무효화 시간 기록
    this.lastInvalidationTime.set(CacheKeys.FEED_HOME(1), now);

    // 블로그 피드 무효화 시간 기록
    if (payload.blogSlug) {
      this.lastInvalidationTime.set(CacheKeys.FEED_BLOG(payload.blogSlug, 1), now);
    }

    this.logger.debug(`📝 Recorded invalidation time for post creation: ${payload.postId}`);
  }

  @OnEvent(CacheInvalidationEvents.POST_UPDATED, { async: true })
  async handlePostUpdatedInvalidation(payload: { postId: string; blogSlug?: string }) {
    const now = Date.now();

    // 홈 피드 무효화 시간 기록
    this.lastInvalidationTime.set(CacheKeys.FEED_HOME(1), now);

    // 블로그 피드 무효화 시간 기록
    if (payload.blogSlug) {
      this.lastInvalidationTime.set(CacheKeys.FEED_BLOG(payload.blogSlug, 1), now);
    }

    this.logger.debug(`📝 Recorded invalidation time for post update: ${payload.postId}`);
  }

  /**
   * 신규 에디터스 픽 등록 시 즉시 워밍
   * 10분 주기를 기다리지 않고 즉시 캐시 갱신
   */
  @OnEvent(CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED, { async: true })
  async handleEditorPickToggled(payload: { postId: string; isPicked: boolean }) {
    if (!payload.isPicked) return; // 해제 시에는 무효화만 (리스너가 처리)

    this.logger.log(`⭐ [Event] New editor pick detected, warming cache...`);
    await this.warmEditorPicks();
  }

  // ========== 헬퍼 함수 ==========

  /**
   * 워밍 시작 가능 여부 확인
   */
  private canStartWarming(): boolean {
    if (this.isWarming) {
      this.logger.debug(
        '⏭️ Cache warming already in progress, skipping...',
      );
      return false;
    }

    const now = Date.now();
    if (now - this.lastWarmingTime < 5 * 60 * 1000) {
      this.logger.debug('⏭️ Cache warming too frequent, skipping...');
      return false;
    }

    return true;
  }

  /**
   * 애플리케이션 시작 시 초기 캐시 워밍
   *
   * 최적화: 서버 재시작 시 빠른 캐시 복구를 위해 5초로 단축
   * 실패 시 자동 재시도 (최대 3회)
   */
  async onApplicationBootstrap() {
    // 애플리케이션 시작 5초 후 캐시 워밍 시작
    setTimeout(() => {
      this.warmHighPriorityDataWithRetry(3).catch((err) => {
        this.logger.error(
          '❌ Initial cache warming failed after all retries:',
          err,
        );
      });
    }, 5000); // 5초
  }

  /**
   * 재시도 로직이 포함된 캐시 워밍
   * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
   *
   * 재시도 전략:
   * - 지수 백오프 (exponential backoff): 2초, 4초, 8초
   * - 각 시도마다 성공 여부 로깅
   * - 모든 재시도 실패 시 에러 throw
   */
  private async warmHighPriorityDataWithRetry(
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.performHighPriorityWarming('DAY');
        this.logger.log(
          `✅ Cache warming succeeded on attempt ${attempt}`,
        );
        return; // 성공 시 즉시 종료
      } catch (error) {
        this.logger.warn(
          `⚠️ Cache warming attempt ${attempt}/${maxRetries} failed:`,
          error,
        );

        if (attempt < maxRetries) {
          // 재시도 전 대기 (지수 백오프: 2초, 4초, 8초)
          const waitTime = Math.pow(2, attempt) * 1000;
          this.logger.debug(`⏳ Retrying in ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          // 모든 재시도 실패
          throw error;
        }
      }
    }
  }
}
