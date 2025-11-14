import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PostLike, LikeType } from '../entities/post-like.entity';
import { PostStats } from '../entities/post-stats.entity';
import { Post } from '../entities/post.entity';
import { RedisLockService } from '../../redis/redis-lock.service';
import { CacheService, CacheKeys } from '../../cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * 단순하고 강한 좋아요 서비스
 *
 * 설계 원칙:
 * 1. 단순함: 불필요한 큐/배치 없이 즉시 처리
 * 2. 강건함: DB 중심의 상태 관리
 * 3. 확장성: 분산 환경에서 안전한 잠금
 * 4. 성능: 최소한의 쿼리로 효율적 처리
 */
@Injectable()
export class LikeService {
  private readonly logger = new Logger(LikeService.name);

  constructor(
    @InjectRepository(PostLike)
    private readonly likeRepository: Repository<PostLike>,
    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly dataSource: DataSource,
    private readonly redisLockService: RedisLockService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 좋아요 토글 (단순하고 즉각적인 처리)
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns { liked: boolean, likeCount: number }
   */
  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const lockKey = `like:lock:${postId}:${userId}`;

    // 분산락으로 동시성 제어 (5초 타임아웃)
    return await this.redisLockService.withLock(
      lockKey,
      async () => {
        // 트랜잭션으로 원자성 보장
        return await this.dataSource.transaction(async (transactionManager) => {
          // 현재 상태 확인 (type 필드까지 확인)
          const existing = await transactionManager.findOne(PostLike, {
            where: { postId, userId, type: LikeType.LIKE }
          });

          let newLikeCount: number;

          if (existing) {
            // 좋아요 취소
            this.logger.debug(`Removing like: post=${postId}, user=${userId}`);

            // 1. 좋아요 레코드 삭제 (type도 함께 지정)
            await transactionManager.delete(PostLike, { postId, userId, type: LikeType.LIKE });

            // 2. 카운트 감소 (음수 방지)
            await transactionManager
              .createQueryBuilder()
              .update(PostStats)
              .set({
                likeCount: () => `GREATEST(0, "likeCount" - 1)`,
                updatedAt: new Date()
              })
              .where('postId = :postId', { postId })
              .execute();

            newLikeCount = await this.getLikeCountFromDB(postId, transactionManager);
          } else {
            // 좋아요 추가
            this.logger.debug(`Adding like: post=${postId}, user=${userId}`);

            // 1. 좋아요 레코드 추가 (중복 방지는 유니크 제약조건이 처리)
            await transactionManager.insert(PostLike, {
              postId,
              userId,
              type: LikeType.LIKE,  // 명시적으로 타입 지정
              createdAt: new Date() // 생성 시간 설정
            });

            // 2. 카운트 증가
            await transactionManager.increment(PostStats, { postId }, 'likeCount', 1);

            newLikeCount = await this.getLikeCountFromDB(postId, transactionManager);
          }

          // 결과 반환
          const result = {
            liked: !existing,
            likeCount: newLikeCount
          };

          // 비동기로 캐시 무효화 (응답 지연 방지)
          setImmediate(() => {
            this.invalidateCache(postId).catch(err => {
              this.logger.warn('Cache invalidation failed:', err.message);
            });
          });

          // 이벤트 발행 (부가 기능 연동)
          this.eventEmitter.emit('like.toggled', {
            postId,
            userId,
            liked: result.liked,
            likeCount: result.likeCount,
            timestamp: new Date()
          });

          return result;
        });
      },
      { ttl: 5000 } // 5초 타임아웃
    );
  }

  /**
   * 사용자의 좋아요 상태 확인
   */
  async isLiked(postId: string, userId: string): Promise<boolean> {
    const count = await this.likeRepository.count({
      where: { postId, userId, type: LikeType.LIKE }
    });

    return count > 0;
  }

  /**
   * 포스트의 좋아요 수 확인 (캐시 우선)
   */
  async getLikeCount(postId: string): Promise<number> {
    // 캐시 확인
    const cacheKey = CacheKeys.POST_CORE(postId);
    const cached = await this.cacheService.get(cacheKey) as any;

    if (cached && cached.likeCount !== undefined) {
      return cached.likeCount;
    }

    // DB 조회
    return await this.getLikeCountFromDB(postId);
  }

  /**
   * 여러 포스트의 좋아요 상태 한 번에 조회 (성능 최적화)
   */
  async getMultipleLikeStatus(
    postIds: string[],
    userId: string
  ): Promise<Map<string, boolean>> {
    if (postIds.length === 0) {
      return new Map();
    }

    // 한 번의 쿼리로 여러 상태 조회
    const likes = await this.dataSource
      .createQueryBuilder()
      .select('postId')
      .from(PostLike, 'post_like')
      .where('post_like.postId IN (:...postIds)', { postIds })
      .andWhere('post_like.userId = :userId', { userId })
      .andWhere('post_like.type = :type', { type: LikeType.LIKE })
      .getRawMany();

    // Map으로 O(1) 조회 가능
    const likedMap = new Map<string, boolean>();

    // 모든 포스트 ID에 대해 false로 초기화
    postIds.forEach(id => likedMap.set(id, false));

    // 좋아요 누른 포스트만 true로 설정
    likes.forEach(like => likedMap.set(like.postId, true));

    return likedMap;
  }

  /**
   * 포스트 상세 정보와 좋아요 상태 함께 조회
   */
  async getPostWithLikeStatus(
    postId: string,
    userId?: string
  ): Promise<{ post: Post; isLiked?: boolean } | null> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['stats']
    });

    if (!post) {
      return null;
    }

    const result: any = { post };

    // 로그인 사용자만 좋아요 상태 확인
    if (userId) {
      result.isLiked = await this.isLiked(postId, userId);
    }

    return result;
  }

  /**
   * DB에서 직접 좋아요 수 조회
   */
  private async getLikeCountFromDB(
    postId: string,
    manager?: any // EntityManager 또는 DataSource
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(PostStats)
      : this.postStatsRepository;

    const stats = await repo.findOne({
      where: { postId },
      select: ['likeCount']
    });

    return stats?.likeCount || 0;
  }

  /**
   * 관련 캐시 무효화
   */
  private async invalidateCache(postId: string): Promise<void> {
    try {
      // 포스트 캐시 삭제
      await this.cacheService.del(CacheKeys.POST_CORE(postId));

      // 피드 관련 캐시 패턴 삭제
      await this.cacheService.deletePattern('feed:home:*');
      await this.cacheService.deletePattern('feed:popular:*');

      this.logger.debug(`Cache invalidated for post: ${postId}`);
    } catch (error) {
      this.logger.warn('Cache invalidation error:', error.message);
    }
  }
}