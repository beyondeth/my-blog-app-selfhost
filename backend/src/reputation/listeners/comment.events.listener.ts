/**
 * 평판 시스템 - 댓글 이벤트 리스너
 *
 * 댓글 관련 이벤트를 구독하여 평판 점수를 기록합니다.
 *
 * 구독 이벤트:
 * - PostInteractionEvents.COMMENT_ADDED: 댓글 작성 시 COMMENT_ADDED 점수 부여
 *
 * @see PostInteractionEvents
 * @see ReputationQueueService
 */
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CommentAddedEventPayload,
  PostInteractionEvents,
} from "../../posts/events/post-interaction.events";
import { ReputationQueueService } from "../queues/reputation-queue.service";
import { ReputationAction } from "../enums/reputation-action.enum";

@Injectable()
export class CommentEventsListener {
  private readonly logger = new Logger(CommentEventsListener.name);

  constructor(private readonly queueService: ReputationQueueService) {}

  /**
   * 댓글 추가 이벤트 핸들러
   *
   * 댓글이 작성되면 해당 작성자에게 COMMENT_ADDED 점수를 큐에 추가합니다.
   *
   * @param payload 댓글 추가 이벤트 페이로드
   */
  @OnEvent(PostInteractionEvents.COMMENT_ADDED)
  async handleCommentAdded(payload: CommentAddedEventPayload): Promise<void> {
    this.logger.debug(
      `댓글 추가 이벤트 수신: commentId=${payload.commentId}, authorId=${payload.authorId}`,
    );

    try {
      // 큐에 이벤트 추가 (즉시 INSERT 대신)
      await this.queueService.addReputationEvent({
        action: ReputationAction.COMMENT_ADDED,
        userId: payload.authorId,
        targetType: "comment",
        targetId: payload.commentId,
        occurredAt: payload.timestamp,
        metadata: {
          postId: payload.postId,
          outboxEventId: payload.outboxEventId,
        },
      });

      this.logger.log(
        `COMMENT_ADDED 큐 추가: authorId=${payload.authorId}, commentId=${payload.commentId}`,
      );
    } catch (error) {
      this.logger.error(
        `댓글 평판 큐 추가 실패: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
