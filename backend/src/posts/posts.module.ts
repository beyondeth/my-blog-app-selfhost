import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { Post } from './entities/post.entity';
import { PostStats } from './entities/post-stats.entity';
import { PostMetadata } from './entities/post-metadata.entity';
import { PostLike } from './entities/post-like.entity';
import { File } from '../files/entities/file.entity';
import { FileContext } from '../files/entities/file-context.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { UsersModule } from '../users/users.module';
import { FilesModule } from '../files/files.module';
import { BlogsModule } from '../blogs/blogs.module';
// TagsModule removed - using JSONB tags
import { MonitoringModule } from '../monitoring/monitoring.module';
import { MarkdownRendererService } from '../common/services/markdown-renderer.service';
import { ViewCountService } from './view-count.service';
import { SearchIndexingService } from './search-indexing.service';
import { ContentProcessingModule } from '../content-processing/content-processing.module';
import { CacheModule } from '../cache/cache.module';
import { BookmarksModule } from '../bookmarks/bookmarks.module';
import { RedisModule } from '../redis/redis.module';
import { MetricsModule } from '../metrics/metrics.module';
import { CommonModule } from '../common/common.module';
import { EventsModule } from '../common/events/events.module';
import { BlogStatsService } from '../common/services/blog-stats.service';

// Event Handlers
import { BlogStatsHandler } from './handlers/blog-stats.handler';

// Queue System (Post Processing만 남기고 Like Queue 제거)
import { POST_PROCESSING_QUEUE } from './queues/post-processing.queue';
import { PostProcessingProcessor } from './processors/post-processing.processor';

// Service Layer
import { PostMapperService } from './services/post-mapper.service';
import { PostCacheService } from './services/post-cache.service';
import { PostFileService } from './services/post-file.service';
import { PostContentService } from './services/post-content.service';
import { PostReadService } from './services/post-read.service';
import { PostInteractionService } from './services/post-interaction.service';
import { PostCreationService } from './services/post-creation.service';
import { PostLikeStatusService } from './services/post-like-status.service';
import { PostInteractionStatusService } from './services/post-interaction-status.service';
import { LikeService } from './services/like.service';
import { ThumbnailService } from './services/thumbnail.service';
import { CloudflareModule } from '../cloudflare/cloudflare.module';


@Module({
  imports: [
    // Phase 1-2-3 리팩토링: PostStats, PostMetadata, PostLike 엔티티 추가
    TypeOrmModule.forFeature([Post, PostStats, PostMetadata, PostLike, File, FileContext, Blog]),
    // Post Processing Queue (새로 추가 - Fast Path 최적화용)
    BullModule.registerQueue({
      name: POST_PROCESSING_QUEUE,
      defaultJobOptions: {
        attempts: 3, // 실패 시 최대 3번 재시도
        backoff: {
          type: 'exponential',
          delay: 2000, // 첫 재시도: 2초, 두 번째: 4초, 세 번째: 8초
        },
        removeOnComplete: {
          age: 86400, // 24시간 후 완료된 Job 자동 삭제
          count: 1000, // 최대 1000개까지 보관
        },
        removeOnFail: {
          age: 604800, // 7일 후 실패한 Job 자동 삭제
          count: 5000, // 최대 5000개까지 보관 (디버깅용)
        },
        // timeout은 Worker 레벨에서 설정 (processor.ts 참조)
      },
    }),
    UsersModule,
    FilesModule,
    CommonModule, // 공통 서비스 모듈 추가
    EventsModule, // 이벤트 시스템 모듈 추가
    MonitoringModule,  // No more forwardRef needed
    ContentProcessingModule, // 콘텐츠 처리 모듈 추가
    CacheModule, // Redis 캐시 모듈 추가
    BookmarksModule, // 북마크 모듈 추가
    RedisModule, // Redis 모듈 추가 (Queue용)
    MetricsModule, // Prometheus 메트릭 모듈 추가
    CloudflareModule, // Cloudflare 캐시 관리 모듈
  ],
  providers: [
    PostsService,
    PostMapperService, // DTO 변환 서비스
    PostCacheService, // 캐시 관리 서비스
    PostFileService, // 파일 관리 서비스
    PostContentService, // 콘텐츠 처리 서비스
    PostReadService, // 조회 및 검색 서비스
    PostInteractionService, // 상호작용 관리 서비스
    PostCreationService, // 생성, 수정, 삭제 서비스
    PostLikeStatusService, // 좋아요 상태 조회 서비스
    PostInteractionStatusService, // 상호작용 상태 통합 서비스
    LikeService, // 단순화된 좋아요 서비스
    MarkdownRendererService,
    ViewCountService,
    SearchIndexingService, // 검색 인덱싱 배치 서비스 추가
    PostProcessingProcessor, // 포스트 처리 배치 워커 (Fast Path 최적화용)
    BlogStatsService, // 블로그 통계 서비스 (PostsModule로 이동)
    BlogStatsHandler, // 블로그 통계 이벤트 핸들러 (PostsModule로 이동)
    ThumbnailService, // 썸네일 관리 서비스
  ],
  controllers: [PostsController],
  exports: [PostsService, ViewCountService, SearchIndexingService, BlogStatsService, PostReadService, PostInteractionService, PostCreationService],
})
export class PostsModule {} 