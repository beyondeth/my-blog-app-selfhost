import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SubscriptionService } from "../subscription/subscription.service";
import { UsageService } from "../usage/usage.service";
import { PaymentHistory } from "../subscription/entities/payment-history.entity";
import {
  SubscriptionTier,
  BillingCycle,
  ResourceType,
} from "../common/enums/subscription.enum";

/**
 * 구독 Facade 서비스
 * 구독, 결제, 사용량 관련 서비스들을 통합 관리
 * 순환 의존성을 방지하면서 클린한 인터페이스 제공
 */
@Injectable()
export class SubscriptionFacadeService {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usageService: UsageService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
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
      throw new Error("이미 동일한 플랜을 사용 중입니다");
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
        throw new Error(
          "현재 사용량이 선택한 플랜의 제한을 초과합니다. " +
            "사용량을 줄인 후 다시 시도해주세요.",
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
   * 실제로는 PaymentService에서 처리하지만, 이벤트로 요청
   */
  async getPaymentMethods(userId: string) {
    // 이벤트를 통한 비동기 요청 또는 Mock 데이터 반환
    return [];
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
   * 업그레이드 시뮬레이션
   */
  async simulateUpgrade(
    userId: string,
    tier: SubscriptionTier,
    billingCycle: BillingCycle,
  ) {
    const currentSubscription =
      await this.subscriptionService.getUserSubscription(userId);
    const targetPlan = await this.subscriptionService.getPlanByTier(tier);

    if (!targetPlan) {
      throw new Error("플랜을 찾을 수 없습니다");
    }

    // 시뮬레이션 결과 계산
    const monthlyPrice = targetPlan.getMonthlyPrice();
    const yearlyPrice = targetPlan.getYearlyPrice();
    const selectedPrice =
      billingCycle === BillingCycle.MONTHLY ? monthlyPrice : yearlyPrice;

    return {
      currentTier: currentSubscription?.tier || SubscriptionTier.FREE,
      targetTier: tier,
      billingCycle,
      price: selectedPrice,
      features: targetPlan.features,
      changeDate: new Date(),
    };
  }

  /**
   * 웹훅 처리
   */
  async handleWebhook(provider: string, payload: any, signature?: string) {
    // 웹훅 처리를 이벤트로 전달
    this.eventEmitter.emit("payment.webhook.received", {
      provider,
      payload,
      signature,
    });

    return { success: true };
  }
}
