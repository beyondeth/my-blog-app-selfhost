import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { PostLike } from "../entities/post-like.entity";
import { VoteType } from "../enums/vote-type.enum";

/**
 * 포스트 투표 상태 조회 서비스
 *
 * N+1 쿼리 문제 해결을 위한 배치 조회 전용 서비스
 *
 * @note 기존 liked boolean 반환 메서드는 하위 호환성을 위해 유지.
 * 새 코드에서는 VoteType 반환 메서드 사용 권장.
 */
@Injectable()
export class PostLikeStatusService {
  private readonly logger = new Logger(PostLikeStatusService.name);

  constructor(
    @InjectRepository(PostLike)
    private readonly postLikeRepository: Repository<PostLike>,
  ) {}

  /**
   * 여러 포스트의 투표 상태를 한 번에 조회 (VoteType 반환)
   *
   * @param postIds 포스트 ID 목록
   * @param userId 사용자 ID
   * @returns Map<postId, VoteType | null> 형태의 투표 상태 맵
   */
  async getMultipleVoteStatuses(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, VoteType | null>> {
    if (!postIds.length || !userId) {
      return new Map();
    }

    // 한 번의 쿼리로 여러 포스트의 투표 상태 조회 (type 포함)
    const votes = await this.postLikeRepository.find({
      where: {
        postId: In(postIds),
        userId,
      },
      select: ["postId", "type"],
    });

    // 결과를 Map으로 변환
    const voteMap = new Map<string, VoteType | null>();

    // 모든 포스트 ID를 null로 초기화
    postIds.forEach((postId) => {
      voteMap.set(postId, null);
    });

    // 투표한 포스트만 VoteType 설정
    votes.forEach((vote) => {
      if (vote.postId) {
        voteMap.set(vote.postId, vote.type);
      }
    });

    return voteMap;
  }

  /**
   * 여러 포스트의 좋아요 상태를 한 번에 조회 (레거시)
   *
   * @deprecated getMultipleVoteStatuses 사용 권장
   *
   * @param postIds 포스트 ID 목록
   * @param userId 사용자 ID
   * @returns Map<postId, likedStatus> 형태의 좋아요 상태 맵
   */
  async getMultipleLikeStatuses(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, boolean>> {
    if (!postIds.length || !userId) {
      return new Map();
    }

    // VoteType으로 조회 후 boolean으로 변환
    const voteMap = await this.getMultipleVoteStatuses(postIds, userId);

    const likedMap = new Map<string, boolean>();
    voteMap.forEach((voteType, postId) => {
      likedMap.set(postId, voteType === VoteType.UPVOTE);
    });

    return likedMap;
  }

  /**
   * 단일 포스트의 투표 상태 조회 (VoteType 반환)
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns VoteType 또는 null (투표 안 함)
   */
  async getVoteStatus(
    postId: string,
    userId: string,
  ): Promise<VoteType | null> {
    if (!postId || !userId) {
      return null;
    }

    const vote = await this.postLikeRepository.findOne({
      where: {
        postId,
        userId,
      },
      select: ["type"],
    });

    return vote?.type || null;
  }

  /**
   * 단일 포스트의 좋아요 상태 조회 (레거시)
   *
   * @deprecated getVoteStatus 사용 권장
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns 좋아요 여부
   */
  async getLikeStatus(postId: string, userId: string): Promise<boolean> {
    const voteType = await this.getVoteStatus(postId, userId);
    return voteType === VoteType.UPVOTE;
  }

  /**
   * 사용자가 업보트한 모든 포스트 ID 조회
   *
   * @param userId 사용자 ID
   * @param limit 조회 제한
   * @returns 포스트 ID 배열
   */
  async getUserUpvotedPostIds(
    userId: string,
    limit: number = 1000,
  ): Promise<string[]> {
    const votes = await this.postLikeRepository.find({
      where: { userId, type: VoteType.UPVOTE },
      select: ["postId"],
      order: { createdAt: "DESC" },
      take: limit,
    });

    return votes.map((vote) => vote.postId).filter(Boolean);
  }

  /**
   * 사용자가 좋아요한 모든 포스트 ID 조회 (레거시)
   *
   * @deprecated getUserUpvotedPostIds 사용 권장
   */
  async getUserLikedPostIds(
    userId: string,
    limit: number = 1000,
  ): Promise<string[]> {
    return this.getUserUpvotedPostIds(userId, limit);
  }
}
