import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { UserBlock } from './entities/user-block.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, UserBlock, User]),
    forwardRef(() => UsersModule),
    CacheModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}