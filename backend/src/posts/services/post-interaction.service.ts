import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, SelectQueryBuilder } from "typeorm";
import { Post } from "../entities/post.entity";
import { PostStats } from "../entities/post-stats.entity";
import { User } from "../../users/entities/user.entity";
import { BookmarksService } from "../../bookmarks/bookmarks.service";
import { LikeService } from "./like.service";
import { RedisLockService } from "../../redis/redis-lock.service";
import { CacheKeys, CacheTTL } from "../../cache/cache.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PostInteractionEvents } from "../events/post-interaction.events";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";

/**
 * 포스트 상호작용 서비스
 *
 * 책임:
 * - 조회수 증가 (사용자별 중복 방지)
 * - 북마크 상태 확인
 * - 실시간 카운트 관리
 * - 상호작용 관련 이벤트 발행
 *
 * 참고: 좋아요 기능은 LikeService로 이전됨
 */
@Injectable()
export class PostInteractionService {
  private readonly logger = new Logger(PostInteractionService.name);
  private readonly uniqueViewTtlSeconds = 60 * 60 * 24 * 120;

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>,
    private readonly bookmarksService: BookmarksService,
    private readonly likeService: LikeService,
    private readonly redisLockService: RedisLockService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    // Core Redis: unique views and user view markers affect policy/analytics.
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * 포스트 조회수 증가 (사용자 기반 중복 방지)
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID (선택사항)
   * @returns 증가된 조회수
   */
  async incrementView(postId: string, userId?: string): Promise<number> {
    const lockKey = `post:view:${postId}`;
    const lock = await this.redisLockService.acquireLock(lockKey, 3000);

    try {
      const uniqueViewKey = this.buildUniqueViewKey(postId, userId);
      if (uniqueViewKey) {
        const hasViewed = await this.redisLockService.get(uniqueViewKey);

        if (hasViewed) {
          const post = await this.postsRepository.findOne({
            where: { id: postId },
            relations: ["stats"],
          });
          return post?.stats?.viewCount || 0;
        }

        await this.redisLockService.set(uniqueViewKey, "1", CacheTTL.DAY);
      }

      // PostStats에서 조회수 증가
      await this.dataSource
        .createQueryBuilder()
        .update(PostStats)
        .set({
          viewCount: () => "viewCount + 1",
          updatedAt: new Date(),
        })
        .where("postId = :postId", { postId })
        .execute();

      // 업데이트된 포스트 정보 조회
      const post = await this.postsRepository.findOne({
        where: { id: postId },
        relations: ["stats"],
      });

      const newViewCount = post?.stats?.viewCount || 0;
      this.logger.debug(
        `View incremented: postId=${postId}, newCount=${newViewCount}`,
      );

      // 이벤트 발행
      this.eventEmitter.emit(PostInteractionEvents.VIEW_INCREMENTED, {
        postId,
        userId,
        viewCount: newViewCount,
        timestamp: new Date(),
      });

      await this.trackUniqueView(post, userId);

      return newViewCount;
    } finally {
      await this.redisLockService.releaseLock(lockKey, lock);
    }
  }

  private buildUniqueViewKey(
    postId: string,
    userId?: string,
  ): string | null {
    if (userId) {
      return CacheKeys.POST_USER_VIEW(postId, userId);
    }

    return null;
  }

  /**
   * 여러 포스트의 상호작용 상태 한번에 조회
   *
   * @param postIds 포스트 ID 목록
   * @param userId 사용자 ID
   * @returns 상태 맵 { postId: { liked, bookmarked } }
   */
  async getInteractionStatusMap(
    postIds: string[],
    userId?: string,
  ): Promise<Map<string, { liked: boolean; bookmarked: boolean }>> {
    if (!userId || postIds.length === 0) {
      return new Map();
    }

    const statusMap = new Map<
      string,
      { liked: boolean; bookmarked: boolean }
    >();

    try {
      // 좋아요 상태 한번에 조회 (LikeService 사용)
      const likeStatuses = await this.likeService.getMultipleLikeStatus(
        postIds,
        userId,
      );

      // 북마크 상태 한번에 조회
      const bookmarkStatuses =
        await this.bookmarksService.getMultipleBookmarkStatuses(
          postIds,
          userId,
        );

      // 결과 조합
      postIds.forEach((postId) => {
        statusMap.set(postId, {
          liked: likeStatuses.get(postId) || false,
          bookmarked: bookmarkStatuses.get(postId) || false,
        });
      });

      return statusMap;
    } catch (error) {
      this.logger.error(
        `Failed to get interaction status map: ${error.message}`,
      );
      return new Map();
    }
  }

  /**
   * 사용자의 북마크 상태 확인
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns 북마크 여부
   */
  async getUserBookmarkStatus(
    postId: string,
    userId: string,
  ): Promise<boolean> {
    const bookmark = await this.bookmarksService.findBookmark(postId, userId);
    return !!bookmark;
  }

  /**
   * 포스트의 실시간 상호작용 데이터 조회
   *
   * @param postId 포스트 ID
   * @param user 사용자 (선택사항)
   * @returns 상호작용 데이터
   */
  async getPostInteractions(
    postId: string,
    user?: User,
  ): Promise<{
    viewCount: number;
    likeCount: number;
    commentCount: number;
    liked: boolean;
    bookmarked: boolean;
  }> {
    // 포스트 기본 정보 조회
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ["stats"],
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    // 사용자가 없는 경우 기본 카운트만 반환
    if (!user) {
      return {
        viewCount: post.stats?.viewCount || 0,
        likeCount: post.stats?.likeCount || 0,
        commentCount: post.stats?.commentCount || 0,
        liked: false,
        bookmarked: false,
      };
    }

    // 사용자 상호작용 상태 병렬 조회
    const [liked, bookmarked] = await Promise.all([
      this.likeService.isLiked(postId, user.id),
      this.getUserBookmarkStatus(postId, user.id),
    ]);

    return {
      viewCount: post.stats?.viewCount || 0,
      likeCount: post.stats?.likeCount || 0,
      commentCount: post.stats?.commentCount || 0,
      liked,
      bookmarked,
    };
  }

  /**
   * 포스트 상호작통계 조회
   *
   * @param postId 포스트 ID
   * @returns 상호작용 통계
   */
  async getInteractionStats(postId: string): Promise<{
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    engagementRate: number;
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: ["stats"],
    });

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    const viewCount = post.stats?.viewCount || 0;
    const likeCount = post.stats?.likeCount || 0;
    const commentCount = post.stats?.commentCount || 0;

    // 참여율 계산: (좋아요 + 댓글) / 조회수 * 100
    const engagementRate =
      viewCount > 0 ? ((likeCount + commentCount) / viewCount) * 100 : 0;

    return {
      totalViews: viewCount,
      totalLikes: likeCount,
      totalComments: commentCount,
      engagementRate: Math.round(engagementRate * 100) / 100, // 소수점 2자리
    };
  }

  /**
   * 일일/주간/월간 상호작용 추이 조회
   *
   * @param postId 포스트 ID
   * @param period 기간 (daily, weekly, monthly)
   * @returns 시계열 데이터
   */
  async getInteractionTrends(
    postId: string,
    period: "daily" | "weekly" | "monthly" = "daily",
  ): Promise<
    Array<{
      date: string;
      views: number;
      likes: number;
      comments: number;
    }>
  > {
    // TODO: 구현 필요 - Analytics 모듈과 연동
    this.logger.warn(
      `Interaction trends not implemented for period: ${period}`,
    );
    return [];
  }

  private async trackUniqueView(post: Post | null, userId?: string) {
    if (!post || !userId || !post.blogId) {
      return;
    }

    const key = this.buildBlogUniqueViewKey(post.blogId, new Date());
    try {
      await this.redis.pfadd(key, userId);
      await this.redis.expire(key, this.uniqueViewTtlSeconds);
    } catch (error) {
      this.logger.warn(
        `Failed to record unique view (postId=${post.id}, userId=${userId})`,
        error as Error,
      );
    }
  }

  private buildBlogUniqueViewKey(blogId: string, date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `blog:uniqueViews:${blogId}:${year}${month}`;
  }
}
