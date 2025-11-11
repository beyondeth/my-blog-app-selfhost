import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService, CacheKeys, CacheTTL } from './cache.service';
import { BlogsService } from '../blogs/blogs.service';
import {
  CacheInvalidationEvents,
  CommentCreatedEvent,
  CommentDeletedEvent,
  BlogUpdatedEvent,
  UserProfileUpdatedEvent,
} from '../common/events/cache.events';

/**
 * 캐시 무효화 이벤트 리스너
 *
 * - Debounce 메커니즘으로 중복 무효화 방지
 * - 표준화된 캐시 키 패턴 사용
 * - 배치 처리로 성능 최적화
 */
@Injectable()
export class CacheInvalidationListener {
  private readonly logger = new Logger(CacheInvalidationListener.name);

  constructor(
    private readonly cacheService: CacheService,
    @Inject(forwardRef(() => BlogsService))
    private readonly blogsService: BlogsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * 포스트 생성 이벤트 처리
   * 새 포스트는 항상 첫 페이지에 나타나므로 첫 페이지만 무효화
   */
  @OnEvent(CacheInvalidationEvents.POST_CREATED, { async: true })
  async handlePostCreated(payload: { postId: string; blogSlug?: string }) {
    this.logger.debug(`🆕 [Post Created] Invalidating cache for: ${payload.postId}`);

    const patterns: string[] = [
      // 홈 피드 첫 페이지
      CacheKeys.FEED_HOME(1),
      // 블로그 피드
      ...(payload.blogSlug ? [CacheKeys.FEED_BLOG(payload.blogSlug, 1)] : []),
    ];

    await this.batchInvalidate(patterns);
  }

  /**
   * 포스트 수정 이벤트 처리
   * 수정된 포스트가 있는 모든 피드 무효화
   */
  @OnEvent(CacheInvalidationEvents.POST_UPDATED, { async: true })
  async handlePostUpdated(payload: { postId: string; blogSlug?: string }) {
    this.logger.debug(`✏️ [Post Updated] Invalidating cache for: ${payload.postId}`);

    const patterns: string[] = [
      // 포스트 개별 캐시
      CacheKeys.POST_CORE(payload.postId),
      CacheKeys.POST_DETAIL(payload.postId),
      // 홈 피드 첫 페이지
      CacheKeys.FEED_HOME(1),
      // 블로그 피드
      ...(payload.blogSlug ? [CacheKeys.FEED_BLOG(payload.blogSlug, 1)] : []),
    ];

    await this.batchInvalidate(patterns);
  }

  /**
   * 포스트 삭제 이벤트 처리
   * 내 블로그 캐시만 즉시 무효화 (성능 최적화)
   *
   * async: false - 동기 처리로 Redis 캐시 무효화 완료 후 응답 반환
   */
  @OnEvent(CacheInvalidationEvents.POST_DELETED, { async: false })
  async handlePostDeleted(payload: { postId: string; blogSlug?: string }) {
    this.logger.debug(`🗑️ [Post Deleted] Invalidating cache for: ${payload.postId}`);

    // 즉시 무효화할 캐시 (내 블로그 + 개별 포스트)
    const urgentPatterns: string[] = [
      // 내 블로그 피드만 즉시 무효화
      ...(payload.blogSlug ? [CacheKeys.PATTERN_BLOG_FEEDS(payload.blogSlug)] : []),
      // 개별 포스트 캐시
      CacheKeys.POST_CORE(payload.postId),
      CacheKeys.POST_DETAIL(payload.postId),
      // 프론트엔드 React Query 키와 일치하는 패턴
      `posts:*:${payload.postId}:*`,
    ];

    // 지연 무효화할 캐시 (홈 피드 - 배치 처리로 성능 유지)
    const delayedPatterns: string[] = [
      // 홈 피드 - 지연 무효화 목록에 추가
      CacheKeys.PATTERN_HOME_PAGES(),
      // 인기 포스트
      CacheKeys.PATTERN_ALL_POPULAR(),
      // 에디터스 픽
      'feed:editor-picks:*',
    ];

    // 즉시 무효화 실행
    await this.batchInvalidate(urgentPatterns, { force: true });
    this.logger.log(`✅ Immediate cache invalidated for deleted post: ${payload.postId}`);

    // 지연 무효화를 위한 큐에 추가 (5분 후 배치 처리)
    await this.scheduleDelayedInvalidation(delayedPatterns, payload.postId);
  }

  /**
   * 에디터스 픽 토글 이벤트 처리
   */
  @OnEvent(CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED, { async: true })
  async handleEditorPickToggled(payload: { postId: string; isPicked: boolean }) {
    this.logger.debug(`⭐ [Editor Pick Toggled] Invalidating cache`);

    // 모든 에디터스 픽 캐시 무효화
    const patterns = [
      'feed:editor-picks:*',  // 모든 에디터스 픽 캐시
    ];

    await this.batchInvalidate(patterns, { force: true });
  }

  /**
   * 인기 포스트 업데이트 이벤트 처리 (확장)
   * 조회수, 좋아요, 댓글 변경 시
   * Phase 3: 포스트 개별 캐시도 무효화 (viewCount, likeCount 표시됨)
   */
  @OnEvent(CacheInvalidationEvents.POST_POPULARITY_UPDATED, { async: true })
  async handlePopularityUpdated(payload: { postId: string }) {
    this.logger.debug(`📊 [Popularity Updated] Invalidating popular feeds`);

    // 인기 포스트 캐시 + 포스트 개별 캐시 무효화
    const patterns = [
      CacheKeys.PATTERN_ALL_POPULAR(),  // 모든 인기 포스트 캐시
      CacheKeys.POST_CORE(payload.postId),  // 포스트 Core 데이터
      CacheKeys.POST_DETAIL(payload.postId),  // 포스트 상세
    ];

    await this.batchInvalidate(patterns); // 인기도 업데이트는 debounce 적용
  }

  // ========== Phase 3: 신규 이벤트 핸들러 ==========

  /**
   * 댓글 생성 이벤트 처리
   * 댓글 수가 popularity_score에 영향을 주므로 인기 포스트도 무효화
   */
  @OnEvent(CacheInvalidationEvents.COMMENT_CREATED, { async: true })
  async handleCommentCreated(payload: CommentCreatedEvent) {
    this.logger.debug(`💬 [Comment Created] Invalidating cache for post: ${payload.postId}`);

    const patterns = [
      // 댓글 페이지네이션 캐시
      `comments:page:first:${payload.postId}:*`,  // 첫 페이지 (모든 정렬 방식)
      `comments:total:${payload.postId}`,   // 댓글 총 개수

      // 답글인 경우 부모 댓글의 답글 목록도 무효화
      ...(payload.parentCommentId ? [
        `comments:replies:first:${payload.parentCommentId}`,
      ] : []),

      // 포스트 상세 (댓글 수 표시됨)
      CacheKeys.POST_CORE(payload.postId),
      CacheKeys.POST_DETAIL(payload.postId),

      // 인기 포스트 (댓글 수는 popularity_score에 영향)
      CacheKeys.PATTERN_ALL_POPULAR(),
    ];

    await this.batchInvalidate(patterns);
  }

  /**
   * 댓글 삭제 이벤트 처리
   * 댓글 트리 전체를 무효화 (답글 구조 변경 가능)
   */
  @OnEvent(CacheInvalidationEvents.COMMENT_DELETED, { async: true })
  async handleCommentDeleted(payload: CommentDeletedEvent) {
    this.logger.debug(`🗑️ [Comment Deleted] Invalidating cache for post: ${payload.postId}`);

    const patterns = [
      // 댓글 전체 트리 무효화 (구조 변경)
      `comments:*:${payload.postId}:*`,
      `comments:tree:${payload.postId}`,

      // 포스트 상세
      CacheKeys.POST_CORE(payload.postId),
      CacheKeys.POST_DETAIL(payload.postId),

      // 인기 포스트
      CacheKeys.PATTERN_ALL_POPULAR(),
    ];

    await this.batchInvalidate(patterns, { force: true });
  }

  /**
   * 블로그 설정 변경 이벤트 처리
   * isPublic, allowComments 변경 시 전체 피드 무효화 필요
   */
  @OnEvent(CacheInvalidationEvents.BLOG_UPDATED, { async: true })
  async handleBlogUpdated(payload: BlogUpdatedEvent) {
    this.logger.debug(`📝 [Blog Updated] Invalidating cache for blog: ${payload.blogSlug}`);

    const patterns = [
      // 블로그 정보 캐시
      `blog:info:${payload.blogSlug}`,
      `blog:stats:${payload.blogSlug}`,
      `blog:slug:${payload.blogSlug}`,
      `blog:id:${payload.blogId}`,
    ];

    // isPublic 변경 시 모든 피드 무효화 (공개/비공개 전환)
    if (payload.changes.isPublic) {
      patterns.push(
        CacheKeys.PATTERN_HOME_PAGES(),           // 홈 피드 전체
        `feed:blog:${payload.blogSlug}:*`,        // 블로그 피드 전체
        CacheKeys.PATTERN_ALL_POPULAR(),          // 인기 포스트
      );
    }

    // allowComments 변경은 블로그 정보만 무효화
    await this.batchInvalidate(patterns, {
      force: !!payload.changes.isPublic  // isPublic 변경 시 즉시 무효화
    });
  }

  /**
   * 사용자 프로필 업데이트 이벤트 처리
   * 프로필 이미지, 이름 변경 시 모든 관련 캐시 무효화
   */
  @OnEvent(CacheInvalidationEvents.USER_PROFILE_UPDATED, { async: true })
  async handleUserProfileUpdated(payload: UserProfileUpdatedEvent) {
    this.logger.debug(`👤 [User Profile Updated] Invalidating cache for user: ${payload.userId}`);

    const patterns = [
      // 사용자 캐시
      `user:id:${payload.userId}`,
      `user:profile:${payload.userId}`,

      // 사용자 블로그 (프로필 이미지 변경 시 블로그에도 표시)
      `blog:user:${payload.userId}`,
    ];

    // 블로그 identifier 캐시도 무효화 (최적화된 조회 사용)
    const blogIdentifier = await this.getUserBlogIdentifier(payload.userId);
    if (blogIdentifier) {
      patterns.push(
        `blog:identifier:${blogIdentifier}`,  // identifier_to_blog 캐시 무효화
        `blog:identifier:@${blogIdentifier}`  // @가 붙은 경우도 대비
      );
      this.logger.debug(`🔗 [Blog Cache] Added blog identifier cache invalidation: ${blogIdentifier}`);
    }

    // 프로필 이미지나 이름 변경 시 포스트 목록도 무효화 (author 정보 포함)
    if (payload.changes.profileImage || payload.changes.displayName) {
      patterns.push(
        `user:${payload.userId}:*`,  // user:{userId}:*
        // 모든 피드 첫 페이지 (author 정보 표시됨)
        CacheKeys.FEED_HOME(1),
        CacheKeys.PATTERN_ALL_POPULAR(),
      );
    }

    await this.batchInvalidate(patterns);
  }

  /**
   * 배치 캐시 무효화
   * CacheService의 invalidatePatterns 사용
   * 실패 시 재시도 로직 포함
   */
  private async batchInvalidate(
    patterns: string[],
    options?: { force?: boolean; maxRetries?: number }
  ): Promise<void> {
    const maxRetries = options?.maxRetries || 2;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        await this.cacheService.invalidatePatterns(patterns, options);
        // 성공 시 로그 남기고 종료
        if (patterns.length > 0) {
          this.logger.debug(`✅ Cache invalidated successfully: ${patterns.length} patterns`);
        }
        return;
      } catch (error) {
        retryCount++;

        if (retryCount > maxRetries) {
          // 최대 재시도 횟수 초과 시 에러 로그
          this.logger.error(
            `❌ Failed to invalidate cache after ${maxRetries} retries. Patterns: ${patterns.join(', ')}`,
            error.stack
          );

          // 실패한 패턴을 Redis에 저장하여 나중에 재시도할 수 있음
          // 여기서는 간단히 실패 로그만 남김
          return;
        }

        // 재시도 전 대기 (지수 백오프)
        const delay = Math.pow(2, retryCount) * 100; // 200ms, 400ms
        this.logger.warn(
          `⚠️ Cache invalidation failed (attempt ${retryCount}/${maxRetries}), retrying in ${delay}ms...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * 지연된 캐시 무효화 스케줄링
   * 5분 후 홈 피드 캐시 정리 (배치 처리로 성능 유지)
   */
  private async scheduleDelayedInvalidation(
    patterns: string[],
    postId: string
  ): Promise<void> {
    // Redis에 지연 작업 큐에 추가
    const delayedKey = `delayed:invalidation:${postId}`;
    const delayedData = {
      patterns,
      scheduledAt: Date.now(),
      postId,
    };

    // 5분 TTL로 저장 (5분 후 자동 정리)
    await this.cacheService.set(
      delayedKey,
      delayedData,
      CacheTTL.DELETED_POSTS_CLEANUP
    );

    this.logger.debug(`⏰ Scheduled delayed invalidation for post ${postId}`);
  }

  /**
   * 사용자의 블로그 정보를 캐시 포함하여 조회
   * DB 쿼리 최적화를 위해 캐시를 먼저 확인
   */
  private async getUserBlogIdentifier(userId: string): Promise<string | null> {
    try {
      // 1. 캐시에서 먼저 조회
      const cacheKey = CacheKeys.BLOG_BY_USER(userId);
      let userBlog = await this.cacheService.get(cacheKey);

      if (!userBlog) {
        // 2. 캐시에 없으면 DB 조회
        userBlog = await this.blogsService.findByUserId(userId);
        // 3. 조회된 결과를 캐시에 저장 (30분)
        if (userBlog) {
          await this.cacheService.set(cacheKey, userBlog, CacheTTL.EXTRA_LONG);
        }
      }

      return (userBlog as any)?.identifier || null;
    } catch (error) {
      this.logger.warn(`Failed to get user blog identifier: ${error.message}`);
      return null;
    }
  }

  /**
   * 사용자 아바타 업데이트 이벤트 처리
   * 프로필 이미지 변경 시 관련 캐시를 즉시 무효화하고 CDN 캐시도 정리
   */
  @OnEvent(CacheInvalidationEvents.USER_AVATAR_UPDATED, { async: true })
  async handleUserAvatarUpdated(payload: {
    userId: string;
    username?: string;
    oldProfileImage?: string;
    newProfileImage: string;
  }) {
    this.logger.debug(`👤 [User Avatar Updated] Invalidating cache for user: ${payload.userId}`);

    const patterns = [
      // 홈 피드 캐시 (프로필 이미지가 포함된 포스트)
      `feed:home:*`,
      // 인기 포스트 캐시
      `posts:popular:*`,
      // 사용자 관련 캐시 (표준화된 패턴)
      `user:id:${payload.userId}`,
      `user:profile:${payload.userId}`,
      // JWT 검증 캐시
      `user_validate_${payload.userId}`,
      // 사용자 관련 모든 캐시
      `user:${payload.userId}:*`,
    ];

    // 블로그 관련 캐시도 무효화 (최적화된 조회 사용)
    const blogIdentifier = await this.getUserBlogIdentifier(payload.userId);
    if (blogIdentifier) {
      patterns.push(
        `blog:identifier:${blogIdentifier}`,
        `blog:identifier:@${blogIdentifier}`,
        `feed:blog:${blogIdentifier}:*`
      );
    }

    // 즉시 무효화 실행
    await this.batchInvalidate(patterns, { force: true });

    // CDN 캐시 무효화
    if (payload.oldProfileImage) {
      try {
        // CDN 서비스 동적 가져오기
        const { CdnService } = await import('../files/services/cdn.service');
        const cdnService = this.moduleRef.get(CdnService, { strict: false });

        if (cdnService && (payload.oldProfileImage.startsWith('v2/') || payload.oldProfileImage.startsWith('uploads/'))) {
          await cdnService.invalidateCache([payload.oldProfileImage]);
          this.logger.debug(`✅ CDN cache invalidated for old avatar: ${payload.oldProfileImage}`);
        }
      } catch (error) {
        this.logger.warn(`CDN cache invalidation failed for avatar: ${error.message}`);
      }
    }

    this.logger.log(`✅ Avatar update cache invalidated: ${patterns.length} patterns`);
  }
}