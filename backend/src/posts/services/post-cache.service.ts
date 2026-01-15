import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { CacheService, CacheKeys, CacheTTL } from "../../cache/cache.service";
import { CacheMetricsService } from "../../metrics/cache-metrics.service";
import { PostResponseDto } from "../dto/post-response.dto";
import {
  CacheInvalidationEvents,
  EditorPickToggledEvent,
  PostThumbnailUpdatedEvent,
} from "../../common/events/cache.events";
import { CloudflareService } from "../../cloudflare/cloudflare.service";

/**
 * 포스트 관련 캐시 관리 서비스
 *
 * 책임:
 * - 포스트 데이터 캐싱 및 무효화
 * - 캐시 스탬프프 방지 (분산 락)
 * - 인기 포스트 캐싱
 * - 관련 캐시 일괄 삭제
 */
@Injectable()
export class PostCacheService {
  private readonly logger = new Logger(PostCacheService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheMetricsService: CacheMetricsService,
    private readonly cloudflareService: CloudflareService,
  ) {}

  /**
   * 포스트 데이터 캐시에서 조회
   *
   * @param id 포스트 ID
   * @returns 캐시된 데이터 또는 null
   */
  async getPostCache(id: string): Promise<any> {
    const cacheKey = CacheKeys.POST_CORE(id);
    return this.cacheService.get(cacheKey);
  }

  /**
   * 포스트 데이터 캐시에 저장
   *
   * @param id 포스트 ID
   * @param data 저장할 데이터 (실시간 카운트 제외)
   * @param ttl 캐시 만료 시간 (초)
   */
  async setPostCache(id: string, data: any, ttl?: number): Promise<void> {
    const cacheKey = CacheKeys.POST_CORE(id);
    await this.cacheService.set(cacheKey, data, ttl);
    this.logger.debug(`✅ Cached post core data: ${id}`);
  }

  /**
   * 포스트 캐시 삭제
   *
   * @param id 포스트 ID
   */
  async deletePostCache(id: string): Promise<void> {
    const cacheKey = CacheKeys.POST_CORE(id);
    await this.cacheService.del(cacheKey);
    this.logger.debug(`❌ Deleted post cache: ${id}`);
  }

  /**
   * 인기 포스트 캐시 조회
   *
   * @param period 기간 (daily, weekly, monthly)
   * @param limit 가져올 개수
   * @returns 캐시된 인기 포스트 또는 null
   */
  async getPopularPostsCache(
    period: "daily" | "weekly" | "monthly",
    limit: number,
  ): Promise<any> {
    const cacheKey = CacheKeys.FEED_POPULAR(period, limit);
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for popular posts: ${cacheKey}`);
      this.cacheMetricsService.recordPostCacheHit();
    }

    return cached;
  }

  /**
   * 인기 포스트 캐시 저장
   *
   * @param period 기간
   * @param limit 개수
   * @param data 저장할 데이터
   * @param ttl 캐시 만료 시간
   */
  async setPopularPostsCache(
    period: "daily" | "weekly" | "monthly",
    limit: number,
    data: any,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = CacheKeys.FEED_POPULAR(period, limit);
    await this.cacheService.set(cacheKey, data, ttl);
    this.logger.debug(`Cached popular posts: ${cacheKey} with TTL: ${ttl}s`);
  }

  /**
   * 포스트 생성 후 관련 캐시 즉시 삭제
   *
   * @param blogSlug 블로그 slug (패턴 삭제용)
   * @param blogId 블로그 ID (정확한 키 삭제용)
   * @param postId 생성된 포스트 ID (선택사항)
   */
  async invalidateRelatedCache(
    blogSlug: string,
    blogId?: string,
    postId?: string,
  ): Promise<void> {
    try {
      // 1. 홈 피드 캐시 삭제 (처음 1페이지만)
      await this.cacheService.del(CacheKeys.FEED_HOME(1));

      // 2. 블로그 피드 캐시 삭제 (처음 1페이지만)
      if (blogId) {
        await this.cacheService.del(CacheKeys.FEED_BLOG(blogId, 1));
      }
      if (blogSlug && blogSlug !== blogId) {
        await this.cacheService.del(CacheKeys.FEED_BLOG(blogSlug, 1));
      }

      // 3. 패턴 기반 대규모 삭제 (모든 관련 캐시)
      await this.cacheService.deletePattern("feed:home:page:*");

      if (blogId) {
        await this.cacheService.deletePattern(`feed:blog:${blogId}:page:*`);
      }
      if (blogSlug) {
        await this.cacheService.deletePattern(`feed:blog:${blogSlug}:page:*`);
      }

      // 포스트 관련 패턴
      await this.cacheService.deletePattern("post:*");
      await this.cacheService.deletePattern("feed:popular:*");

      // 4. 인기 게시물 캐시 삭제
      await this.cacheService.del(CacheKeys.FEED_EDITOR_PICKS());

      // 5. 특정 포스트 캐시 삭제 (postId가 있는 경우)
      if (postId) {
        await this.cacheService.del(CacheKeys.POST_CORE(postId));
      }

      this.logger.log(
        `✅ [Post Cache] Invalidated all cache for blog: ${blogSlug}${postId ? ` (post: ${postId})` : ""}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 포스트 업데이트 시 캐시 무효화
   *
   * @param postId 포스트 ID
   * @param blogSlug 블로그 slug
   * @param blogId 블로그 ID
   */
  async invalidatePostUpdateCache(
    postId: string,
    blogSlug: string,
    blogId: string,
  ): Promise<void> {
    try {
      // 1. 특정 포스트 캐시 삭제
      await this.cacheService.del(CacheKeys.POST_CORE(postId));

      // 2. 관련 피드 캐시 삭제 (업데이트된 포스트가 목록에 반영되도록)
      await this.invalidateRelatedCache(blogSlug, blogId);

      this.logger.log(`✅ [Post Update] Invalidated cache for post: ${postId}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate post update cache: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Editor's Pick 피드 캐시 즉시 무효화
   *
   * @param postId 관련 포스트 ID (로그용)
   */
  async invalidateEditorPicksCache(postId?: string): Promise<void> {
    try {
      this.logger.log(
        `🌐 [CDN Cache] Purging Cloudflare cache for Editor's Picks...`,
      );

      await this.cacheService.del(CacheKeys.FEED_EDITOR_PICKS());
      await this.cacheService.deletePattern("feed:editor-picks:*");
      const cloudflareSuccess = await this.cloudflareService.purgeEditorPicksCache();
      if (cloudflareSuccess) {
        this.logger.log(
          `✅ [CDN Cache] Successfully purged Cloudflare cache for Editor's Picks`,
        );
      } else {
        this.logger.warn(
          `⚠️ [CDN Cache] Failed to purge Cloudflare cache for Editor's Picks`,
        );
      }

      this.logger.log(
        `✅ [Editor's Pick Cache] Invalidated editor picks${postId ? ` (post: ${postId})` : ""}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate editor picks cache: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 포스트 삭제 시 캐시 무효화
   *
   * @param postId 삭제된 포스트 ID
   * @param blogSlug 블로그 slug
   * @param blogId 블로그 ID
   */
  async invalidatePostDeleteCache(
    postId: string,
    blogSlug: string,
    blogId: string,
  ): Promise<void> {
    try {
      // 포스트 삭제 시 더 적극적인 캐시 삭제
      await this.invalidateRelatedCache(blogSlug, blogId, postId);

      // 추가적으로 좋아요/뷰카운트 관련 캐시도 삭제
      await this.cacheService.deletePattern(`post:${postId}:*`);

      this.logger.log(
        `✅ [Post Delete] Invalidated all cache for deleted post: ${postId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate post delete cache: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 좋아요/뷰카운트 업데이트 시 캐시 처리
   *
   * @param postId 포스트 ID
   * @param incrementCount 증가시킬 카운트
   * @param decrementCount 감소시킬 카운트
   */
  async handleCountUpdate(
    postId: string,
    incrementCount?: { view?: number; like?: number; comment?: number },
    decrementCount?: { view?: number; like?: number; comment?: number },
  ): Promise<void> {
    try {
      // 실시간 카운트는 캐시하지 않고, 포스트 전체 캐시만 삭제
      // 새로운 요청 시 DB에서 최신 카운트를 조회하도록 함
      const cacheKey = CacheKeys.POST_CORE(postId);
      await this.cacheService.del(cacheKey);

      this.logger.debug(
        `✅ [Count Update] Invalidated cache for post: ${postId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle count update cache: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 캐시 스탬프프 방지를 위한 분산 락 획득
   *
   * @param key 락 키
   * @param ttl 락 유지 시간 (초)
   * @returns 락 획득 성공 여부
   */
  async acquireLock(key: string, ttl: number = 5): Promise<boolean> {
    return this.cacheService.acquireLock(key, ttl);
  }

  /**
   * 분산 락 해제
   *
   * @param key 락 키
   */
  async releaseLock(key: string): Promise<void> {
    await this.cacheService.releaseLock(key);
  }

  /**
   * 락 대기
   *
   * @param key 락 키
   * @param timeout 타임아웃 (밀리초)
   */
  async waitForLock(key: string, timeout: number): Promise<void> {
    await this.cacheService.waitForLock(key, timeout);
  }

  /**
   * 캐시 키 생성 헬퍼
   *
   * @param type 캐시 타입
   * @param params 파라미터
   * @returns 생성된 캐시 키
   */
  generateCacheKey(type: string, ...params: any[]): string {
    switch (type) {
      case "post":
        return CacheKeys.POST_CORE(params[0]);
      case "feed_home":
        return CacheKeys.FEED_HOME(params[0]);
      case "feed_blog":
        return CacheKeys.FEED_BLOG(params[0], params[1]);
      case "feed_popular":
        return CacheKeys.FEED_POPULAR(
          params[0] as "daily" | "weekly" | "monthly",
          params[1],
        );
      case "feed_editor_picks":
        return CacheKeys.FEED_EDITOR_PICKS();
      default:
        return `${type}:${params.join(":")}`;
    }
  }

  /**
   * 패턴 기반 캐시 삭제
   *
   * @param pattern 삭제할 캐시 패턴
   */
  async deletePattern(pattern: string): Promise<void> {
    await this.cacheService.deletePattern(pattern);
  }

  /**
   * 특정 키의 캐시 삭제
   *
   * @param key 삭제할 캐시 키
   */
  async delete(key: string): Promise<void> {
    await this.cacheService.del(key);
  }

  /**
   * 여러 키의 캐시 한 번에 삭제
   *
   * @param keys 삭제할 캐시 키 배열
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.cacheService.del(key)));
  }

  // ========== 이벤트 리스너 ==========

  /**
   * Editor's Pick 토글 이벤트 리스너
   * Editor's Pick 상태 변경 시 관련 캐시 즉시 무효화
   */
  @OnEvent(CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED, { async: true })
  async handleEditorPickToggled(
    payload: EditorPickToggledEvent,
  ): Promise<void> {
    this.logger.log(
      `🎯 [Editor's Pick Cache] Handling toggle event for post: ${payload.postId}, isPicked: ${payload.isPicked}`,
    );

    try {
      // 1. Editor's Pick 피드 캐시 전체 삭제 (모든 limit 변형 포함) - 필수
      await this.invalidateEditorPicksCache(payload.postId);

      // 특정 limit 값들도 삭제 (컨트롤러가 limit 파라미터로 키를 생성)
      for (let limit = 1; limit <= 10; limit++) {
        await this.cacheService.del(CacheKeys.FEED_EDITOR_PICKS(limit));
      }

      // 2. 특정 포스트 캐시 삭제 (Editor's Pick 배지 정보 업데이트용) - 필수
      await this.cacheService.del(CacheKeys.POST_CORE(payload.postId));

      // 홈 피드 및 인기 포스트 캐시는 Editor's Pick과 독립적이므로 삭제하지 않음
      // - 홈 피드: 최신순 정렬 only (Editor's Pick 영향 없음)
      // - 인기 포스트: 조회수/좋아요/댓글 기반 (Editor's Pick 미포함)

      // Prometheus 메트릭 기록
      this.cacheMetricsService.recordCacheInvalidation("editor_picks", "event");

      this.logger.log(
        `✅ [Editor's Pick Cache] Invalidated essential caches for post: ${payload.postId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate Editor's Pick cache: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 포스트 썸네일 업데이트 이벤트 리스너
   * 썸네일 변경 시 홈 피드와 관련 캐시만 집중적으로 무효화
   */
  @OnEvent(CacheInvalidationEvents.POST_THUMBNAIL_UPDATED, { async: true })
  async handlePostThumbnailUpdated(
    payload: PostThumbnailUpdatedEvent,
  ): Promise<void> {
    // 🎯 [THUMBNAIL_TRACK] STEP_7_EVENT_RECEIVED
    this.logger.log(
      "🎯 [THUMBNAIL_TRACK] STEP_7_EVENT_RECEIVED: Cache service received thumbnail update event",
    );
    this.logger.debug(`  - Post ID: ${payload.postId}`);
    this.logger.debug(`  - Blog Slug: ${payload.blogSlug}`);
    this.logger.debug(`  - Old ImageId: ${payload.oldThumbnailImageId}`);
    this.logger.debug(`  - New ImageId: ${payload.newThumbnailImageId}`);
    this.logger.debug(`  - Timestamp: ${new Date().toISOString()}`);

    try {
      // 🎯 [THUMBNAIL_TRACK] STEP_8_CACHE_INVALIDATION_START
      this.logger.log(
        "🎯 [THUMBNAIL_TRACK] STEP_8_CACHE_INVALIDATION_START: Starting cache invalidation",
      );

      // 1. 홈 피드 캐시 삭제 (썸네일이 표시되는 핵심 위치)
      // - 처음 3페이지만 삭제하여 성능 최적화
      const homeFeedKeys = [];
      for (let page = 1; page <= 3; page++) {
        const key = CacheKeys.FEED_HOME(page);
        homeFeedKeys.push(key);
        await this.cacheService.del(key);
      }
      this.logger.debug(
        `  - Deleted home feed keys: ${homeFeedKeys.join(", ")}`,
      );

      // 2. 블로그 피드 캐시 삭제 (해당 블로그의 피드)
      const blogFeedKeys = [];
      if (payload.blogSlug) {
        for (let page = 1; page <= 3; page++) {
          const key = CacheKeys.FEED_BLOG(payload.blogSlug, page);
          blogFeedKeys.push(key);
          await this.cacheService.del(key);
        }
        this.logger.debug(
          `  - Deleted blog feed keys: ${blogFeedKeys.join(", ")}`,
        );

        // 블로그 ID와 slug가 다른 경우를 대비한 패턴 삭제
        await this.cacheService.deletePattern(
          `feed:blog:${payload.blogSlug}:page:*`,
        );
      }

      // 3. 특정 포스트 캐시 삭제 (썸네일 URL 업데이트용)
      const postKey = CacheKeys.POST_CORE(payload.postId);
      await this.cacheService.del(postKey);
      this.logger.debug(`  - Deleted post cache key: ${postKey}`);

      // 4. 패턴 기반 추가 삭제 (안전장치)
      // - 홈 피드 전체 패턴 삭제
      await this.cacheService.deletePattern("feed:home:page:*");

      // - 관련 블로그 피드 패턴 삭제
      if (payload.blogSlug) {
        await this.cacheService.deletePattern(
          `feed:blog:${payload.blogSlug}:page:*`,
        );
      }

      // Prometheus 메트릭 기록
      this.cacheMetricsService.recordCacheInvalidation(
        "thumbnail_update",
        "event",
      );

      // 🎯 [THUMBNAIL_TRACK] STEP_8_CACHE_INVALIDATION_COMPLETE
      this.logger.log(
        "🎯 [THUMBNAIL_TRACK] STEP_8_CACHE_INVALIDATION_COMPLETE: All caches invalidated successfully",
      );
      this.logger.log(
        `✅ [Thumbnail Cache] Successfully invalidated caches for thumbnail update on post: ${payload.postId}`,
      );
    } catch (error) {
      this.logger.error(
        `🎯 [THUMBNAIL_TRACK] STEP_8_ERROR: Cache invalidation failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
