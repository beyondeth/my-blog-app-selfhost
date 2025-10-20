import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { Post } from './entities/post.entity';
import { File } from '../files/entities/file.entity';
import { FileContext } from '../files/entities/file-context.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { UsersModule } from '../users/users.module';
import { FilesModule } from '../files/files.module';
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

// Queue System
import { LikeQueueService } from './services/like-queue.service';
import { LikeBatchWorker } from './workers/like-batch.worker';
import { POST_PROCESSING_QUEUE } from './queues/post-processing.queue';
import { PostProcessingProcessor } from './processors/post-processing.processor';

export const LIKE_QUEUE_NAME = 'post-likes';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, File, FileContext, Blog]),
    // Like Queue (기존)
    BullModule.registerQueue({
      name: LIKE_QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
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
    MonitoringModule,  // No more forwardRef needed
    ContentProcessingModule, // 콘텐츠 처리 모듈 추가
    CacheModule, // Redis 캐시 모듈 추가
    BookmarksModule, // 북마크 모듈 추가
    RedisModule, // Redis 모듈 추가 (Queue용)
    MetricsModule, // Prometheus 메트릭 모듈 추가 (LikeMetricsService 제공)
  ],
  providers: [
    PostsService,
    MarkdownRendererService,
    ViewCountService,
    SearchIndexingService, // 검색 인덱싱 배치 서비스 추가
    LikeQueueService, // 좋아요 큐 서비스
    LikeBatchWorker, // 좋아요 배치 워커
    PostProcessingProcessor, // 포스트 처리 배치 워커 (Fast Path 최적화용)
  ],
  controllers: [PostsController],
  exports: [PostsService, ViewCountService, SearchIndexingService, LikeQueueService],
})
export class PostsModule {} 