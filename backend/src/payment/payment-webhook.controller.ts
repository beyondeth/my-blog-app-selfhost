import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SubscriptionFacadeService } from '../shared/subscription-facade.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionTier, BillingCycle } from '../common/enums/subscription.enum';

/**
 * 결제 웹훅 처리 컨트롤러
 * Mock 및 실제 결제 게이트웨이의 웹훅을 처리
 */
@Controller('payment/webhook')
export class PaymentWebhookController {
  constructor(
    private readonly subscriptionFacade: SubscriptionFacadeService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * Mock 결제 웹훅 처리
   * 개발/테스트용으로 결제 완료를 시뮬레이션
   */
  @Post('mock')
  @UseGuards(JwtAuthGuard)
  async handleMockWebhook(
    @Request() req,
    @Body() body: {
      event: string;
      sessionId: string;
      tier: SubscriptionTier;
      billingCycle: BillingCycle;
    }
  ) {
    console.log('[Mock Webhook] Received:', body);
    console.log('[Mock Webhook] User ID:', req.user.id);

    if (body.event === 'checkout.session.completed') {
      // Mock 결제이므로 간단하게 처리
      // 사용자의 구독을 직접 업데이트
      try {
        // 구독 업데이트 처리
        const subscription = await this.subscriptionService.updateUserSubscription(
          req.user.id,  // req.user는 User 엔티티 객체이므로 id 속성 사용
          body.tier,
          body.billingCycle,
        );

        console.log('[Mock Webhook] Subscription updated:', subscription);

        return {
          success: true,
          message: '구독이 성공적으로 처리되었습니다',
          data: {
            tier: body.tier,
            billingCycle: body.billingCycle,
            subscription,
          }
        };
      } catch (error) {
        console.error('[Mock Webhook] Error updating subscription:', error);
        return {
          success: false,
          message: '구독 업데이트 중 오류가 발생했습니다',
          error: error.message,
        };
      }
    }

    return {
      success: false,
      message: '알 수 없는 이벤트입니다',
    };
  }

  /**
   * Stripe 웹훅 처리 (추후 구현)
   */
  @Post('stripe')
  async handleStripeWebhook(@Body() body: any) {
    // TODO: Stripe 웹훅 서명 검증 및 처리
    console.log('[Stripe Webhook] Received:', body.type);
    return { received: true };
  }

  /**
   * Toss Payments 웹훅 처리 (추후 구현)
   */
  @Post('toss')
  async handleTossWebhook(@Body() body: any) {
    // TODO: Toss Payments 웹훅 처리
    console.log('[Toss Webhook] Received:', body);
    return { received: true };
  }
}