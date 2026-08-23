import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager } from "typeorm";
import { PostLike } from "../entities/post-like.entity";
import { PostStats } from "../entities/post-stats.entity";
import { Post } from "../entities/post.entity";
import { VoteType } from "../enums/vote-type.enum";
import { RedisLockService } from "../../redis/redis-lock.service";
import { CacheService, CacheKeys } from "../../cache/cache.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OutboxService } from "../../common/services/outbox.service";
import { PostInteractionEvents } from "../events/post-interaction.events";

/**
 * 투표 결과 인터페이스
 */
export interface VoteResult {
  /** 수행된 액션 (added, removed, changed) */
  action: "added" | "removed" | "changed";
  /** 사용자의 현재 투표 상태 */
  userVote: VoteType | null;
  /** 업보트 수 */
  upvoteCount: number;
  /** 다운보트 수 */
  downvoteCount: number;
  /** 순투표 점수 (upvoteCount - downvoteCount) */
  score: number;
  /** @deprecated 하위 호환성용 */
  liked?: boolean;
  /** @deprecated 하위 호환성용 */
  likeCount?: number;
}

/**
 * Reddit 스타일 투표 서비스
 *
 * @description
 * 포스트에 대한 업보트/다운보트 처리를 담당합니다.
 *
 * **설계 원칙:**
 * 1. 단순함: 불필요한 큐/배치 없이 즉시 처리
 * 2. 강건함: DB 중심의 상태 관리
 * 3. 확장성: 분산 환경에서 안전한 잠금
 * 4. 성능: 최소한의 쿼리로 효율적 처리
 *
 * **투표 로직:**
 * - 같은 타입 투표 클릭 → 취소 (삭제)
 * - 반대 타입 투표 클릭 → 변경 (기존 삭제 + 새 추가)
 * - 투표 없는 상태에서 클릭 → 새 투표 추가
 */
@Injectable()
export class VoteService {
  private readonly logger = new Logger(VoteService.name);

  constructor(
    @InjectRepository(PostLike)
    private readonly voteRepository: Repository<PostLike>,
    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly dataSource: DataSource,
    private readonly redisLockService: RedisLockService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * 투표 토글 (핵심 로직)
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @param voteType 투표 타입 (upvote/downvote)
   * @returns VoteResult
   */
  async toggleVote(
    postId: string,
    userId: string,
    voteType: VoteType,
  ): Promise<VoteResult> {
    const lockKey = `vote:lock:${postId}:${userId}`;

    // 분산락으로 동시성 제어 (5초 타임아웃)
    return await this.redisLockService.withLock(
      lockKey,
      async () => {
        // 트랜잭션으로 원자성 보장
        return await this.dataSource.transaction(async (manager) => {
          // 기존 투표 조회 (type 무관)
          const existing = await manager.findOne(PostLike, {
            where: { postId, userId },
          });

          let action: "added" | "removed" | "changed";
          let userVote: VoteType | null;

          if (existing) {
            if (existing.type === voteType) {
              // 같은 타입 클릭 → 투표 취소
              await manager.delete(PostLike, { id: existing.id });
              await this.updateVoteCount(manager, postId, voteType, -1);
              action = "removed";
              userVote = null;
            } else {
              // 다른 타입 클릭 → 투표 변경
              const oldType = existing.type;
              existing.type = voteType;
              await manager.save(existing);
              await this.updateVoteCount(manager, postId, oldType, -1);
              await this.updateVoteCount(manager, postId, voteType, +1);
              action = "changed";
              userVote = voteType;
            }
          } else {
            // 새 투표
            const newVote = manager.create(PostLike, {
              postId,
              userId,
              type: voteType,
            });
            await manager.save(newVote);
            await this.updateVoteCount(manager, postId, voteType, +1);
            action = "added";
            userVote = voteType;
          }

          // 최종 카운트 조회
          const stats = await manager.findOne(PostStats, {
            where: { postId },
            select: ["upvoteCount", "downvoteCount", "likeCount"],
          });

          const upvoteCount = stats?.upvoteCount || 0;
          const downvoteCount = stats?.downvoteCount || 0;

          const result: VoteResult = {
            action,
            userVote,
            upvoteCount,
            downvoteCount,
            score: upvoteCount - downvoteCount,
            // 하위 호환성
            liked: userVote === VoteType.UPVOTE,
            likeCount: upvoteCount,
          };

          const post = await manager.findOne(Post, {
            where: { id: postId },
            relations: ["blog"],
          });

          await this.outboxService.enqueue(manager, {
            eventType: PostInteractionEvents.LIKE_TOGGLED,
            aggregateType: "post",
            aggregateId: postId,
            organizationId: post?.blog?.organizationId || null,
            payload: {
              postId,
              userId,
              liked: userVote === VoteType.UPVOTE,
              likeCount: upvoteCount,
              timestamp: new Date(),
            },
          });

          // 캐시 무효화 (디바이스 간 stale 최소화)
          void this.invalidateCache(postId).catch((err) => {
            this.logger.warn("Vote cache invalidation failed:", err.message);
          });

          // 이벤트 발행 (부가 기능 연동)
          this.eventEmitter.emit("vote.toggled", {
            postId,
            userId,
            action,
            voteType: userVote,
            upvoteCount,
            downvoteCount,
            timestamp: new Date(),
          });

          return result;
        });
      },
      { ttl: 5000 }, // 5초 타임아웃
    );
  }

  /**
   * 사용자의 투표 상태 확인
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns VoteType 또는 null (투표 안 함)
   */
  async getUserVote(postId: string, userId: string): Promise<VoteType | null> {
    const vote = await this.voteRepository.findOne({
      where: { postId, userId },
      select: ["type"],
    });

    return vote?.type || null;
  }

  /**
   * 여러 포스트의 투표 상태 한 번에 조회 (N+1 방지)
   *
   * @param postIds 포스트 ID 목록
   * @param userId 사용자 ID
   * @returns Map<postId, VoteType | null>
   */
  async getMultipleVoteStatuses(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, VoteType | null>> {
    if (postIds.length === 0) {
      return new Map();
    }

    // 한 번의 쿼리로 여러 상태 조회
    const votes = await this.dataSource
      .createQueryBuilder()
      .select(["postId", "type"])
      .from(PostLike, "vote")
      .where("vote.postId IN (:...postIds)", { postIds })
      .andWhere("vote.userId = :userId", { userId })
      .getRawMany();

    // Map으로 O(1) 조회 가능
    const voteMap = new Map<string, VoteType | null>();

    // 모든 포스트 ID에 대해 null로 초기화
    postIds.forEach((id) => voteMap.set(id, null));

    // 투표한 포스트만 VoteType 설정
    votes.forEach((vote) => voteMap.set(vote.postId, vote.type));

    return voteMap;
  }

  /**
   * 포스트의 투표 카운트 조회
   *
   * @param postId 포스트 ID
   * @returns { upvoteCount, downvoteCount, score }
   */
  async getVoteCounts(postId: string): Promise<{
    upvoteCount: number;
    downvoteCount: number;
    score: number;
  }> {
    const stats = await this.postStatsRepository.findOne({
      where: { postId },
      select: ["upvoteCount", "downvoteCount"],
    });

    const upvoteCount = stats?.upvoteCount || 0;
    const downvoteCount = stats?.downvoteCount || 0;

    return {
      upvoteCount,
      downvoteCount,
      score: upvoteCount - downvoteCount,
    };
  }

  /**
   * 투표 카운트 업데이트 (트랜잭션 내부 헬퍼)
   *
   * @param manager EntityManager
   * @param postId 포스트 ID
   * @param voteType 투표 타입
   * @param delta 증감량 (+1 또는 -1)
   */
  private async updateVoteCount(
    manager: EntityManager,
    postId: string,
    voteType: VoteType,
    delta: number,
  ): Promise<void> {
    const isUpvote = voteType === VoteType.UPVOTE;
    const field = isUpvote ? "upvoteCount" : "downvoteCount";

    // 업보트/다운보트 카운트 업데이트
    await manager
      .createQueryBuilder()
      .update(PostStats)
      .set({
        [field]: () => `GREATEST(0, "${field}" + ${delta})`,
        // 업보트 시 likeCount도 동기화 (하위 호환성)
        ...(isUpvote && {
          likeCount: () => `GREATEST(0, "likeCount" + ${delta})`,
        }),
        updatedAt: new Date(),
      })
      .where("postId = :postId", { postId })
      .execute();

    // Post (denormalized) 업데이트
    if (isUpvote) {
      await manager
        .createQueryBuilder()
        .update(Post)
        .set({
          likeCount: () => `GREATEST(0, "like_count" + ${delta})`, // like_count 컬럼 직접 참조
        })
        .where("id = :postId", { postId })
        .execute();
    }
  }

  /**
   * 관련 캐시 무효화
   */
  private async invalidateCache(postId: string): Promise<void> {
    try {
      // 포스트 캐시 삭제
      await this.cacheService.del(CacheKeys.POST_CORE(postId));

      // 피드 관련 캐시 패턴 무효화 (범위 축소 + Debounce로 부하 완화)
      const patterns = [
        "feed:unified:v2:all:*:limit:20:cursor:first",
        "feed:unified:v2:blog:*:limit:20:cursor:first",
        "feed:unified:v2:community:*:limit:20:cursor:first",
        "feed:home:*",
        "feed:popular:*",
      ];

      await Promise.all(
        patterns.map((pattern) =>
          this.cacheService.invalidatePattern(pattern, { debounce: 250 }),
        ),
      );
    } catch (error) {
      this.logger.warn("Cache invalidation error:", error.message);
    }
  }
}
