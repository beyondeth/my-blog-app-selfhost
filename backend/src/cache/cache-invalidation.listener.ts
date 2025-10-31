import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService, CacheKeys } from './cache.service';

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
  @OnEvent('post.created', { async: true })
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
  @OnEvent('post.updated', { async: true })
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
  @OnEvent('post.deleted', { async: false })
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
  @OnEvent('post.editorPick.toggled', { async: true })
  async handleEditorPickToggled(payload: { postId: string; isPicked: boolean }) {
    this.logger.debug(`⭐ [Editor Pick Toggled] Invalidating cache`);

    // 모든 에디터스 픽 캐시 무효화
    const patterns = [
      'feed:editor-picks:*',  // 모든 에디터스 픽 캐시
    ];

    await this.batchInvalidate(patterns, { force: true });
  }

  /**
   * 인기 포스트 업데이트 이벤트 처리
   * 조회수, 좋아요, 댓글 변경 시
   */
  @OnEvent('post.popularity.updated', { async: true })
  async handlePopularityUpdated(payload: { postId: string }) {
    this.logger.debug(`📊 [Popularity Updated] Invalidating popular feeds`);

    // 인기 포스트 캐시 무효화
    const patterns = [
      CacheKeys.PATTERN_ALL_POPULAR(),  // 모든 인기 포스트 캐시
    ];

    await this.batchInvalidate(patterns); // 인기도 업데이트는 debounce 적용
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