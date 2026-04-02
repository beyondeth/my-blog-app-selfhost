import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { PaymentService } from "./payment.service";
import { PaymentWebhookController } from "./payment-webhook.controller";
import { TossCheckoutController } from "./controllers/toss-checkout.controller";
import { PaymentHistory } from "../subscription/entities/payment-history.entity";
import { Subscription } from "../subscription/entities/subscription.entity";
import { User } from "../users/entities/user.entity";
import { TossBillingKey } from "./entities/toss-billing-key.entity";
import { TossApiClient } from "./providers/toss-api.client";
import { TossProvider } from "./providers/toss.provider";
import { BillingSchedulerService } from "./services/billing-scheduler.service";
import { BillingProcessor } from "./queues/billing.processor";

/**
 * 결제 모듈
 *
 * 의존성 방향: PaymentModule → SharedSubscriptionModule(Global) → SubscriptionModule
 * PaymentModule은 SubscriptionModule을 직접 import하지 않음
 * SubscriptionFacadeService(Global)를 통해 구독 서비스에 접근
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentHistory,
      User,
      TossBillingKey,
      Subscription,
    ]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    BullModule.registerQueue({
      name: "billing",
    }),
    // SharedSubscriptionModule은 @Global()이므로 명시적 import 불필요
    // SubscriptionFacadeService는 전역에서 사용 가능
  ],
  controllers: [PaymentWebhookController, TossCheckoutController],
  providers: [
    PaymentService,
    TossApiClient,
    TossProvider,
    BillingSchedulerService,
    BillingProcessor,
  ],
  exports: [
    PaymentService,
    TossApiClient,
    TossProvider,
    BillingSchedulerService,
  ],
})
export class PaymentModule {}
