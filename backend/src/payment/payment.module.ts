import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentHistory } from '../subscription/entities/payment-history.entity';
import { User } from '../users/entities/user.entity';
import { SharedSubscriptionModule } from '../shared/shared-subscription.module';
import { SubscriptionModule } from '../subscription/subscription.module';

/**
 * 결제 모듈
 * 결제 서비스와 제공자들을 관리
 * Event-Driven Architecture로 SubscriptionModule과 분리됨
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentHistory, User]),
    // Facade 패턴을 통한 구독 서비스 접근
    SharedSubscriptionModule,
    // PaymentWebhookController에서 SubscriptionService 사용을 위해 추가
    SubscriptionModule,
  ],
  controllers: [PaymentWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}