/**
 * 평판 시스템 - NestJS 모듈
 *
 * 사용자 평판(Ranking) 시스템의 모든 구성 요소를 통합하는 모듈입니다.
 *
 * 구성 요소:
 * - Entities: ReputationLedger, ReputationTotal, TitleGrant
 * - Services: LedgerService, AggregatorService, TitleService, LeaderboardService
 * - Listeners: PostEventsListener, CommentEventsListener, ReactionEventsListener
 * - Jobs: DailyAggregateJob, WeeklyLeaderboardJob
 * - Controllers: ReputationAdminController
 * - Queue: ReputationQueueService, ReputationQueueProcessor (BullMQ)
 *
 * 의존성:
 * - TypeOrmModule: 엔티티 등록
 * - PostsModule: Post 엔티티 접근 (forwardRef)
 * - UsersModule: User 엔티티 접근 (forwardRef)
 * - RedisModule: Redis 접근
 * - BullModule: 큐 처리
 *
 * @see app.module.ts
 */
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

// Entities
import {
  ReputationLedger,
  ReputationTotal,
  TitleGrant,
} from './entities';

// Services
import {
  LedgerService,
  AggregatorService,
  TitleService,
  LeaderboardService,
} from './services';

// Listeners
import {
  PostEventsListener,
  CommentEventsListener,
  ReactionEventsListener,
  EditorPickEventsListener,
} from './listeners';

// Jobs
import { DailyAggregateJob, WeeklyLeaderboardJob } from './jobs';

// Queue
import {
  REPUTATION_QUEUE,
  ReputationQueueService,
  ReputationQueueProcessor,
} from './queues';

// Controllers
import { ReputationAdminController, ReputationPublicController } from './controllers';

// External modules
import { PostsModule } from '../posts/posts.module';
import { UsersModule } from '../users/users.module';
import { RedisModule } from '../redis/redis.module';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    // 엔티티 등록
    TypeOrmModule.forFeature([
      ReputationLedger,
      ReputationTotal,
      TitleGrant,
      Post, // ReactionEventsListener에서 사용
      User, // LeaderboardService에서 사용
    ]),
    // BullMQ 큐 등록
    BullModule.registerQueue({
      name: REPUTATION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 },
      },
    }),
    // 외부 모듈 의존성
    forwardRef(() => PostsModule),
    forwardRef(() => UsersModule),
    RedisModule,
  ],
  controllers: [
    ReputationAdminController,
    ReputationPublicController,
  ],
  providers: [
    // Services
    LedgerService,
    AggregatorService,
    TitleService,
    LeaderboardService,
    // Queue (BullMQ)
    ReputationQueueService,
    ReputationQueueProcessor,
    // Listeners (이벤트 자동 구독)
    PostEventsListener,
    CommentEventsListener,
    ReactionEventsListener,
    EditorPickEventsListener,
    // Jobs (Cron 자동 등록)
    DailyAggregateJob,
    WeeklyLeaderboardJob,
  ],
  exports: [
    // 다른 모듈에서 사용 가능하도록 export
    LedgerService,
    TitleService,
    LeaderboardService,
    ReputationQueueService,
  ],
})
export class ReputationModule {}
