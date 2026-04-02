import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { OnEvent, EventEmitter2 } from "@nestjs/event-emitter";
import { Subscription } from "./entities/subscription.entity";
import { SubscriptionPlan } from "./entities/subscription-plan.entity";
import { PaymentHistory } from "./entities/payment-history.entity";
import { User } from "../users/entities/user.entity";
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  PaymentStatus,
} from "../common/enums/subscription.enum";
import { PaymentEvents } from "../payment/enums/payment-events.enum";
import {
  PaymentSuccessPayload,
  PaymentFailedPayload,
  RefundPayload,
  SubscriptionCancelledPayload,
} from "../payment/interfaces/payment-event-payloads.interface";
import { SubscriptionPlanSeeder } from "./seeders/subscription-plan.seeder";

/** 티어 비교용 순서 맵 (중복 정의 방지) */
const TIER_ORDER: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.STARTER]: 1,
  [SubscriptionTier.PRO]: 2,
};

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private subscriptionPlanRepository: Repository<SubscriptionPlan>,
    @InjectRepository(PaymentHistory)
    private paymentHistoryRepository: Repository<PaymentHistory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private readonly planSeeder: SubscriptionPlanSeeder,
  ) {}

  async onModuleInit() {
    await this.planSeeder.seed();
  }

  /**
   * 사용 가능한 구독 플랜 목록 조회
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    return await this.subscriptionPlanRepository.find({
      order: { name: "ASC" },
    });
  }

  /**
   * 구독 엔티티 직접 저장 (metadata 업데이트 등)
   */
  async saveSubscription(subscription: Subscription): Promise<Subscription> {
    return this.subscriptionRepository.save(subscription);
  }

  /**
   * 비례배분(Proration) 계산
   * 업그레이드 시 잔여 기간에 대한 차액을 계산
   *
   * 공식:
   *   잔여일수 = endDate - today
   *   기존 잔여가치 = 기존플랜가격 × (잔여일수 / 총일수)
   *   새 잔여가치 = 새플랜가격 × (잔여일수 / 총일수)
   *   차액 = max(새 잔여가치 - 기존 잔여가치, 0)
   */
  async calculateProration(
    subscription: Subscription,
    newTier: SubscriptionTier,
    newBillingCycle?: BillingCycle,
  ) {
    const newPlan = await this.getPlanByTier(newTier);
    const cycle = newBillingCycle || subscription.billingCycle || BillingCycle.MONTHLY;

    // 현재 플랜 가격
    const currentPrice = subscription.price
      || (subscription.billingCycle === BillingCycle.YEARLY
        ? subscription.plan?.pricing?.yearly
        : subscription.plan?.pricing?.monthly)
      || 0;

    // 새 플랜 가격
    const newPrice = cycle === BillingCycle.YEARLY
      ? (newPlan.pricing?.yearly || 0)
      : (newPlan.pricing?.monthly || 0);

    // 잔여일수 계산
    const now = new Date();
    const startDate = subscription.startDate ? new Date(subscription.startDate) : now;
    const endDate = subscription.endDate
      ? new Date(subscription.endDate)
      : subscription.nextBillingDate
        ? new Date(subscription.nextBillingDate)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const totalMs = endDate.getTime() - startDate.getTime();
    const remainingMs = Math.max(endDate.getTime() - now.getTime(), 0);
    const totalDays = Math.max(Math.ceil(totalMs / (24 * 60 * 60 * 1000)), 1);
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    const ratio = remainingDays / totalDays;

    // 비례배분 금액 (원 단위 반올림)
    const currentRemainingValue = Math.round(currentPrice * ratio);
    const newRemainingValue = Math.round(newPrice * ratio);
    const proratedAmount = Math.max(newRemainingValue - currentRemainingValue, 0);

    return {
      currentPlan: {
        tier: subscription.tier,
        price: currentPrice,
        remainingValue: currentRemainingValue,
      },
      newPlan: {
        tier: newTier,
        price: newPrice,
        remainingValue: newRemainingValue,
        displayName: newPlan.displayName || newPlan.name,
      },
      proratedAmount,
      remainingDays,
      totalDays,
      billingCycle: cycle,
    };
  }

  /**
   * 구독 tier만 즉시 변경 (업그레이드 비례배분 시 사용)
   * endDate/nextBillingDate는 유지 — 다음 정기결제 시 새 플랜 가격으로 청구
   */
  async updateSubscriptionTier(
    userId: string,
    newTier: SubscriptionTier,
    newBillingCycle?: BillingCycle,
  ): Promise<Subscription> {
    const subscription = await this.getUserSubscription(userId);
    const newPlan = await this.getPlanByTier(newTier);

    subscription.planId = newPlan.id;
    subscription.plan = newPlan;
    subscription.tier = newTier;
    if (newBillingCycle) {
      subscription.billingCycle = newBillingCycle;
    }
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.autoRenew = true;
    subscription.canceledAt = null;
    subscription.cancelReason = null;

    // endDate와 nextBillingDate는 유지 — 기존 결제 주기 끝까지 동일
    // 다음 정기결제 시 BillingProcessor가 새 플랜 가격으로 청구

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * 다운그레이드 가능 여부 확인
   */
  async canDowngrade(
    userId: string,
    targetTier: SubscriptionTier,
  ): Promise<boolean> {
    const currentSubscription = await this.getUserSubscription(userId);

    // Free 플랜으로는 항상 다운그레이드 가능
    if (targetTier === SubscriptionTier.FREE) {
      return true;
    }

    // 현재 플랜보다 낮은 티어인지 확인
    return TIER_ORDER[targetTier] < TIER_ORDER[currentSubscription.tier];
  }

  /**
   * 업그레이드 시뮬레이션
   */
  async simulateUpgrade(
    userId: string,
    targetTier: SubscriptionTier,
    billingCycle: BillingCycle,
  ) {
    const currentSubscription = await this.getUserSubscription(userId);
    const targetPlan = await this.subscriptionPlanRepository.findOne({
      where: { tier: targetTier },
    });

    if (!targetPlan) {
      throw new NotFoundException("Target plan not found");
    }

    // 올바른 비례배분 계산 사용 (calculateProration은 차액만 반환)
    const proration = await this.calculateProration(
      currentSubscription,
      targetTier,
      billingCycle,
    );

    return {
      currentTier: currentSubscription.tier,
      targetTier,
      billingCycle,
      proratedAmount: proration.proratedAmount,
      proration,
      nextBillingDate: this.calculateNextBillingDate(billingCycle),
    };
  }

  /**
   * 사용자의 현재 구독 정보 조회
   */
  async getUserSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId },
      relations: ["plan"],
      order: { createdAt: "DESC" },
    });

    if (!subscription) {
      // 구독이 없으면 Free 플랜 생성
      return this.createFreeSubscription(userId);
    }

    return subscription;
  }

  /**
   * Free 구독 생성 (신규 사용자용)
   */
  async createFreeSubscription(userId: string): Promise<Subscription> {
    const freePlan = await this.subscriptionPlanRepository.findOne({
      where: { tier: SubscriptionTier.FREE },
    });

    if (!freePlan) {
      throw new NotFoundException("Free 플랜을 찾을 수 없습니다");
    }

    const subscription = this.subscriptionRepository.create({
      userId,
      planId: freePlan.id,
      plan: freePlan,
      tier: SubscriptionTier.FREE,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
    });

    await this.subscriptionRepository.save(subscription);

    return subscription;
  }

  /**
   * 결제 세션 생성 (Checkout)
   */
  async createCheckoutSession(
    userId: string,
    planId: string,
    billingCycle: BillingCycle,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException("플랜을 찾을 수 없습니다");
    }

    if (!plan.isActive) {
      throw new BadRequestException("선택한 플랜은 현재 이용할 수 없습니다");
    }

    // 다운그레이드 체크는 Toss 결제 경로(SubscriptionController.upgradeSubscription)에서 처리

    // 가격 계산
    const price =
      billingCycle === BillingCycle.YEARLY
        ? plan.pricing.yearly
        : plan.pricing.monthly;

    // 결제 세션 생성 (Payment Provider 통해)
    // Mock 체크아웃 세션 생성 - 실제로는 결제 페이지로 이동
    const sessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const session = {
      url: `http://localhost:3001/mock-checkout?session=${sessionId}&tier=${plan.tier}&cycle=${billingCycle}`,
      id: sessionId,
    };

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * 구독 업그레이드
   */
  async upgradeSubscription(
    userId: string,
    newPlanId: string,
    billingCycle: BillingCycle,
  ): Promise<Subscription> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      const newPlan = await this.subscriptionPlanRepository.findOne({
        where: { id: newPlanId },
      });

      if (!newPlan) {
        throw new NotFoundException("플랜을 찾을 수 없습니다");
      }

      const currentSubscription = await this.getUserSubscription(userId);

      // 업그레이드 가능 여부 확인
      if (!this.isUpgrade(currentSubscription.tier, newPlan.tier)) {
        throw new BadRequestException("업그레이드가 아닙니다");
      }

      // 새 구독 생성
      const newSubscription = this.subscriptionRepository.create({
        userId,
        planId: newPlan.id,
        plan: newPlan,
        tier: newPlan.tier,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        price:
          billingCycle === BillingCycle.YEARLY
            ? newPlan.pricing.yearly
            : newPlan.pricing.monthly,
        currency: newPlan.pricing.currency,
        startDate: new Date(),
        nextBillingDate: this.calculateNextBillingDate(billingCycle),
      });

      await queryRunner.manager.save(newSubscription);

      // 기존 구독 종료
      currentSubscription.status = SubscriptionStatus.CANCELED;
      currentSubscription.endDate = new Date();
      await queryRunner.manager.save(currentSubscription);

      await queryRunner.commitTransaction();
      return newSubscription;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 구독 취소
   */
  async cancelSubscription(
    userId: string,
    reason?: string,
  ): Promise<Subscription> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription.canCancel()) {
      throw new BadRequestException("이 구독은 취소할 수 없습니다");
    }

    // 결제 시스템에서 구독 취소
    // TODO: 실제 결제 서비스 연동 시 구현
    /*
    if (subscription.paymentSubscriptionId) {
      await this.paymentService.cancelSubscription(subscription.paymentSubscriptionId);
    }
    */

    // 구독 상태 업데이트
    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceledAt = new Date();
    subscription.cancelReason = reason;
    subscription.autoRenew = false;

    await this.subscriptionRepository.save(subscription);

    // 예약된 정기결제 스케줄 취소 이벤트 발행
    // BillingSchedulerService가 이 이벤트를 수신하여 BullMQ 큐에서 Job 제거
    this.eventEmitter.emit(PaymentEvents.SUBSCRIPTION_CANCELLED, {
      userId,
      subscriptionId: subscription.id,
    });

    this.logger.log(
      `구독 취소 완료: subscriptionId=${subscription.id}, autoRenew=false, 결제 스케줄 취소 이벤트 발행`,
    );

    return subscription;
  }

  /**
   * 사용자 구독 업데이트 (Mock 결제 완료 시 사용)
   * 새로운 플랜으로 구독을 생성하거나 업데이트
   */
  async updateUserSubscription(
    userId: string,
    tier: SubscriptionTier,
    billingCycle: BillingCycle,
  ): Promise<Subscription> {
    // 기존 구독 확인
    let subscription = await this.subscriptionRepository.findOne({
      where: { userId },
      relations: ["plan"],
      order: { createdAt: "DESC" },
    });

    // 새로운 플랜 가져오기
    const newPlan = await this.getPlanByTier(tier);

    if (subscription) {
      // 기존 구독 업데이트
      subscription.planId = newPlan.id;
      subscription.plan = newPlan; // plan 관계도 업데이트
      subscription.tier = tier;
      subscription.billingCycle = billingCycle;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.autoRenew = true;
      subscription.startDate = new Date();

      // 종료일과 다음 결제일 계산 (월간: 30일, 연간: 365일)
      const billingDate = new Date();
      if (billingCycle === BillingCycle.MONTHLY) {
        billingDate.setMonth(billingDate.getMonth() + 1);
      } else {
        billingDate.setFullYear(billingDate.getFullYear() + 1);
      }
      subscription.endDate = billingDate;
      subscription.nextBillingDate = billingDate; // 다음 결제일 추가

      subscription.canceledAt = null;
      subscription.cancelReason = null;
    } else {
      // 새로운 구독 생성
      const billingDate = new Date();
      if (billingCycle === BillingCycle.MONTHLY) {
        billingDate.setMonth(billingDate.getMonth() + 1);
      } else {
        billingDate.setFullYear(billingDate.getFullYear() + 1);
      }

      subscription = this.subscriptionRepository.create({
        userId,
        planId: newPlan.id,
        plan: newPlan, // plan 관계도 설정
        tier,
        billingCycle,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        startDate: new Date(),
        endDate: billingDate,
        nextBillingDate: billingDate, // 다음 결제일 추가
      });
    }

    await this.subscriptionRepository.save(subscription);

    // 결제 이력 추가
    const paymentHistory = this.paymentHistoryRepository.create({
      user: { id: userId } as User, // userId 대신 user 관계 설정
      subscription: { id: subscription.id } as Subscription, // subscriptionId 대신 subscription 관계
      amount:
        billingCycle === BillingCycle.MONTHLY
          ? newPlan.getMonthlyPrice() // 메서드 호출
          : newPlan.getYearlyPrice(), // 메서드 호출
      currency: "KRW",
      status: PaymentStatus.SUCCEEDED,
      provider: "mock",
      providerId: `mock_${Date.now()}`,
      createdAt: new Date(), // paidAt 대신 createdAt 사용
    });
    await this.paymentHistoryRepository.save(paymentHistory);

    // 구독 변경 이벤트 발생 (UsageService 캐시 무효화)
    this.eventEmitter.emit(PaymentEvents.SUBSCRIPTION_UPDATED, {
      userId,
      tier,
    });

    return subscription;
  }

  /**
   * 구독 재개
   */
  async resumeSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.getUserSubscription(userId);

    if (subscription.status !== SubscriptionStatus.CANCELED) {
      throw new BadRequestException("취소된 구독만 재개할 수 있습니다");
    }

    if (subscription.endDate && subscription.endDate < new Date()) {
      throw new BadRequestException(
        "만료된 구독은 재개할 수 없습니다. 새로 구독해주세요.",
      );
    }

    // 결제 시스템에서 구독 재개
    // TODO: 실제 결제 서비스 연동 시 구현
    /*
    if (subscription.paymentSubscriptionId) {
      await this.paymentService.resumeSubscription(subscription.paymentSubscriptionId);
    }
    */

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.autoRenew = true;
    subscription.canceledAt = null;
    subscription.cancelReason = null;

    await this.subscriptionRepository.save(subscription);

    return subscription;
  }

  /**
   * 결제 이력 조회
   */
  async getPaymentHistory(
    userId: string,
    limit = 10,
  ): Promise<PaymentHistory[]> {
    return this.paymentHistoryRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  /**
   * 모든 구독 플랜 조회
   */
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlanRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC" },
    });
  }

  /**
   * 특정 플랜 조회
   */
  async getPlanByTier(tier: SubscriptionTier): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { tier, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException(`${tier} 플랜을 찾을 수 없습니다`);
    }

    return plan;
  }

  /**
   * Webhook 처리
   */
  async handleWebhook(event: { type: string; data: Record<string, unknown> }): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(event.data);
        break;
    }
  }

  private async handleCheckoutCompleted(data: any): Promise<void> {
    const { userId, planId, tier } = data.metadata;

    // 구독 활성화
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId },
    });

    const subscription = this.subscriptionRepository.create({
      userId,
      planId,
      plan,
      tier,
      status: SubscriptionStatus.ACTIVE,
      paymentCustomerId: data.customer,
      paymentSubscriptionId: data.subscription,
      startDate: new Date(),
      nextBillingDate: new Date(data.current_period_end * 1000),
    });

    await this.subscriptionRepository.save(subscription);

    // 결제 이력 저장
    await this.paymentHistoryRepository.save({
      userId,
      subscriptionId: subscription.id,
      amount: data.amount_total, // KRW은 zero-decimal 통화 (분할 불필요)
      currency: data.currency || "KRW",
      status: PaymentStatus.SUCCEEDED,
      paymentProvider: "toss",
      transactionId: data.payment_intent,
    });
  }

  // handleSubscriptionUpdated / handleSubscriptionDeleted: 미사용 Stripe 스텁 제거 (dead code)

  // Helper methods

  private isUpgrade(
    current: SubscriptionTier,
    target: SubscriptionTier,
  ): boolean {
    return TIER_ORDER[target] > TIER_ORDER[current];
  }

  private isDowngrade(
    current: SubscriptionTier,
    target: SubscriptionTier,
  ): boolean {
    return TIER_ORDER[target] < TIER_ORDER[current];
  }

  private calculateNextBillingDate(billingCycle: BillingCycle): Date {
    const date = new Date();
    if (billingCycle === BillingCycle.YEARLY) {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date;
  }

  /**
   * 결제 성공 이벤트 처리
   * PaymentService에서 발행한 이벤트를 받아 구독 활성화
   */
  @OnEvent(PaymentEvents.PAYMENT_SUCCESS)
  async handlePaymentSuccess(payload: PaymentSuccessPayload) {
    this.logger.log(
      `[SubscriptionService] Payment success event received for user ${payload.userId}`,
    );

    const { userId, metadata } = payload;
    const { tier, billingCycle, paymentIntentId, subscriptionId } = metadata;

    if (!tier || !billingCycle) {
      this.logger.warn(
        "[SubscriptionService] Payment success event missing tier or billing cycle",
      );
      return;
    }

    // 결제 처리 로직 — 트랜잭션으로 원자성 보장
    // 기존 구독 종료 + 새 구독 생성이 분리되면 중간 크래시 시 무구독 상태 발생
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { tier },
    });

    if (!plan) {
      this.logger.error(
        `[SubscriptionService] Plan not found for tier: ${tier}`,
      );
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      // 기존 구독 종료 처리
      const existingSubscription = await manager.findOne(Subscription, {
        where: { userId: userId.toString(), status: SubscriptionStatus.ACTIVE },
      });

      if (existingSubscription) {
        existingSubscription.status = SubscriptionStatus.CANCELED;
        existingSubscription.endDate = new Date();
        await manager.save(Subscription, existingSubscription);
      }

      // 새로운 구독 생성
      const subscription = manager.create(Subscription, {
        userId: userId.toString(),
        planId: plan.id,
        plan,
        tier,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        price:
          billingCycle === BillingCycle.YEARLY
            ? plan.pricing.yearly
            : plan.pricing.monthly,
        currency: plan.pricing.currency,
        startDate: new Date(),
        nextBillingDate: this.calculateNextBillingDate(billingCycle),
        paymentSubscriptionId: subscriptionId,
        autoRenew: true,
      });

      await manager.save(Subscription, subscription);
    });
  }

  /**
   * 환불 성공 이벤트 처리
   * 전액 환불 시 구독 즉시 취소
   */
  @OnEvent(PaymentEvents.REFUND_SUCCESS)
  async handleRefundSuccess(payload: RefundPayload) {
    this.logger.log(
      `[SubscriptionService] Refund success event received for user ${payload.userId}`,
    );

    // 전액 환불인 경우 구독 취소
    if (payload.status === "success") {
      await this.cancelSubscription(
        payload.userId.toString(),
        "Full refund received",
      );
    }
  }

  /**
   * 구독 취소 이벤트 처리
   * 외부 결제 서비스에서 구독이 취소된 경우
   * 주의: cancelSubscription()을 호출하면 동일 이벤트가 재발행되어 무한 루프 발생
   *       → 직접 상태 변경만 수행
   */
  @OnEvent(PaymentEvents.SUBSCRIPTION_CANCELLED)
  async handleSubscriptionCancelled(payload: SubscriptionCancelledPayload) {
    this.logger.log(
      `[SubscriptionService] Subscription cancelled event received for user ${payload.userId}`,
    );

    // cancelSubscription() 대신 직접 상태 변경 (이벤트 재발행 방지)
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        userId: payload.userId.toString(),
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      this.logger.warn(
        `[SubscriptionService] 취소할 활성 구독 없음: userId=${payload.userId}`,
      );
      return;
    }

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceledAt = new Date();
    subscription.cancelReason =
      payload.reason || "Subscription cancelled by payment provider";
    subscription.autoRenew = false;

    await this.subscriptionRepository.save(subscription);
    this.logger.log(
      `[SubscriptionService] 외부 취소 처리 완료: subscriptionId=${subscription.id}`,
    );
  }

  /**
   * 결제 실패 이벤트 처리
   * 로깅 및 알림 처리
   */
  @OnEvent(PaymentEvents.PAYMENT_FAILED)
  async handlePaymentFailed(payload: PaymentFailedPayload) {
    this.logger.log(
      `[SubscriptionService] Payment failed for user ${payload.userId}: ${payload.reason}`,
    );

    // 여기서 사용자에게 알림을 보내거나 추가 처리를 할 수 있습니다
    // 예: 이메일 알림, 재시도 스케줄링 등
  }
}
