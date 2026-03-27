import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SubscriptionService } from "../subscription/subscription.service";
import { UsageService } from "../usage/usage.service";
import { PaymentHistory } from "../subscription/entities/payment-history.entity";
import { TossApiClient } from "../payment/providers/toss-api.client";
import {
  SubscriptionTier,
  BillingCycle,
  ResourceType,
  PaymentStatus,
} from "../common/enums/subscription.enum";

/**
 * 구독 Facade 서비스
 * 구독, 결제, 사용량 관련 서비스들을 통합 관리
 * 순환 의존성을 방지하면서 클린한 인터페이스 제공
 */
@Injectable()
export class SubscriptionFacadeService {
  private readonly logger = new Logger(SubscriptionFacadeService.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usageService: UsageService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    private readonly tossApiClient: TossApiClient,
  ) {}

  /**
   * 내 구독 정보 조회 (구독 정보 + 사용량)
   */
  async getMySubscriptionWithUsage(userId: string) {
    const subscription =
      await this.subscriptionService.getUserSubscription(userId);
    const usage = await this.usageService.getUsageStats(userId);

    // 프론트엔드 호환성을 위한 필드 매핑
    const mappedSubscription = subscription
      ? {
          id: subscription.id,
          userId: subscription.userId,
          planId: subscription.planId,
          tier: subscription.tier,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.startDate,
          currentPeriodEnd: subscription.nextBillingDate,
          cancelledAt: subscription.canceledAt,
          cancelReason: subscription.cancelReason,
          trialEndsAt: subscription.trialEndDate,
          plan: subscription.plan,
          autoRenew: subscription.autoRenew,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        }
      : null;

    return {
      subscription: mappedSubscription,
      usage,
    };
  }

  /**
   * 체크아웃 세션 생성
   * PaymentService를 직접 의존하지 않고 이벤트로 처리
   */
  async createCheckoutSession(data: {
    userId: string;
    tier: SubscriptionTier;
    billingCycle: BillingCycle;
    provider?: string;
  }) {
    // 현재 구독 상태 확인
    const currentSubscription =
      await this.subscriptionService.getUserSubscription(data.userId);

    // 같은 플랜으로는 변경 불가
    if (currentSubscription?.tier === data.tier) {
      throw new BadRequestException("이미 동일한 플랜을 사용 중입니다");
    }

    // 다운그레이드 체크
    if (
      data.tier === SubscriptionTier.FREE ||
      data.tier === SubscriptionTier.STARTER
    ) {
      const canDowngrade = await this.subscriptionService.canDowngrade(
        data.userId,
        data.tier,
      );
      if (!canDowngrade) {
        throw new BadRequestException(
          "현재 사용량이 선택한 플랜의 제한을 초과합니다. 사용량을 줄인 후 다시 시도해주세요.",
        );
      }
    }

    // 이벤트를 통해 결제 프로세스 시작
    // PaymentService가 이 이벤트를 리스닝하여 처리
    const sessionId = `checkout_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.eventEmitter.emit("payment.checkout.requested", {
      sessionId,
      userId: data.userId,
      tier: data.tier,
      billingCycle: data.billingCycle,
      provider: data.provider || "mock",
    });

    // Mock 응답 - 프론트엔드의 mock-checkout 페이지로 리다이렉트
    // query parameter로 필요한 정보 전달
    const checkoutUrl = `http://localhost:3001/mock-checkout?session=${sessionId}&tier=${data.tier}&cycle=${data.billingCycle}`;

    return {
      checkoutUrl,
      sessionId,
    };
  }

  /**
   * 사용량 히스토리 조회
   */
  async getUsageHistory(
    userId: string,
    resourceType?: ResourceType,
    startDate?: Date,
    endDate?: Date,
  ) {
    // UsageService에서 getUsageHistory 메서드가 없으면 만들어야 함
    // 임시로 빈 배열 반환
    return [];
  }

  /**
   * 결제 히스토리 조회
   */
  async getPaymentHistory(userId: string, limit?: number) {
    return await this.paymentHistoryRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit || 10,
    });
  }

  /**
   * 결제 수단 목록 조회
   * 토스 빌링키 테이블에서 활성 카드 정보를 조회
   */
  async getPaymentMethods(userId: string) {
    const billingKeyRepo = this.paymentHistoryRepository.manager.getRepository(
      "toss_billing_keys",
    );

    const billingKeys = await billingKeyRepo.find({
      where: { userId, isActive: true },
      order: { createdAt: "DESC" },
    });

    // 프론트엔드에 필요한 필드만 반환 (billingKey 자체는 노출하지 않음)
    return billingKeys.map((bk: any) => ({
      id: bk.id,
      cardCompany: bk.cardCompany,
      cardNumber: bk.cardNumber,
      cardType: bk.cardType,
      createdAt: bk.createdAt,
    }));
  }

  /**
   * 기본 결제 수단 변경
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    this.eventEmitter.emit("payment.method.setDefault", {
      userId,
      paymentMethodId,
    });

    return { success: true };
  }

  /**
   * 환불 요청
   */
  async createRefund(
    userId: string,
    paymentId: string,
    reason: string,
    amount?: number,
  ) {
    this.eventEmitter.emit("payment.refund.requested", {
      userId,
      paymentId,
      reason,
      amount,
    });

    return {
      refundId: `refund_${Date.now()}`,
      status: "pending",
    };
  }

  /**
   * 웹훅 처리
   */
  async handleWebhook(provider: string, payload: any, signature?: string) {
    this.eventEmitter.emit("payment.webhook.received", {
      provider,
      payload,
      signature,
    });

    return { success: true };
  }

  /**
   * 사용자 구독 조회 (위임)
   */
  async getUserSubscription(userId: string) {
    return this.subscriptionService.getUserSubscription(userId);
  }

  /**
   * 구독 업데이트 (위임)
   * PaymentWebhookController 등에서 SubscriptionService를 직접 주입하지 않도록
   */
  async updateUserSubscription(
    userId: string,
    tier: SubscriptionTier,
    billingCycle?: BillingCycle,
  ) {
    return this.subscriptionService.updateUserSubscription(
      userId,
      tier,
      billingCycle,
    );
  }

  /**
   * 플랜 티어 조회 (위임)
   */
  async getPlanByTier(tier: SubscriptionTier) {
    return this.subscriptionService.getPlanByTier(tier);
  }

  /**
   * 구독 취소 (위임)
   */
  async cancelSubscription(userId: string, reason?: string) {
    return this.subscriptionService.cancelSubscription(userId, reason);
  }

  /**
   * 구독 재개 (위임)
   */
  async resumeSubscription(userId: string) {
    return this.subscriptionService.resumeSubscription(userId);
  }

  /**
   * 업그레이드 비례배분 결제
   * 기존 빌링키로 차액만 결제하고 구독 tier 즉시 변경
   */
  async chargeUpgradeProration(
    userId: string,
    currentSubscription: unknown,
    proration: {
      proratedAmount: number;
      currentPlan: { tier: string };
      newPlan: { tier: string; displayName: string };
      remainingDays: number;
    },
    newTier: SubscriptionTier,
    newBillingCycle: BillingCycle,
  ) {
    // 빌링키 조회 (PaymentModule 순환 의존 방지 — manager 활용)
    const billingKeyRepo =
      this.paymentHistoryRepository.manager.getRepository("toss_billing_keys");
    const billingKeyEntity = await billingKeyRepo.findOne({
      where: { userId, isActive: true },
      order: { createdAt: "DESC" },
    }) as { billingKey: string; customerKey: string } | null;

    if (!billingKeyEntity) {
      throw new BadRequestException("등록된 결제 수단이 없습니다. 결제 수단을 먼저 등록해주세요.");
    }

    // ── [1] Toss 빌링키로 비례배분 금액 실제 결제 ──
    const orderId = `proration_${userId.substring(0, 8)}_${Date.now()}`;
    const orderName = `업그레이드 비례배분: ${proration.currentPlan.tier} → ${proration.newPlan.displayName}`;

    const paymentResult = await this.tossApiClient.chargeBilling(
      billingKeyEntity.billingKey,
      {
        customerKey: billingKeyEntity.customerKey,
        amount: proration.proratedAmount,
        orderId,
        orderName,
        taxFreeAmount: 0,
      },
    );

    this.logger.log(
      `비례배분 결제 성공: orderId=${orderId}, paymentKey=${paymentResult.paymentKey}, amount=${proration.proratedAmount}`,
    );

    // ── [2] 결제 성공 후 구독 tier 변경 ──
    const subscription = await this.subscriptionService.updateSubscriptionTier(
      userId,
      newTier,
      newBillingCycle,
    );

    // ── [3] 결제 이력 저장 ──
    await this.paymentHistoryRepository.save(
      this.paymentHistoryRepository.create({
        userId,
        subscriptionId: subscription.id,
        amount: proration.proratedAmount,
        currency: "KRW",
        status: PaymentStatus.SUCCEEDED,
        provider: "toss",
        description: `업그레이드 비례배분: ${proration.currentPlan.tier} → ${proration.newPlan.tier} (잔여 ${proration.remainingDays}일)`,
        metadata: {
          type: "proration",
          proration,
          paymentKey: paymentResult.paymentKey,
          orderId,
          receiptUrl: paymentResult.receipt?.url,
        },
      }),
    );

    return { subscription };
  }
}
