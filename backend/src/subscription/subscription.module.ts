import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionService } from './subscription.service';
// import { SubscriptionController } from './subscription.controller';
import { SubscriptionBasicController } from './subscription-basic.controller';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { PaymentHistory } from './entities/payment-history.entity';
import { User } from '../users/entities/user.entity';
import { SubscriptionGuard } from './guards/subscription.guard';
import { SubscriptionPlanSeeder } from './seeders/subscription-plan.seeder';

/**
 * 구독 모듈
 * 구독 관련 핵심 서비스와 엔티티 제공
 * PaymentModule과 UsageModule과의 순환 의존성 제거
 * SharedSubscriptionModule의 SubscriptionFacadeService를 통해 통합 관리
 * SubscriptionController는 SharedSubscriptionModule로 이동 (SubscriptionFacadeService 의존성 때문)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPlan,
      PaymentHistory,
      User,
    ]),
    ScheduleModule.forRoot(),
    // PaymentModule과 UsageModule은 제거
    // SubscriptionController는 SharedSubscriptionModule로 이동됨
  ],
  controllers: [SubscriptionBasicController], // SubscriptionController 제거
  providers: [
    SubscriptionService,
    SubscriptionGuard,
    SubscriptionPlanSeeder,
  ],
  exports: [
    SubscriptionService,
    SubscriptionGuard,
  ],
})
export class SubscriptionModule {}