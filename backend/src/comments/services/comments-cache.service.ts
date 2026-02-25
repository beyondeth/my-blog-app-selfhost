import { Injectable, Logger } from "@nestjs/common";
import { CacheService, CacheKeys } from "../../cache/cache.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CacheMetricsService } from "../../metrics/cache-metrics.service";

@Injectable()
export class CommentsCacheService {
  private readonly logger = new Logger(CommentsCacheService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheMetricsService: CacheMetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 댓글 페이지네이션 캐시 무효화
   *
   * @description
   * 댓글 작성/삭제/수정 시 호출하여 캐시 무효화
   *
   * @param postId - 게시글 ID
   * @param parentCommentId - 부모 댓글 ID (답글인 경우)
   */
  async invalidateCommentsPaginationCache(
    postId: string,
    parentCommentId?: string,
  ): Promise<void> {
    // 부모 댓글 캐시 무효화 (최신순 + 인기순)
    await this.cacheService.del(
      CacheKeys.COMMENTS_PAGE_FIRST(postId, "recent"),
    );
    await this.cacheService.del(
      CacheKeys.COMMENTS_PAGE_FIRST(postId, "popular"),
    );

    // 답글 캐시 무효화
    if (parentCommentId) {
      await this.cacheService.del(
        CacheKeys.COMMENT_REPLIES_FIRST(parentCommentId),
      );
    }

    // 인기 포스트 캐시 무효화
    // 댓글 수 변경으로 인기 순위가 달라질 수 있음
    this.eventEmitter.emit("post.popularity.updated", { postId });

    this.logger.debug(`Invalidated pagination cache for postId: ${postId}`);
  }

  async getCachedFirstPage<T>(cacheKey: string): Promise<T | null> {
    const cached = await this.cacheService.get<T>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      this.cacheMetricsService.recordCommentsCacheHit();
      return cached;
    }
    this.logger.debug(`Cache MISS: ${cacheKey}`);
    this.cacheMetricsService.recordCommentsCacheMiss();
    return null;
  }

  async setCachedFirstPage<T>(
    cacheKey: string,
    data: T,
    ttl: number,
  ): Promise<void> {
    await this.cacheService.set(cacheKey, data, ttl);
    this.logger.debug(`Cache SET: ${cacheKey}`);
  }
}
