import { Injectable, Logger } from "@nestjs/common";
import { BookmarksService } from "../../bookmarks/bookmarks.service";
import { PostLikeStatusService } from "./post-like-status.service";
import { VoteType } from "../enums/vote-type.enum";

/**
 * 포스트 상호작용 상태 통합 서비스
 *
 * 북마크, 좋아요 등 사용자 상호작용 상태를 효율적으로 배치 조회
 */
export interface PostInteractionStatus {
  bookmarked: boolean;
  liked: boolean;
  userVote: VoteType | null;
}

@Injectable()
export class PostInteractionStatusService {
  private readonly logger = new Logger(PostInteractionStatusService.name);

  constructor(
    private readonly bookmarksService: BookmarksService,
    private readonly postLikeStatusService: PostLikeStatusService,
  ) {}

  /**
   * 여러 포스트의 모든 상호작용 상태를 한 번에 조회
   *
   * @param postIds 포스트 ID 목록
   * @param userId 사용자 ID
   * @returns Map<postId, interactionStatus> 형태의 상태 맵
   */
  async getMultipleInteractionStatuses(
    postIds: string[],
    userId: string,
  ): Promise<Map<string, PostInteractionStatus>> {
    if (!postIds.length || !userId) {
      // 사용자가 없는 경우 모두 false인 Map 반환
      const emptyMap = new Map<string, PostInteractionStatus>();
      postIds.forEach((postId) => {
        emptyMap.set(postId, {
          bookmarked: false,
          liked: false,
          userVote: null,
        });
      });
      return emptyMap;
    }

    this.logger.debug(
      `[getMultipleInteractionStatuses] Getting statuses for ${postIds.length} posts for user ${userId}`,
    );

    // 병렬로 북마크와 투표 상태 조회
    const [bookmarkStatuses, voteStatuses] = await Promise.all([
      this.bookmarksService.getMultipleBookmarkStatuses(postIds, userId),
      this.postLikeStatusService.getMultipleVoteStatuses(postIds, userId),
    ]);

    // 결과를 통합
    const interactionMap = new Map<string, PostInteractionStatus>();

    postIds.forEach((postId) => {
      const userVote = voteStatuses.get(postId) ?? null;
      interactionMap.set(postId, {
        bookmarked: bookmarkStatuses.get(postId) || false,
        liked: userVote === VoteType.UPVOTE,
        userVote,
      });
    });

    const bookmarkedCount = Array.from(bookmarkStatuses.values()).filter(
      Boolean,
    ).length;
    const likedCount = Array.from(voteStatuses.values()).filter(
      (vote) => vote === VoteType.UPVOTE,
    ).length;

    this.logger.debug(
      `[getMultipleInteractionStatuses] Completed: ${bookmarkedCount} bookmarked, ${likedCount} liked`,
    );

    return interactionMap;
  }

  /**
   * 단일 포스트의 모든 상호작용 상태 조회
   *
   * @param postId 포스트 ID
   * @param userId 사용자 ID
   * @returns 상호작용 상태
   */
  async getInteractionStatus(
    postId: string,
    userId: string,
  ): Promise<PostInteractionStatus> {
    if (!postId || !userId) {
      return { bookmarked: false, liked: false, userVote: null };
    }

    const [bookmarked, userVote] = await Promise.all([
      this.bookmarksService.isBookmarked(postId, userId),
      this.postLikeStatusService.getVoteStatus(postId, userId),
    ]);

    return {
      bookmarked,
      liked: userVote === VoteType.UPVOTE,
      userVote,
    };
  }

  /**
   * 사용자의 모든 상호작용 상태를 한 번에 조회 (프로필 페이지용)
   *
   * @param userId 사용자 ID
   * @param postIds 포스트 ID 목록
   * @returns 상호작용 상태 맵
   */
  async getUserInteractionStatuses(
    userId: string,
    postIds: string[],
  ): Promise<Map<string, PostInteractionStatus>> {
    return this.getMultipleInteractionStatuses(postIds, userId);
  }
}
