import { Injectable, Logger, forwardRef, Inject } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { CacheService, CacheKeys, CacheTTL } from "./cache.service";
import { BlogsService } from "../blogs/blogs.service";
import { CacheInvalidationEvents } from "../common/events/cache.events";
import { PostLifecycleEvents } from "../posts/events/post-lifecycle.events";

/**
 * 단순화된 캐시 무효화 이벤트 리스너
 *
 * 직관적인 캐시 무효화
 * 불필요한 복잡성 제거
 */
@Injectable()
export class CacheInvalidationListener {
  private readonly logger = new Logger(CacheInvalidationListener.name);

  constructor(
    private readonly cacheService: CacheService,
    @Inject(forwardRef(() => BlogsService))
    private readonly blogsService: BlogsService,
  ) {}

  /**
   * 포스트 생성/수정/삭제 시 캐시 무효화
   * CacheInvalidationEvents (1차 이벤트) + PostLifecycleEvents (after-commit 이벤트) 모두 수신
   */
  @OnEvent(
    [
      CacheInvalidationEvents.POST_CREATED,
      CacheInvalidationEvents.POST_UPDATED,
      CacheInvalidationEvents.POST_DELETED,
      PostLifecycleEvents.CREATED,
      PostLifecycleEvents.UPDATED,
      PostLifecycleEvents.DELETED,
      PostLifecycleEvents.RESTORED,
    ],
    { async: true },
  )
  async handlePostChange(payload: { postId: string; blogSlug?: string }) {
    this.logger.debug(
      `🔄 [Post Change] Invalidating cache for: ${payload.postId}`,
    );

    const patterns: string[] = [
      // 개별 포스트 캐시
      `post:${payload.postId}`,
      // 홈 피드 (전체)
      "feed:home:page:*",
      // 통합 피드 캐시
      "feed:unified:*",
      // 블로그 피드 (해당 블로그 전체)
      ...(payload.blogSlug ? [`feed:blog:${payload.blogSlug}:page:*`] : []),
    ];

    await this.invalidatePatterns(patterns);
  }

  /**
   * 에디터스 픽 토글 시 캐시 무효화
   */
  @OnEvent(CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED, { async: true })
  async handleEditorPickToggled(payload: {
    postId: string;
    isPicked: boolean;
  }) {
    this.logger.debug(
      `⭐ [Editor's Pick Toggled] Post: ${payload.postId}, Picked: ${payload.isPicked}`,
    );

    // 에디터스 픽 관련 캐시 즉시 무효화
    const patterns = [
      // 에디터스 픽 목록 (모든 limit)
      "feed:editor-picks:*",
      // 홈 피드 (에디터스 픽 섹션)
      "feed:home:page:*",
      // 개별 포스트 캐시 (isEditorPick 상태 변경)
      `post:${payload.postId}:*`,
    ];

    await this.invalidatePatterns(patterns);
  }

  /**
   * 사용자 프로필 업데이트 시 캐시 무효화
   */
  @OnEvent(CacheInvalidationEvents.USER_PROFILE_UPDATED, { async: true })
  async handleUserProfileUpdated(payload: { userId: string }) {
    this.logger.debug(
      `👤 [User Profile Updated] Invalidating cache for user: ${payload.userId}`,
    );

    // 블로그 identifier 캐시 무효화
    try {
      const userBlogs = await this.blogsService.findByUserId(payload.userId);
      if (userBlogs && userBlogs.length > 0) {
        const userBlog = userBlogs[0]; // 첫 번째 블로그 (사용자당 하나만 허용)
        const identifier = userBlog.alias || userBlog.slug; // alias 또는 slug 사용

        if (identifier) {
          const patterns = [
            `blog:identifier:${identifier}`,
            `blog:identifier:@${identifier}`,
            `feed:blog:${identifier}:page:*`,
          ];
          await this.invalidatePatterns(patterns);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch user blog for cache invalidation: ${error.message}`,
      );
    }
  }

  /**
   * 간단한 패턴 무효화
   */
  private async invalidatePatterns(patterns: string[]): Promise<void> {
    try {
      const results = await Promise.allSettled(
        patterns.map((pattern) => this.cacheService.deletePattern(pattern)),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        this.logger.warn(
          `⚠️ Cache invalidation failed for ${failed.length} patterns`,
        );
      }

      this.logger.debug(`✅ Invalidated ${patterns.length} cache patterns`);
    } catch (error) {
      this.logger.error(`❌ Cache invalidation failed:`, error);
    }
  }
}
