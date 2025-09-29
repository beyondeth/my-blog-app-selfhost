import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UsageService } from './usage.service';
import { UsageTracking } from './entities/usage-tracking.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';

/**
 * 사용량 추적 모듈
 * 사용자별 리소스 사용량을 추적하고 제한을 관리
 * 이벤트 기반 설계로 순환 의존성 방지
 * SubscriptionModule 의존성 제거 - SharedSubscriptionModule을 통한 통합
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UsageTracking, User]),
    EventEmitterModule.forRoot(), // 이벤트 기반 통신을 위해 추가
    UsersModule, // UsersService 사용을 위해 import
    // SubscriptionModule 제거 - 순환 의존성 방지
  ],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}