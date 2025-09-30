import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { PaymentHistory } from './entities/payment-history.entity';
import { User } from '../users/entities/user.entity';
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  PaymentStatus,
} from '../common/enums/subscription.enum';
import { PaymentEvents } from '../payment/enums/payment-events.enum';
import {
  PaymentSuccessPayload,
  PaymentFailedPayload,
  RefundPayload,
  SubscriptionCancelledPayload,
} from '../payment/interfaces/payment-event-payloads.interface';

@Injectable()
export class SubscriptionService {
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
  ) {}

  /**
   * 사용 가능한 구독 플랜 목록 조회
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    return await this.subscriptionPlanRepository.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * 다운그레이드 가능 여부 확인
   */
  async canDowngrade(userId: string, targetTier: SubscriptionTier): Promise<boolean> {
    const currentSubscription = await this.getUserSubscription(userId);

    // Free 플랜으로는 항상 다운그레이드 가능
    if (targetTier === SubscriptionTier.FREE) {
      return true;
    }

    // 현재 플랜보다 낮은 티어인지 확인
    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PRO]: 2,
    };

    return tierOrder[targetTier] < tierOrder[currentSubscription.tier];
  }

  /**
   * 업그레이드 시뮬레이션
   */
  async simulateUpgrade(
    userId: string,
    targetTier: SubscriptionTier,
    billingCycle: BillingCycle
  ) {
    const currentSubscription = await this.getUserSubscription(userId);
    const targetPlan = await this.subscriptionPlanRepository.findOne({
      where: { tier: targetTier },
    });

    if (!targetPlan) {
      throw new NotFoundException('Target plan not found');
    }

    // 비례 배분 계산 등
    const proratedAmount = this.calculateProratedAmount(
      currentSubscription,
      targetPlan,
      billingCycle
    );

    return {
      currentTier: currentSubscription.tier,
      targetTier,
      billingCycle,
      proratedAmount,
      nextBillingDate: this.calculateNextBillingDate(billingCycle),
    };
  }

  /**
   * 비례 배분 금액 계산
   */
  private calculateProratedAmount(
    currentSubscription: Subscription,
    targetPlan: SubscriptionPlan,
    billingCycle: BillingCycle
  ): number {
    // 간단한 구현 - 실제로는 더 복잡한 로직 필요
    if (billingCycle === BillingCycle.MONTHLY) {
      return targetPlan.getMonthlyPrice() || 0;
    } else {
      return targetPlan.getYearlyPrice() || 0;
    }
  }


  /**
   * 사용자의 현재 구독 정보 조회
   */
  async getUserSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
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
      throw new NotFoundException('Free 플랜을 찾을 수 없습니다');
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

    // User 엔티티도 업데이트
    await this.userRepository.update(userId, {
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionStartDate: new Date(),
    });

    return subscription;
  }

  /**
   * 결제 세션 생성 (Checkout)
   */
  async createCheckoutSession(userId: string, planId: string, billingCycle: BillingCycle) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('플랜을 찾을 수 없습니다');
    }

    if (!plan.isActive) {
      throw new BadRequestException('선택한 플랜은 현재 이용할 수 없습니다');
    }

    // 다운그레이드 체크 - Mock 환경에서는 모든 플랜 변경 허용
    const currentSubscription = await this.getUserSubscription(userId);
    // Mock 환경에서는 다운그레이드 체크 생략 (개발/테스트 목적)
    // 실제 프로덕션에서는 결제 시스템과 연동하여 처리
    // if (this.isDowngrade(currentSubscription.tier, plan.tier)) {
    //   throw new BadRequestException(
    //     '다운그레이드는 현재 결제 주기가 끝난 후에만 가능합니다'
    //   );
    // }

    // 가격 계산
    const price = billingCycle === BillingCycle.YEARLY
      ? plan.pricing.yearly
      : plan.pricing.monthly;

    // 결제 세션 생성 (Payment Provider 통해)
    // Mock 체크아웃 세션 생성 - 실제로는 결제 페이지로 이동
    const sessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const session = {
      url: `http://localhost:3001/mock-checkout?session=${sessionId}&tier=${plan.tier}&cycle=${billingCycle}`,
      id: sessionId,
    };
    /* 실제 결제 서비스 연동 시:
    const session = await this.paymentService.createCheckoutSession({
      customerId: user.paymentCustomerId,
      priceAmount: price,
      currency: plan.pricing.currency,
      productName: plan.displayName || plan.name,
      billingCycle,
      metadata: {
        userId,
        planId,
        tier: plan.tier,
      },
    });
    */

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
        throw new NotFoundException('플랜을 찾을 수 없습니다');
      }

      const currentSubscription = await this.getUserSubscription(userId);

      // 업그레이드 가능 여부 확인
      if (!this.isUpgrade(currentSubscription.tier, newPlan.tier)) {
        throw new BadRequestException('업그레이드가 아닙니다');
      }

      // 새 구독 생성
      const newSubscription = this.subscriptionRepository.create({
        userId,
        planId: newPlan.id,
        plan: newPlan,
        tier: newPlan.tier,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        price: billingCycle === BillingCycle.YEARLY
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

      // User 엔티티 업데이트
      await queryRunner.manager.update(User, userId, {
        subscriptionTier: newPlan.tier,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionStartDate: new Date(),
      });

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
  async cancelSubscription(userId: string, reason?: string): Promise<Subscription> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription.canCancel()) {
      throw new BadRequestException('이 구독은 취소할 수 없습니다');
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

    // User 엔티티 업데이트
    await this.userRepository.update(userId, {
      subscriptionStatus: SubscriptionStatus.CANCELED,
    });

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
      relations: ['plan'],
    });

    // 새로운 플랜 가져오기
    const newPlan = await this.getPlanByTier(tier);

    if (subscription) {
      // 기존 구독 업데이트
      subscription.planId = newPlan.id;
      subscription.plan = newPlan;  // plan 관계도 업데이트
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
      subscription.nextBillingDate = billingDate;  // 다음 결제일 추가

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
        plan: newPlan,  // plan 관계도 설정
        tier,
        billingCycle,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        startDate: new Date(),
        endDate: billingDate,
        nextBillingDate: billingDate,  // 다음 결제일 추가
      });
    }

    await this.subscriptionRepository.save(subscription);

    // User 엔티티 업데이트
    // userId가 유효한지 확인
    if (!userId) {
      throw new BadRequestException('유효하지 않은 사용자 ID입니다');
    }

    await this.userRepository.update(
      { id: userId },  // where 조건을 명시적으로 지정
      {
        subscriptionTier: tier,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      }
    );

    // 결제 이력 추가
    const paymentHistory = this.paymentHistoryRepository.create({
      user: { id: userId } as User,  // userId 대신 user 관계 설정
      subscription: { id: subscription.id } as Subscription,  // subscriptionId 대신 subscription 관계
      amount: billingCycle === BillingCycle.MONTHLY
        ? newPlan.getMonthlyPrice()  // 메서드 호출
        : newPlan.getYearlyPrice(),   // 메서드 호출
      currency: 'KRW',
      status: PaymentStatus.SUCCEEDED,
      provider: 'mock',
      providerId: `mock_${Date.now()}`,
      createdAt: new Date(),  // paidAt 대신 createdAt 사용
    });
    await this.paymentHistoryRepository.save(paymentHistory);

    // 구독 변경 이벤트 발생 (UsageService 캐시 무효화)
    this.eventEmitter.emit('subscription.updated', {
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
      throw new BadRequestException('취소된 구독만 재개할 수 있습니다');
    }

    if (subscription.endDate && subscription.endDate < new Date()) {
      throw new BadRequestException('만료된 구독은 재개할 수 없습니다. 새로 구독해주세요.');
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

    // User 엔티티 업데이트
    await this.userRepository.update(userId, {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    });

    return subscription;
  }

  /**
   * 결제 이력 조회
   */
  async getPaymentHistory(userId: string, limit = 10): Promise<PaymentHistory[]> {
    return this.paymentHistoryRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 모든 구독 플랜 조회
   */
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlanRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
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
  async handleWebhook(event: any): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data);
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

    // User 엔티티 업데이트
    await this.userRepository.update(userId, {
      subscriptionTier: tier,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      paymentCustomerId: data.customer,
      paymentSubscriptionId: data.subscription,
    });

    // 결제 이력 저장
    await this.paymentHistoryRepository.save({
      userId,
      subscriptionId: subscription.id,
      amount: data.amount_total / 100, // cents to dollars
      currency: data.currency,
      status: PaymentStatus.SUCCEEDED,
      paymentProvider: 'stripe',
      transactionId: data.payment_intent,
    });
  }

  private async handleSubscriptionUpdated(data: any): Promise<void> {
    // 구독 업데이트 처리
  }

  private async handleSubscriptionDeleted(data: any): Promise<void> {
    // 구독 삭제 처리
  }


  // Helper methods

  private isUpgrade(current: SubscriptionTier, target: SubscriptionTier): boolean {
    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PRO]: 2,
    };
    return tierOrder[target] > tierOrder[current];
  }

  private isDowngrade(current: SubscriptionTier, target: SubscriptionTier): boolean {
    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PRO]: 2,
    };
    return tierOrder[target] < tierOrder[current];
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
    console.log(`[SubscriptionService] Payment success event received for user ${payload.userId}`);

    const { userId, metadata } = payload;
    const { tier, billingCycle, paymentIntentId, subscriptionId } = metadata;

    if (!tier || !billingCycle) {
      console.warn('[SubscriptionService] Payment success event missing tier or billing cycle');
      return;
    }

    // 결제 처리 로직을 여기서 직접 실행
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { tier },
    });

    if (!plan) {
      console.error(`[SubscriptionService] Plan not found for tier: ${tier}`);
      return;
    }

    // 기존 구독 종료 처리
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { userId: userId.toString(), status: SubscriptionStatus.ACTIVE },
    });

    if (existingSubscription) {
      existingSubscription.status = SubscriptionStatus.CANCELED;
      existingSubscription.endDate = new Date();
      await this.subscriptionRepository.save(existingSubscription);
    }

    // 새로운 구독 생성
    const subscription = this.subscriptionRepository.create({
      userId: userId.toString(),
      planId: plan.id,
      plan,
      tier,
      status: SubscriptionStatus.ACTIVE,
      billingCycle,
      price: billingCycle === BillingCycle.YEARLY ? plan.pricing.yearly : plan.pricing.monthly,
      currency: plan.pricing.currency,
      startDate: new Date(),
      nextBillingDate: this.calculateNextBillingDate(billingCycle),
      paymentSubscriptionId: subscriptionId,
      autoRenew: true,
    });

    await this.subscriptionRepository.save(subscription);

    // User 엔티티 업데이트
    await this.userRepository.update(userId, {
      subscriptionTier: tier,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionStartDate: new Date(),
    });
  }

  /**
   * 환불 성공 이벤트 처리
   * 전액 환불 시 구독 즉시 취소
   */
  @OnEvent(PaymentEvents.REFUND_SUCCESS)
  async handleRefundSuccess(payload: RefundPayload) {
    console.log(`[SubscriptionService] Refund success event received for user ${payload.userId}`);

    // 전액 환불인 경우 구독 취소
    if (payload.status === 'success') {
      await this.cancelSubscription(payload.userId.toString(), 'Full refund received');
    }
  }

  /**
   * 구독 취소 이벤트 처리
   * 외부 결제 서비스에서 구독이 취소된 경우
   */
  @OnEvent(PaymentEvents.SUBSCRIPTION_CANCELLED)
  async handleSubscriptionCancelled(payload: SubscriptionCancelledPayload) {
    console.log(`[SubscriptionService] Subscription cancelled event received for user ${payload.userId}`);

    await this.cancelSubscription(
      payload.userId.toString(),
      payload.reason || 'Subscription cancelled by payment provider'
    );
  }

  /**
   * 결제 실패 이벤트 처리
   * 로깅 및 알림 처리
   */
  @OnEvent(PaymentEvents.PAYMENT_FAILED)
  async handlePaymentFailed(payload: PaymentFailedPayload) {
    console.log(`[SubscriptionService] Payment failed for user ${payload.userId}: ${payload.reason}`);

    // 여기서 사용자에게 알림을 보내거나 추가 처리를 할 수 있습니다
    // 예: 이메일 알림, 재시도 스케줄링 등
  }
}