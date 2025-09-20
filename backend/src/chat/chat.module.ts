import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers & Gateways
import { ChatController } from './controllers/chat.controller';
import { ChatGateway } from './gateways/chat.gateway';

// Services
import { ChatService } from './services/chat.service';
import { ChatQueueService } from './services/chat-queue.service';
import { ChatBatchService } from './services/chat-batch.service';

// Repositories
import { MessageRepository } from './repositories/message.repository';
import { ConversationRepository } from './repositories/conversation.repository';

// Workers
import { MessageBatchWorker, CHAT_QUEUE_NAME } from './workers/message-batch.worker';

// Entities
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { UserBlock } from './entities/user-block.entity';
import { User } from '../users/entities/user.entity';

// External Modules
import { UsersModule } from '../users/users.module';
import { CacheModule } from '../cache/cache.module';
import { RedisModule } from '../redis/redis.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, UserBlock, User]),
    BullModule.registerQueue({
      name: CHAT_QUEUE_NAME,
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
    ScheduleModule.forRoot(),
    forwardRef(() => UsersModule),
    CacheModule,
    RedisModule,
    MetricsModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    ChatQueueService,
    ChatBatchService,
    MessageRepository,
    ConversationRepository,
    MessageBatchWorker,
  ],
  exports: [ChatService, ChatQueueService],
})
export class ChatModule {}