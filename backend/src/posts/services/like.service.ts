import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { PostLike, LikeType } from "../entities/post-like.entity";
import { PostStats } from "../entities/post-stats.entity";
import { Post } from "../entities/post.entity";
import { VoteType } from "../enums/vote-type.enum";
import { VoteService } from "./vote.service";
import { RedisLockService } from "../../redis/redis-lock.service";
import { CacheService, CacheKeys } from "../../cache/cache.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * 좋아요 서비스 (레거시)
 *
 * @deprecated VoteService로 대체되었습니다.
 * 하위 호환성을 위해 유지되며, 내부적으로 VoteService를 사용합니다.
 *
 * 새 코드에서는 VoteService를 직접 사용하세요.
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
    @Inject(forwardRef(() => VoteService))
    private readonly voteService: VoteService,
  ) {}

  /**
   * 좋아요 토글 (레거시 API)
   *
   * @deprecated VoteService.toggleVote() 사용 권장
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns { liked: boolean, likeCount: number }
   */
  async toggleLike(
    postId: string,
    userId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    // VoteService로 위임 (upvote로 처리)
    const result = await this.voteService.toggleVote(
      postId,
      userId,
      VoteType.UPVOTE,
    );

    // 하위 호환 응답 반환
    return {
      liked: result.userVote === VoteType.UPVOTE,
      likeCount: result.upvoteCount,
    };
  }

  /**
   * 사용자의 좋아요 상태 확인
   *
   * @deprecated VoteService.getUserVote() 사용 권장
   */
  async isLiked(postId: string, userId: string): Promise<boolean> {
    const userVote = await this.voteService.getUserVote(postId, userId);
    return userVote === VoteType.UPVOTE;
  }

  /**
   * 포스트의 좋아요 수 확인 (캐시 우선)
   *
   * @deprecated VoteService.getVoteCounts() 사용 권장
   */
  async getLikeCount(postId: string): Promise<number> {
    const { upvoteCount } = await this.voteService.getVoteCounts(postId);
    return upvoteCount;
  }

  /**
   * 여러 포스트의 좋아요 상태 한 번에 조회 (성능 최적화)
   *
   * @deprecated VoteService.getMultipleVoteStatuses() 사용 권장
   */
  async getMultipleLikeStatus(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, boolean>> {
    if (postIds.length === 0) {
      return new Map();
    }

    // VoteService로 위임
    const voteMap = await this.voteService.getMultipleVoteStatuses(
      postIds,
      userId,
    );

    // VoteType → boolean 변환
    const likedMap = new Map<string, boolean>();
    voteMap.forEach((voteType, postId) => {
      likedMap.set(postId, voteType === VoteType.UPVOTE);
    });

    return likedMap;
  }

  /**
   * 포스트 상세 정보와 좋아요 상태 함께 조회
   *
   * @deprecated 투표 상태를 포함한 확장된 응답은 VoteService 사용 권장
   */
  async getPostWithLikeStatus(
    postId: string,
    userId?: string,
  ): Promise<{
    post: Post;
    isLiked?: boolean;
    userVote?: VoteType | null;
  } | null> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ["stats"],
    });

    if (!post) {
      return null;
    }

    const result: any = { post };

    // 로그인 사용자만 투표 상태 확인
    if (userId) {
      const userVote = await this.voteService.getUserVote(postId, userId);
      result.userVote = userVote;
      result.isLiked = userVote === VoteType.UPVOTE; // 하위 호환성
    }

    return result;
  }
}
