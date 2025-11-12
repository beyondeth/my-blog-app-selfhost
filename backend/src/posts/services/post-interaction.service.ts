import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { Post } from '../entities/post.entity';
import { User } from '../../users/entities/user.entity';
import { BookmarksService } from '../../bookmarks/bookmarks.service';
import { LikeQueueService } from './like-queue.service';
import { RedisLockService } from '../../redis/redis-lock.service';
import { CacheKeys, CacheTTL } from '../../cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PostInteractionEvents } from '../events/post-interaction.events';

/**
 * 포스트 상호작용 서비스
 *
 * 책임:
 * - 좋아요/좋아요 취소 처리
 * - 조회수 증가 (사용자별 중복 방지)
 * - 북마크 상태 확인
 * - 실시간 카운트 관리
 * - 상호작용 관련 이벤트 발행
 */
@Injectable()
export class PostInteractionService {
  private readonly logger = new Logger(PostInteractionService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly bookmarksService: BookmarksService,
    private readonly likeQueueService: LikeQueueService,
    private readonly redisLockService: RedisLockService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 포스트 좋아요 토글
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @param liked 현재 좋아요 상태
   * @returns 업데이트된 좋아요 수
   */
  async toggleLike(postId: string, userId: string, liked: boolean): Promise<number> {
    const lockKey = `post:like:${postId}:${userId}`;
    const lock = await this.redisLockService.acquireLock(lockKey, 5000);

    try {
      // 현재 좋아요 상태 확인
      const currentStatus = await this.getUserLikeStatus(postId, userId);

      // 이미 같은 상태이면 그대로 반환
      if (currentStatus === liked) {
        const likeCount = await this.getLikeCount(postId);
        return likeCount;
      }

      // 좋아요 상태 변경 - 직접 DB 처리
      if (liked) {
        // 좋아요 추가
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into('post_likes')
          .values({ postId, userId })
          .orIgnore()
          .execute();
        this.logger.log(`Like added: postId=${postId}, userId=${userId}`);
      } else {
        // 좋아요 취소
        await this.dataSource
          .createQueryBuilder()
          .delete()
          .from('post_likes')
          .where('postId = :postId', { postId })
          .andWhere('userId = :userId', { userId })
          .execute();
        this.logger.log(`Like removed: postId=${postId}, userId=${userId}`);
      }

      // 좋아요 수 업데이트
      const likeCount = await this.updateLikeCount(postId);

      // 이벤트 발행
      this.eventEmitter.emit(PostInteractionEvents.LIKE_TOGGLED, {
        postId,
        userId,
        liked,
        likeCount,
        timestamp: new Date(),
      });

      return likeCount;
    } finally {
      await this.redisLockService.releaseLock(lockKey, lock);
    }
  }

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
      // 사용자별 조회수 증가 (로그인 사용자)
      if (userId) {
        const userViewKey = CacheKeys.POST_USER_VIEW(postId, userId);
        const hasViewed = await this.redisLockService.get(userViewKey);

        if (hasViewed) {
          // 이미 조회한 사용자이면 기존 조회수 반환
          const post = await this.postsRepository.findOne({
            where: { id: postId },
            select: ['viewCount'],
          });
          return post?.viewCount || 0;
        }

        // 24시간 동안 사용자 조회 기록 저장
        await this.redisLockService.set(userViewKey, '1', CacheTTL.DAY);
      }

      // 조회수 증가
      const result = await this.postsRepository.increment(
        { id: postId },
        'viewCount',
        1
      );

      // 업데이트된 포스트 정보 조회
      const post = await this.postsRepository.findOne({
        where: { id: postId },
        select: ['viewCount'],
      });

      const newViewCount = post?.viewCount || 0;
      this.logger.debug(`View incremented: postId=${postId}, newCount=${newViewCount}`);

      // 이벤트 발행
      this.eventEmitter.emit(PostInteractionEvents.VIEW_INCREMENTED, {
        postId,
        userId,
        viewCount: newViewCount,
        timestamp: new Date(),
      });

      return newViewCount;
    } finally {
      await this.redisLockService.releaseLock(lockKey, lock);
    }
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
    userId?: string
  ): Promise<Map<string, { liked: boolean; bookmarked: boolean }>> {
    if (!userId || postIds.length === 0) {
      return new Map();
    }

    const statusMap = new Map<string, { liked: boolean; bookmarked: boolean }>();

    try {
      // 좋아요 상태 한번에 조회
      const likeStatuses = await this.getMultipleLikeStatuses(postIds, userId);

      // 북마크 상태 한번에 조회
      const bookmarkStatuses = await this.bookmarksService.getMultipleBookmarkStatuses(
        postIds,
        userId
      );

      // 결과 조합
      postIds.forEach(postId => {
        statusMap.set(postId, {
          liked: likeStatuses.get(postId) || false,
          bookmarked: bookmarkStatuses.get(postId) || false,
        });
      });

      return statusMap;
    } catch (error) {
      this.logger.error(`Failed to get interaction status map: ${error.message}`);
      return new Map();
    }
  }

  /**
   * 사용자의 좋아요 상태 확인
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns 좋아요 여부
   */
  async getUserLikeStatus(postId: string, userId: string): Promise<boolean> {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(1)', 'count')
      .from('post_likes', 'pl')
      .where('pl.postId = :postId', { postId })
      .andWhere('pl.userId = :userId', { userId })
      .getRawOne();

    return result ? parseInt(result.count) > 0 : false;
  }

  /**
   * 사용자의 북마크 상태 확인
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns 북마크 여부
   */
  async getUserBookmarkStatus(postId: string, userId: string): Promise<boolean> {
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
    user?: User
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
      select: ['viewCount', 'likeCount', 'commentCount'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 사용자가 없는 경우 기본 카운트만 반환
    if (!user) {
      return {
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        liked: false,
        bookmarked: false,
      };
    }

    // 사용자 상호작용 상태 병렬 조회
    const [liked, bookmarked] = await Promise.all([
      this.getUserLikeStatus(postId, user.id),
      this.getUserBookmarkStatus(postId, user.id),
    ]);

    return {
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      liked,
      bookmarked,
    };
  }

  /**
   * 좋아요 수 업데이트 (내부 메서드)
   *
   * @param postId 포스트 ID
   * @returns 업데이트된 좋아요 수
   */
  private async updateLikeCount(postId: string): Promise<number> {
    const count = await this.getLikeCount(postId);

    await this.postsRepository.update(
      { id: postId },
      { likeCount: count }
    );

    return count;
  }

  /**
   * 현재 좋아요 수 조회
   *
   * @param postId 포스트 ID
   * @returns 좋아요 수
   */
  async getLikeCount(postId: string): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(1)', 'count')
      .from('post_likes', 'pl')
      .where('pl.postId = :postId', { postId })
      .getRawOne();

    return result ? parseInt(result.count) : 0;
  }

  /**
   * 여러 포스트의 좋아요 상태 한번에 조회
   *
   * @param postIds 포스트 ID 목록
   * @param userId 사용자 ID
   * @returns 상태 맵 { postId: liked }
   */
  private async getMultipleLikeStatuses(
    postIds: string[],
    userId: string
  ): Promise<Map<string, boolean>> {
    const statusMap = new Map<string, boolean>();

    // PostgreSQL을 사용하여 좋아요 상태 한번에 조회
    const result = await this.dataSource
      .createQueryBuilder()
      .select('postId')
      .addSelect('COUNT(*)', 'count')
      .from('post_likes', 'pl')
      .where('pl.postId IN (:...postIds)', { postIds })
      .andWhere('pl.userId = :userId', { userId })
      .groupBy('postId')
      .getRawMany();

    // 결과 맵핑
    result.forEach(row => {
      statusMap.set(row.postid, parseInt(row.count) > 0);
    });

    // 좋아요하지 않은 포스트들도 false로 설정
    postIds.forEach(postId => {
      if (!statusMap.has(postId)) {
        statusMap.set(postId, false);
      }
    });

    return statusMap;
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
      select: ['viewCount', 'likeCount', 'commentCount'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 참여율 계산: (좋아요 + 댓글) / 조회수 * 100
    const engagementRate = post.viewCount > 0
      ? ((post.likeCount + post.commentCount) / post.viewCount) * 100
      : 0;

    return {
      totalViews: post.viewCount,
      totalLikes: post.likeCount,
      totalComments: post.commentCount,
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
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<Array<{
    date: string;
    views: number;
    likes: number;
    comments: number;
  }>> {
    // TODO: 구현 필요 - Analytics 모듈과 연동
    this.logger.warn(`Interaction trends not implemented for period: ${period}`);
    return [];
  }
}