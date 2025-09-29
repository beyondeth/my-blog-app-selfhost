import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UsageLimitGuard } from '../subscription/guards/usage-limit.guard';
import { SubscriptionFacadeService } from './subscription-facade.service';
import { SubscriptionController } from '../subscription/subscription.controller';
import { UsageModule } from '../usage/usage.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PaymentHistory } from '../subscription/entities/payment-history.entity';

/**
 * 공유 구독 모듈
 * 순환 의존성을 방지하기 위한 공통 모듈
 * SubscriptionFacadeService를 통해 구독, 결제, 사용량 서비스 통합 제공
 * UsageLimitGuard처럼 여러 모듈에서 사용되는 guard를 제공
 * SubscriptionController도 이 모듈에서 관리 (SubscriptionFacadeService 의존성 때문)
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentHistory]),
    EventEmitterModule.forRoot(),
    // 순환 의존성 방지를 위해 순서 중요
    // UsageModule과 SubscriptionModule은 서로를 직접 import하지 않음
    UsageModule,
    SubscriptionModule,
  ],
  controllers: [
    SubscriptionController, // SubscriptionController를 여기서 등록
  ],
  providers: [
    UsageLimitGuard,
    SubscriptionFacadeService,
  ],
  exports: [
    UsageLimitGuard,
    SubscriptionFacadeService,
  ],
})
export class SharedSubscriptionModule {}