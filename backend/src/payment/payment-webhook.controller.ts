import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  Request,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { SubscriptionFacadeService } from "../shared/subscription-facade.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TossProvider } from "./providers/toss.provider";
import { PaymentService } from "./payment.service";
import {
  SubscriptionTier,
  BillingCycle,
} from "../common/enums/subscription.enum";

/**
 * 결제 웹훅 처리 컨트롤러
 * Mock 및 실제 결제 게이트웨이의 웹훅을 처리
 */
@Controller("payment/webhook")
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);
  // 멱등성: 처리된 웹훅 이벤트 ID 캐시 (메모리, 5분 TTL)
  private readonly processedEvents = new Map<string, number>();

  constructor(
    private readonly subscriptionFacade: SubscriptionFacadeService,
    private readonly tossProvider: TossProvider,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Mock 결제 웹훅 처리
   * 개발/테스트용으로 결제 완료를 시뮬레이션
   */
  @Post("mock")
  @UseGuards(JwtAuthGuard)
  async handleMockWebhook(
    @Request() req,
    @Body()
    body: {
      event: string;
      sessionId: string;
      tier: SubscriptionTier;
      billingCycle: BillingCycle;
    },
  ) {
    // 프로덕션에서는 Mock 웹훅 사용 불가 (보안)
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("Mock webhook is not available in production");
    }

    this.logger.debug("[Mock Webhook] Received:", body);
    this.logger.debug("[Mock Webhook] User ID:", req.user.id);

    if (body.event === "checkout.session.completed") {
      // Mock 결제이므로 간단하게 처리
      // 사용자의 구독을 직접 업데이트
      try {
        // 구독 업데이트 처리
        const subscription =
          await this.subscriptionFacade.updateUserSubscription(
            req.user.id, // req.user는 User 엔티티 객체이므로 id 속성 사용
            body.tier,
            body.billingCycle,
          );

        this.logger.debug("[Mock Webhook] Subscription updated:", subscription);

        return {
          success: true,
          message: "구독이 성공적으로 처리되었습니다",
          data: {
            tier: body.tier,
            billingCycle: body.billingCycle,
            subscription,
          },
        };
      } catch (error) {
        this.logger.error("[Mock Webhook] Error updating subscription:", error);
        return {
          success: false,
          message: "구독 업데이트 중 오류가 발생했습니다",
          error: error.message,
        };
      }
    }

    return {
      success: false,
      message: "알 수 없는 이벤트입니다",
    };
  }

  /**
   * Stripe 웹훅 처리 (추후 구현)
   */
  @Post("stripe")
  async handleStripeWebhook(@Body() body: any) {
    // TODO: Stripe 웹훅 서명 검증 및 처리
    this.logger.debug("[Stripe Webhook] Received:", body.type);
    return { received: true };
  }

  /**
   * Toss Payments 웹훅 처리
   *
   * 토스 웹훅 이벤트:
   * - PAYMENT_STATUS_CHANGED: 결제 상태 변경
   * - BILLING_DELETED: 빌링키 삭제
   * - CANCEL_STATUS_CHANGED: 취소 상태 변경
   * - DEPOSIT_CALLBACK: 가상계좌 입금 확인
   *
   * 서명 검증: HMAC SHA-256
   * 인증 없음 (서버간 통신)
   */
  @Post("toss")
  @HttpCode(HttpStatus.OK)
  async handleTossWebhook(
    @Body() body: any,
    @Headers("x-toss-signature") signature: string,
  ) {
    const eventType = body.eventType || body.event_type;
    this.logger.debug(`[Toss Webhook] Received: ${eventType}`);

    // 멱등성 체크: 동일 이벤트 중복 처리 방지
    // Date.now() 폴백은 매번 고유값이 되어 멱등성 보장 불가 → 결정론적 키 사용
    const eventId =
      body.transactionKey ||
      body.paymentKey ||
      body.eventId ||
      `${eventType}_${body.data?.billingKey || body.data?.paymentKey || JSON.stringify(body.data || {})}`;
    if (this.processedEvents.has(eventId)) {
      this.logger.debug(`[Toss Webhook] 이미 처리된 이벤트 — 건너뜀: ${eventId}`);
      return { success: true, duplicate: true };
    }

    // 서명 검증 — 프로덕션에서는 서명 필수
    if (!signature) {
      this.logger.warn("[Toss Webhook] 서명 헤더 누락");
      if (process.env.NODE_ENV === "production") {
        throw new BadRequestException("웹훅 서명이 필요합니다");
      }
    } else if (!this.tossProvider.verifyWebhookSignature(body, signature)) {
      this.logger.error("[Toss Webhook] 서명 검증 실패");
      throw new BadRequestException("웹훅 서명 검증 실패");
    }

    try {
      switch (eventType) {
        case "PAYMENT_STATUS_CHANGED":
          await this.paymentService.handleWebhook("toss", body, signature);
          break;

        case "BILLING_DELETED":
          // 빌링키 삭제 → 해당 빌링키 비활성화
          if (body.data?.billingKey) {
            await this.tossProvider.deletePaymentMethod(body.data.billingKey);
          }
          this.logger.warn(
            `[Toss Webhook] 빌링키 비활성화 완료: ${body.data?.billingKey}`,
          );
          break;

        case "CANCEL_STATUS_CHANGED":
          await this.paymentService.handleWebhook("toss", body, signature);
          break;

        case "DEPOSIT_CALLBACK":
          this.logger.debug("[Toss Webhook] 가상계좌 입금 확인");
          break;

        default:
          this.logger.warn(`[Toss Webhook] 미처리 이벤트: ${eventType}`);
      }

      // 처리 완료 기록 (5분 TTL)
      this.processedEvents.set(eventId, Date.now());
      this.cleanupProcessedEvents();

      return { success: true };
    } catch (error) {
      this.logger.error(
        `[Toss Webhook] 처리 실패: ${error.message}`,
      );
      throw error; // 500 반환 → 토스가 재시도
    }
  }

  /**
   * 5분 이상 경과한 처리 이벤트 ID 정리
   */
  private cleanupProcessedEvents(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [id, timestamp] of this.processedEvents) {
      if (timestamp < fiveMinutesAgo) {
        this.processedEvents.delete(id);
      }
    }
  }
}
