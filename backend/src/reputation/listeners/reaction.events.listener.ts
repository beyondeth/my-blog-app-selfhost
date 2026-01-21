/**
 * 평판 시스템 - 반응(좋아요/북마크) 이벤트 리스너
 *
 * 좋아요 및 북마크 이벤트를 구독하여 콘텐츠 작성자에게 평판 점수를 부여합니다.
 *
 * 구독 이벤트:
 * - PostInteractionEvents.LIKE_TOGGLED: 좋아요 시 LIKE_RECEIVED 점수 부여
 * - PostInteractionEvents.BOOKMARK_TOGGLED: 북마크 시 BOOKMARK_RECEIVED 점수 부여
 *
 * 중요:
 * - 셀프 반응은 집계 시점에 필터링됨
 * - 좋아요 취소(unliked) 시에는 점수를 부여하지 않음
 * - 이벤트는 큐에 추가되고, 집계 시점에 배치 INSERT됨
 *
 * @see PostInteractionEvents
 * @see ReputationQueueService
 */
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  PostInteractionEvents,
  LikeToggledEventPayload,
  BookmarkToggledEventPayload,
} from "../../posts/events/post-interaction.events";
import { Post } from "../../posts/entities/post.entity";
import { ReputationQueueService } from "../queues/reputation-queue.service";
import { ReputationAction } from "../enums/reputation-action.enum";

@Injectable()
export class ReactionEventsListener {
  private readonly logger = new Logger(ReactionEventsListener.name);

  constructor(
    private readonly queueService: ReputationQueueService,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  /**
   * 좋아요 토글 이벤트 핸들러
   *
   * 좋아요가 추가되면 해당 포스트 작성자에게 LIKE_RECEIVED 점수를 큐에 추가합니다.
   * 좋아요가 취소되면 점수를 부여하지 않습니다.
   *
   * @param payload 좋아요 토글 이벤트 페이로드
   */
  @OnEvent(PostInteractionEvents.LIKE_TOGGLED)
  async handleLikeToggled(payload: LikeToggledEventPayload): Promise<void> {
    // 좋아요가 추가된 경우에만 처리
    if (!payload.liked) {
      this.logger.debug(
        `좋아요 취소 - 점수 부여하지 않음: postId=${payload.postId}`,
      );
      return;
    }

    this.logger.debug(
      `좋아요 추가 이벤트 수신: postId=${payload.postId}, userId=${payload.userId}`,
    );

    try {
      // 포스트 작성자 조회
      const post = await this.postRepository.findOne({
        where: { id: payload.postId },
        select: ["id", "authorId"],
      });

      if (!post) {
        this.logger.warn(`포스트를 찾을 수 없음: postId=${payload.postId}`);
        return;
      }

      // 셀프 반응 체크 (자기 글에 좋아요)
      if (post.authorId === payload.userId) {
        this.logger.debug(`셀프 반응 무시: postId=${payload.postId}`);
        return;
      }

      // 큐에 이벤트 추가 (즉시 INSERT 대신)
      await this.queueService.addReputationEvent({
        action: ReputationAction.LIKE_RECEIVED,
        userId: post.authorId, // 포스트 작성자에게 점수 부여
        triggeredBy: payload.userId, // 좋아요를 누른 사용자
        targetType: "post",
        targetId: payload.postId,
        occurredAt: new Date(),
        metadata: {
          likedBy: payload.userId,
          likeCount: payload.likeCount,
        },
      });

      this.logger.log(
        `LIKE_RECEIVED 큐 추가: authorId=${post.authorId}, postId=${payload.postId}, likedBy=${payload.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `좋아요 평판 큐 추가 실패: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 북마크 토글 이벤트 핸들러
   *
   * 북마크가 추가되면 해당 포스트 작성자에게 BOOKMARK_RECEIVED 점수를 큐에 추가합니다.
   * 북마크가 취소되면 점수를 부여하지 않습니다.
   *
   * @param payload 북마크 토글 이벤트 페이로드
   */
  @OnEvent(PostInteractionEvents.BOOKMARK_TOGGLED)
  async handleBookmarkToggled(
    payload: BookmarkToggledEventPayload,
  ): Promise<void> {
    // 북마크가 추가된 경우에만 처리
    if (!payload.bookmarked) {
      this.logger.debug(
        `북마크 취소 - 점수 부여하지 않음: postId=${payload.postId}`,
      );
      return;
    }

    this.logger.debug(
      `북마크 추가 이벤트 수신: postId=${payload.postId}, userId=${payload.userId}`,
    );

    try {
      // 포스트 작성자 조회
      const post = await this.postRepository.findOne({
        where: { id: payload.postId },
        select: ["id", "authorId"],
      });

      if (!post) {
        this.logger.warn(`포스트를 찾을 수 없음: postId=${payload.postId}`);
        return;
      }

      // 셀프 반응 체크 (자기 글에 북마크)
      if (post.authorId === payload.userId) {
        this.logger.debug(`셀프 반응 무시: postId=${payload.postId}`);
        return;
      }

      // 큐에 이벤트 추가 (즉시 INSERT 대신)
      await this.queueService.addReputationEvent({
        action: ReputationAction.BOOKMARK_RECEIVED,
        userId: post.authorId, // 포스트 작성자에게 점수 부여
        triggeredBy: payload.userId, // 북마크한 사용자
        targetType: "post",
        targetId: payload.postId,
        occurredAt: new Date(),
        metadata: {
          bookmarkedBy: payload.userId,
        },
      });

      this.logger.log(
        `BOOKMARK_RECEIVED 큐 추가: authorId=${post.authorId}, postId=${payload.postId}, bookmarkedBy=${payload.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `북마크 평판 큐 추가 실패: ${error.message}`,
        error.stack,
      );
    }
  }
}
