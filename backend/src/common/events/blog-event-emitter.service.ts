import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { BlogEvent } from "./blog-events.enum";
import {
  BlogCreatedEvent,
  BlogUpdatedEvent,
  BlogAliasChangedEvent,
  BlogPostEvent,
  BlogPostInteractionEvent,
  BlogStatsUpdateEvent,
} from "./dto/blog-event.dto";

/**
 * 블로그 이벤트 발행 서비스
 *
 * 순환 의존성을 피하기 위해 이벤트 기반으로
 * 블로그 관련 상태 변경을 알림
 */
@Injectable()
export class BlogEventEmitter {
  private readonly logger = new Logger(BlogEventEmitter.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 블로그 생성 이벤트 발행
   */
  emitBlogCreated(data: BlogCreatedEvent): void {
    this.logger.debug(`Emitting blog created event: ${data.blogId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_CREATED, data);
  }

  /**
   * 블로그 정보 업데이트 이벤트 발행
   */
  emitBlogUpdated(data: BlogUpdatedEvent): void {
    this.logger.debug(`Emitting blog updated event: ${data.blogId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_UPDATED, data);
  }

  /**
   * 블로그 별칭 변경 이벤트 발행
   */
  emitBlogAliasChanged(data: BlogAliasChangedEvent): void {
    this.logger.debug(`Emitting blog alias changed event: ${data.blogId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_ALIAS_CHANGED, data);
  }

  /**
   * 블로그 포스트 생성 이벤트 발행
   */
  emitBlogPostCreated(data: BlogPostEvent): void {
    this.logger.debug(`Emitting blog post created event: ${data.postId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_POST_CREATED, data);
  }

  /**
   * 블로그 포스트 업데이트 이벤트 발행
   */
  emitBlogPostUpdated(data: BlogPostEvent): void {
    this.logger.debug(`Emitting blog post updated event: ${data.postId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_POST_UPDATED, data);
  }

  /**
   * 블로그 포스트 삭제 이벤트 발행
   */
  emitBlogPostDeleted(data: BlogPostEvent): void {
    this.logger.debug(`Emitting blog post deleted event: ${data.postId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_POST_DELETED, data);
  }

  /**
   * 블로그 포스트 좋아요 이벤트 발행
   */
  emitBlogPostLiked(data: BlogPostInteractionEvent): void {
    this.logger.debug(`Emitting blog post liked event: ${data.postId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_POST_LIKED, data);
  }

  /**
   * 블로그 포스트 조회 이벤트 발행
   */
  emitBlogPostViewed(data: BlogPostInteractionEvent): void {
    this.logger.debug(`Emitting blog post viewed event: ${data.postId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_POST_VIEWED, data);
  }

  /**
   * 블로그 통계 업데이트 요청 이벤트 발행
   */
  emitBlogStatsUpdateRequired(data: BlogStatsUpdateEvent): void {
    this.logger.debug(`Emitting blog stats update event: ${data.blogId}`);
    this.eventEmitter.emit(BlogEvent.BLOG_STATS_UPDATE_REQUIRED, data);
  }
}

/**
 * 블로그 이벤트 핸들러 데코레이터 팩토리
 */
export const BlogEventHandler = (event: BlogEvent) => {
  return OnEvent(event);
};
