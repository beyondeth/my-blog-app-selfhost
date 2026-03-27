import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { SubscriptionService } from "./subscription.service";
import { SubscriptionBasicController } from "./subscription-basic.controller";
import { Subscription } from "./entities/subscription.entity";
import { SubscriptionPlan } from "./entities/subscription-plan.entity";
import { PaymentHistory } from "./entities/payment-history.entity";
import { User } from "../users/entities/user.entity";
import { SubscriptionGuard } from "./guards/subscription.guard";
import { SubscriptionPlanSeeder } from "./seeders/subscription-plan.seeder";

/**
 * 구독 모듈
 * 구독 관련 핵심 서비스와 엔티티 제공
 * PaymentModule을 import하지 않음 — 순환 의존성 방지
 * 결제 관련 컨트롤러(토스 체크아웃)는 PaymentModule에서 관리
 * EventEmitterModule: 구독 변경 이벤트를 UsageService에 전달하여 캐시 무효화
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
    EventEmitterModule,
  ],
  controllers: [SubscriptionBasicController],
  providers: [SubscriptionService, SubscriptionGuard, SubscriptionPlanSeeder],
  exports: [SubscriptionService, SubscriptionGuard],
})
export class SubscriptionModule {}
