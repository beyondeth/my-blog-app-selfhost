import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { User } from "../users/entities/user.entity";
import { PaymentHistory } from "../subscription/entities/payment-history.entity";
import { PaymentProvider } from "./interfaces/payment-provider.interface";
import { MockProvider } from "./providers/mock.provider";
import {
  SubscriptionTier,
  BillingCycle,
  PaymentStatus,
} from "../common/enums/subscription.enum";
import { PaymentEvents } from "./enums/payment-events.enum";
import {
  PaymentSuccessPayload,
  PaymentFailedPayload,
  RefundPayload,
  WebhookPayload,
  InvoicePaymentPayload,
} from "./interfaces/payment-event-payloads.interface";

/**
 * 결제 처리 서비스
 * 다양한 결제 제공자를 통합 관리하고 결제 프로세스를 처리
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private providers: Map<string, PaymentProvider> = new Map();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // 결제 제공자 초기화
    this.initializeProviders();
  }

  /**
   * 결제 제공자 초기화
   * 환경 설정에 따라 적절한 제공자 등록
   */
  private initializeProviders() {
    // Mock Provider는 항상 등록 (개발/테스트용)
    this.providers.set("mock", new MockProvider());

    // Stripe Provider (추후 구현)
    // if (this.configService.get('STRIPE_SECRET_KEY')) {
    //   this.providers.set('stripe', new StripeProvider(...));
    // }

    // Toss Provider (추후 구현)
    // if (this.configService.get('TOSS_SECRET_KEY')) {
    //   this.providers.set('toss', new TossProvider(...));
    // }
  }

  /**
   * 결제 제공자 가져오기
   */
  private getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new BadRequestException(`결제 제공자 '${name}'를 찾을 수 없습니다`);
    }
    return provider;
  }

  /**
   * 플랜별 가격 계산
   * 티어와 결제 주기에 따른 가격 반환
   */
  private calculatePrice(
    tier: SubscriptionTier,
    billingCycle: BillingCycle,
  ): number {
    const prices = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STARTER]: {
        [BillingCycle.MONTHLY]: 900, // $9/월
        [BillingCycle.YEARLY]: 9000, // $90/년 (2개월 할인)
      },
      [SubscriptionTier.PRO]: {
        [BillingCycle.MONTHLY]: 1900, // $19/월
        [BillingCycle.YEARLY]: 19000, // $190/년 (2개월 할인)
      },
    };

    if (tier === SubscriptionTier.FREE) {
      return 0;
    }

    return prices[tier]?.[billingCycle] || 0;
  }

  /**
   * 체크아웃 세션 생성
   * 결제 페이지로 이동하기 위한 세션 생성
   */
  async createCheckoutSession(options: {
    userId: string;
    tier: SubscriptionTier;
    billingCycle: BillingCycle;
    provider: string;
  }) {
    const user = await this.userRepository.findOne({
      where: { id: options.userId },
    });

    if (!user) {
      throw new BadRequestException("사용자를 찾을 수 없습니다");
    }

    const provider = this.getProvider(options.provider);
    const price = this.calculatePrice(options.tier, options.billingCycle);

    // 고객 ID가 없으면 생성
    if (!user.stripeCustomerId && options.provider === "stripe") {
      const customerId = await provider.createCustomer({
        email: user.email,
        name: user.name || user.email,
        metadata: { userId: user.id.toString() },
      });

      user.stripeCustomerId = customerId;
      await this.userRepository.save(user);
    }

    // 체크아웃 세션 생성
    const session = await provider.createCheckoutSession({
      customerId: user.stripeCustomerId,
      priceAmount: price,
      currency: "usd",
      productName: `${options.tier.toUpperCase()} Plan`,
      billingCycle: options.billingCycle,
      metadata: {
        userId: user.id.toString(),
        tier: options.tier,
        billingCycle: options.billingCycle,
      },
      successUrl: `${this.configService.get("FRONTEND_URL")}/subscription/success`,
      cancelUrl: `${this.configService.get("FRONTEND_URL")}/subscription/cancel`,
    });

    // 결제 기록 생성 (pending 상태)
    await this.paymentHistoryRepository.save({
      user,
      amount: price,
      currency: "usd",
      status: PaymentStatus.PENDING,
      provider: options.provider,
      providerId: session.id,
      metadata: {
        tier: options.tier,
        billingCycle: options.billingCycle,
        sessionUrl: session.url,
      },
    });

    return session;
  }

  /**
   * 결제 수단 목록 조회
   */
  async getPaymentMethods(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.stripeCustomerId) {
      return [];
    }

    // 현재는 Mock provider만 있으므로 Mock 데이터 반환
    const provider = this.getProvider("mock");
    return await provider.listPaymentMethods(user.stripeCustomerId);
  }

  /**
   * 기본 결제 수단 설정
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.stripeCustomerId) {
      throw new BadRequestException("결제 고객 정보가 없습니다");
    }

    const provider = this.getProvider("mock"); // 실제로는 동적으로 선택
    await provider.setDefaultPaymentMethod(
      user.stripeCustomerId,
      paymentMethodId,
    );
  }

  /**
   * 환불 처리
   */
  async createRefund(
    userId: string,
    paymentId: string,
    reason: string,
    amount?: number,
  ) {
    // 결제 기록 조회
    const payment = await this.paymentHistoryRepository.findOne({
      where: {
        id: paymentId,
        userId: userId,
      },
      relations: ["user"],
    });

    if (!payment) {
      throw new BadRequestException("결제 기록을 찾을 수 없습니다");
    }

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException("환불 가능한 결제가 아닙니다");
    }

    // 환불 금액 계산 (부분 환불 또는 전액 환불)
    const refundAmount = amount || payment.amount;
    if (refundAmount > payment.amount) {
      throw new BadRequestException("환불 금액이 결제 금액보다 큽니다");
    }

    const provider = this.getProvider(payment.provider);
    const refund = await provider.createRefund(
      payment.providerId,
      refundAmount,
    );

    // 결제 기록 업데이트
    payment.status =
      refundAmount === payment.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
    payment.refundedAmount = (payment.refundedAmount || 0) + refundAmount;
    payment.refundReason = reason;
    await this.paymentHistoryRepository.save(payment);

    // 전액 환불 시 구독 취소 이벤트 발행
    if (refundAmount === payment.amount) {
      const refundPayload: RefundPayload = {
        userId,
        paymentId,
        refundId: refund.id,
        amount: refundAmount,
        reason,
        status: "success",
        timestamp: new Date(),
      };

      // 환불 성공 이벤트 발행
      this.eventEmitter.emit(PaymentEvents.REFUND_SUCCESS, refundPayload);
    }

    return {
      refundId: refund.id,
      amount: refundAmount,
      status: refund.status,
      reason,
    };
  }

  /**
   * 웹훅 처리
   * 결제 서비스에서 발생한 이벤트 처리
   */
  async handleWebhook(provider: string, payload: any, signature?: string) {
    const paymentProvider = this.getProvider(provider);

    // 서명 검증
    if (
      signature &&
      !paymentProvider.verifyWebhookSignature(payload, signature)
    ) {
      throw new BadRequestException("Invalid webhook signature");
    }

    // 이벤트 파싱
    const event = paymentProvider.parseWebhookEvent(payload);

    // 이벤트 타입별 처리
    switch (event.type) {
      case "checkout.session.completed":
      case "payment_intent.succeeded":
        await this.handlePaymentSuccess(event.data);
        break;

      case "payment_intent.payment_failed":
        await this.handlePaymentFailed(event.data);
        break;

      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data);
        break;

      case "customer.subscription.deleted":
        await this.handleSubscriptionCanceled(event.data);
        break;

      case "invoice.payment_succeeded":
        await this.handleInvoicePaymentSuccess(event.data);
        break;

      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event.data);
        break;

      default:
        this.logger.warn(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * 결제 성공 처리
   */
  private async handlePaymentSuccess(data: any) {
    const userId = data.metadata?.userId;
    if (!userId) return;

    // 결제 기록 업데이트
    const payment = await this.paymentHistoryRepository.findOne({
      where: { providerId: data.id },
    });

    if (payment) {
      payment.status = PaymentStatus.SUCCEEDED;
      await this.paymentHistoryRepository.save(payment);
    }

    // 구독 활성화
    const tier = data.metadata?.tier as SubscriptionTier;
    const billingCycle = data.metadata?.billingCycle as BillingCycle;

    if (tier && billingCycle) {
      // 결제 성공 이벤트 발행
      const paymentPayload: PaymentSuccessPayload = {
        userId,
        paymentId: data.id,
        amount: payment?.amount || 0,
        currency: data.currency || "usd",
        provider: payment?.provider || "unknown",
        metadata: {
          tier,
          billingCycle,
          paymentIntentId: data.payment_intent || data.id,
          subscriptionId: data.subscription,
        },
        timestamp: new Date(),
      };

      this.eventEmitter.emit(PaymentEvents.PAYMENT_SUCCESS, paymentPayload);
    }
  }

  /**
   * 결제 실패 처리
   */
  private async handlePaymentFailed(data: any) {
    const payment = await this.paymentHistoryRepository.findOne({
      where: { providerId: data.id },
    });

    if (payment) {
      payment.status = PaymentStatus.FAILED;
      payment.metadata = {
        ...payment.metadata,
        failureReason: data.failure_message || "Payment failed",
      };
      await this.paymentHistoryRepository.save(payment);

      // 결제 실패 이벤트 발행
      const failedPayload: PaymentFailedPayload = {
        userId: payment.userId || "0",
        paymentId: data.id,
        reason: data.failure_message || "Payment failed",
        provider: payment.provider,
        metadata: payment.metadata,
        timestamp: new Date(),
      };

      this.eventEmitter.emit(PaymentEvents.PAYMENT_FAILED, failedPayload);
    }
  }

  /**
   * 구독 업데이트 처리
   */
  private async handleSubscriptionUpdated(data: any) {
    // 구독 상태 업데이트 로직
    this.logger.debug("Subscription updated:", data);
  }

  /**
   * 구독 취소 처리
   */
  private async handleSubscriptionCanceled(data: any) {
    const userId = data.metadata?.userId;
    if (userId) {
      // 구독 취소 이벤트 발행
      this.eventEmitter.emit(PaymentEvents.SUBSCRIPTION_CANCELLED, {
        userId,
        subscriptionId: data.id,
        reason: "Provider subscription cancelled",
        immediately: true,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 인보이스 결제 성공 처리 (정기 결제)
   */
  private async handleInvoicePaymentSuccess(data: any) {
    // 정기 결제 성공 처리
    this.logger.debug("Invoice payment succeeded:", data);
  }

  /**
   * 인보이스 결제 실패 처리 (정기 결제)
   */
  private async handleInvoicePaymentFailed(data: any) {
    // 정기 결제 실패 처리
    // 재시도 또는 구독 일시 정지 등
    this.logger.debug("Invoice payment failed:", data);
  }
}
