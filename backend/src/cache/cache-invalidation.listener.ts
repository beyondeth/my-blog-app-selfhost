import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService, CacheKeys } from './cache.service';
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
   * 모든 관련 피드에서 해당 포스트 제거
   *
   * async: false - 동기 처리로 Redis 캐시 무효화 완료 후 응답 반환
   * 프론트엔드 refetch 시 이미 캐시가 무효화되어 있어 Race condition 방지
   */
  @OnEvent(CacheInvalidationEvents.POST_DELETED, { async: false })
  async handlePostDeleted(payload: { postId: string; blogSlug?: string }) {
    this.logger.debug(`🗑️ [Post Deleted] Invalidating cache for: ${payload.postId}`);

    // 삭제 시 영향받는 모든 캐시 패턴
    const patterns: string[] = [
      // 홈 피드 - 모든 페이지
      CacheKeys.PATTERN_HOME_PAGES(),
      // 블로그 피드 - 모든 페이지
      ...(payload.blogSlug ? [CacheKeys.PATTERN_BLOG_FEEDS(payload.blogSlug)] : []),
      // 인기 포스트
      CacheKeys.PATTERN_ALL_POPULAR(),
      // 에디터스 픽
      'feed:editor-picks:*',  // 와일드카드 패턴
    ];

    await this.batchInvalidate(patterns, { force: true }); // 삭제는 즉시 처리

    // 개별 포스트 캐시 삭제
    await this.cacheService.delete(CacheKeys.POST_CORE(payload.postId));
    await this.cacheService.delete(CacheKeys.POST_DETAIL(payload.postId));

    this.logger.log(`✅ Cache invalidated for deleted post: ${payload.postId}`);
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
   */
  private async batchInvalidate(
    patterns: string[],
    options?: { force?: boolean }
  ): Promise<void> {
    await this.cacheService.invalidatePatterns(patterns, options);
  }

}