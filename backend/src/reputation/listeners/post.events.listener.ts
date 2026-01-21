/**
 * 평판 시스템 - 포스트 이벤트 리스너
 *
 * 블로그 포스트 관련 이벤트를 구독하여 평판 점수를 기록합니다.
 *
 * 구독 이벤트:
 * - BlogEvent.BLOG_POST_CREATED: 포스트 발행 시 POST_PUBLISHED 점수 부여
 *
 * @see BlogEventEmitter
 * @see ReputationQueueService
 */
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { BlogEvent } from "../../common/events/blog-events.enum";
import { BlogPostEvent } from "../../common/events/dto/blog-event.dto";
import { ReputationQueueService } from "../queues/reputation-queue.service";
import { ReputationAction } from "../enums/reputation-action.enum";

@Injectable()
export class PostEventsListener {
  private readonly logger = new Logger(PostEventsListener.name);

  constructor(private readonly queueService: ReputationQueueService) {}

  /**
   * 포스트 생성 이벤트 핸들러
   *
   * 블로그 포스트가 발행되면 해당 작성자에게 POST_PUBLISHED 점수를 큐에 추가합니다.
   *
   * @param payload 포스트 생성 이벤트 페이로드
   */
  @OnEvent(BlogEvent.BLOG_POST_CREATED)
  async handlePostCreated(payload: BlogPostEvent): Promise<void> {
    this.logger.debug(
      `포스트 생성 이벤트 수신: postId=${payload.postId}, userId=${payload.userId}`,
    );

    try {
      // 큐에 이벤트 추가 (즉시 INSERT 대신)
      await this.queueService.addReputationEvent({
        action: ReputationAction.POST_PUBLISHED,
        userId: payload.userId,
        targetType: "post",
        targetId: payload.postId,
        occurredAt: new Date(),
        metadata: {
          postTitle: payload.title,
          blogId: payload.blogId,
        },
      });

      this.logger.log(
        `POST_PUBLISHED 큐 추가: userId=${payload.userId}, postId=${payload.postId}`,
      );
    } catch (error) {
      this.logger.error(
        `포스트 평판 큐 추가 실패: ${error.message}`,
        error.stack,
      );
    }
  }
}
