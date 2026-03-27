import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { UsageLimitGuard } from "../subscription/guards/usage-limit.guard";
import { SubscriptionFacadeService } from "./subscription-facade.service";
import { SubscriptionController } from "../subscription/subscription.controller";
import { UsageModule } from "../usage/usage.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { PaymentHistory } from "../subscription/entities/payment-history.entity";
import { TossApiClient } from "../payment/providers/toss-api.client";

/**
 * 공유 구독 모듈 (Facade)
 *
 * 단방향 의존: SharedSubscriptionModule → SubscriptionModule, UsageModule
 * @Global() 데코레이터로 앱 전체에서 SubscriptionFacadeService 사용 가능
 * PaymentModule은 이 모듈을 통해 구독 서비스에 접근 (직접 import 없음)
 *
 * 의존성 그래프:
 *   UsageModule (독립)
 *   SubscriptionModule (독립)
 *       ↓
 *   SharedSubscriptionModule (Facade, Global)
 *       ↓
 *   PaymentModule (이 모듈을 Global로 사용)
 *
 * TossApiClient: 순수 HTTP 클라이언트 (ConfigService + HttpService만 의존)
 *                순환 의존 없이 직접 provide 가능
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentHistory]),
    HttpModule,
    UsageModule,
    SubscriptionModule,
  ],
  controllers: [SubscriptionController],
  providers: [UsageLimitGuard, SubscriptionFacadeService, TossApiClient],
  exports: [UsageLimitGuard, SubscriptionFacadeService],
})
export class SharedSubscriptionModule {}
