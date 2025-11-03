import { Injectable, Logger } from '@nestjs/common';
import { BlogEventHandler } from '../../common/events/blog-event-emitter.service';
import { BlogEvent } from '../../common/events/blog-events.enum';
import {
  BlogCreatedEvent,
  BlogPostEvent,
  BlogPostInteractionEvent,
  BlogStatsUpdateEvent,
} from '../../common/events/dto/blog-event.dto';
import { BlogStatsService } from '../../common/services/blog-stats.service';

/**
 * 블로그 통계 이벤트 핸들러
 *
 * 블로그 관련 이벤트를 구독하여 통계를 업데이트
 */
@Injectable()
export class BlogStatsHandler {
  private readonly logger = new Logger(BlogStatsHandler.name);

  constructor(private readonly blogStatsService: BlogStatsService) {}

  /**
   * 블로그 생성 시 초기 통계 설정
   */
  @BlogEventHandler(BlogEvent.BLOG_CREATED)
  async handleBlogCreated(data: BlogCreatedEvent): Promise<void> {
    this.logger.log(`Initializing stats for new blog: ${data.blogId}`);

    // 초기 통계 설정이 필요하다면 여기서 구현
    // 예: 블로그 생성 시 기본 카테고리 설정 등
  }

  /**
   * 포스트 생성 시 통계 업데이트
   */
  @BlogEventHandler(BlogEvent.BLOG_POST_CREATED)
  async handlePostCreated(data: BlogPostEvent): Promise<void> {
    this.logger.debug(`Updating stats for new post: ${data.postId} in blog: ${data.blogId}`);

    // 포스트 카운트 증가
    await this.blogStatsService.invalidateBlogStatsCache(data.blogId);
  }

  /**
   * 포스트 업데이트 시 통계 업데이트
   */
  @BlogEventHandler(BlogEvent.BLOG_POST_UPDATED)
  async handlePostUpdated(data: BlogPostEvent): Promise<void> {
    this.logger.debug(`Updating stats for updated post: ${data.postId} in blog: ${data.blogId}`);

    // 카테고리 변경이 있을 경우 캐시 무효화
    await this.blogStatsService.invalidateBlogStatsCache(data.blogId);
  }

  /**
   * 포스트 삭제 시 통계 업데이트
   */
  @BlogEventHandler(BlogEvent.BLOG_POST_DELETED)
  async handlePostDeleted(data: BlogPostEvent): Promise<void> {
    this.logger.debug(`Updating stats for deleted post: ${data.postId} in blog: ${data.blogId}`);

    // 포스트 카운트 감소
    await this.blogStatsService.invalidateBlogStatsCache(data.blogId);
  }

  /**
   * 포스트 좋아요 시 통계 업데이트
   */
  @BlogEventHandler(BlogEvent.BLOG_POST_LIKED)
  async handlePostLiked(data: BlogPostInteractionEvent): Promise<void> {
    this.logger.debug(`Updating like stats for post: ${data.postId} in blog: ${data.blogId}`);

    // 좋아요 통계는 PostStatsService에서 처리하므로 여기서는 캐시만 무효화
    await this.blogStatsService.invalidateBlogStatsCache(data.blogId);
  }

  /**
   * 포스트 조회 시 통계 업데이트
   */
  @BlogEventHandler(BlogEvent.BLOG_POST_VIEWED)
  async handlePostViewed(data: BlogPostInteractionEvent): Promise<void> {
    this.logger.debug(`Updating view stats for post: ${data.postId} in blog: ${data.blogId}`);

    // 조회 통계는 PostStatsService에서 처리하므로 여기서는 캐시만 무효화
    // 주기적인 배치 업데이트를 위해 이벤트는 발행하지만 캐시는 즉시 무효화
  }

  /**
   * 통계 업데이트 요청 처리
   */
  @BlogEventHandler(BlogEvent.BLOG_STATS_UPDATE_REQUIRED)
  async handleStatsUpdateRequired(data: BlogStatsUpdateEvent): Promise<void> {
    this.logger.debug(`Processing stats update request for blog: ${data.blogId}, type: ${data.updateType}`);

    // TODO: 여기서는 실제 통계 재계산 로직 구현
    // 예: 배치 작업으로 등록하거나 즉시 계산

    // 캐시 무효화로 즉시 반영
    await this.blogStatsService.invalidateBlogStatsCache(data.blogId);
  }
}