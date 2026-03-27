import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Job } from "bullmq";
import { TossApiClient } from "../providers/toss-api.client";
import { Subscription } from "../../subscription/entities/subscription.entity";
import { PaymentHistory } from "../../subscription/entities/payment-history.entity";
import { PaymentEvents } from "../enums/payment-events.enum";
import {
  SubscriptionStatus,
  PaymentStatus,
} from "../../common/enums/subscription.enum";
import {
  BillingChargeJobData,
  BillingSchedulerService,
} from "../services/billing-scheduler.service";

/**
 * 정기결제 BullMQ 프로세서
 *
 * billingKey로 토스페이먼츠에 결제를 실행하고
 * 성공/실패에 따라 구독 상태를 업데이트
 */
@Processor("billing")
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(
    private readonly tossApiClient: TossApiClient,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    private readonly eventEmitter: EventEmitter2,
    private readonly billingScheduler: BillingSchedulerService,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  /**
   * 결제 job 처리
   */
  async process(job: Job<BillingChargeJobData>): Promise<void> {
    const data = job.data;
    this.logger.log(
      `[Billing] 정기결제 실행: subscriptionId=${data.subscriptionId}, amount=${data.amount}`,
    );

    try {
      // 구독 상태 확인
      const subscription = await this.subscriptionRepository.findOne({
        where: { id: data.subscriptionId },
      });

      if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
        this.logger.warn(
          `[Billing] 비활성 구독 — 결제 건너뜀: ${data.subscriptionId}`,
        );
        return;
      }

      // 토스 빌링 결제 실행
      const paymentResult = await this.tossApiClient.chargeBilling(
        data.billingKey,
        {
          customerKey: data.customerKey,
          amount: data.amount,
          orderId: data.orderId,
          orderName: data.orderName,
        },
      );

      // 결제 성공 처리
      await this.handleChargeSuccess(subscription, paymentResult, data);
    } catch (error) {
      // 결제 실패 처리
      await this.handleChargeFailure(
        data,
        error instanceof Error ? error.message : "결제 실패",
        job.attemptsMade,
      );
      throw error; // BullMQ에 재시도 트리거
    }
  }

  /**
   * 결제 성공 처리
   */
  private async handleChargeSuccess(
    subscription: Subscription,
    paymentResult: any,
    data: BillingChargeJobData,
  ): Promise<void> {
    const nextBillingDate = BillingSchedulerService.calculateNextBillingDate(
      new Date(),
      subscription.billingCycle,
    );

    // 트랜잭션: PaymentHistory + 구독 업데이트를 원자적으로 처리
    await this.dataSource.transaction(async (manager) => {
      // PaymentHistory 생성 — 영수증 URL, 카드 상세, 승인일시 포함
      await manager.getRepository(PaymentHistory).save({
        userId: data.userId,
        subscriptionId: subscription.id,
        amount: data.amount,
        currency: "KRW",
        status: PaymentStatus.SUCCEEDED,
        provider: "toss",
        providerId: paymentResult.paymentKey,
        transactionId: data.orderId,
        paymentMethod: paymentResult.method || "card",
        description: data.orderName,
        receiptUrl: paymentResult.receipt?.url || null,
        metadata: {
          orderId: data.orderId,
          billingKeyId: data.billingKeyId,
          approvedAt: paymentResult.approvedAt,
          requestedAt: paymentResult.requestedAt,
          card: paymentResult.card
            ? {
                approveNo: paymentResult.card.approveNo || null,
                issuerCode: paymentResult.card.issuerCode,
                cardNumber: paymentResult.card.number || null,
                cardType: paymentResult.card.cardType,
                ownerType: paymentResult.card.ownerType || null,
                installmentPlanMonths: paymentResult.card.installmentPlanMonths || 0,
              }
            : null,
        },
      });

      // 구독 업데이트: 다음 결제일 갱신, 실패 카운트 리셋
      await manager.getRepository(Subscription).update(subscription.id, {
        lastPaymentDate: new Date(),
        lastPaymentAmount: data.amount,
        nextBillingDate,
        failedPaymentCount: 0,
      });
    });

    // 다음 결제 스케줄 등록 (트랜잭션 밖 — 실패해도 Cron 안전망이 잡아냄)
    try {
      const updatedSub = await this.subscriptionRepository.findOne({
        where: { id: subscription.id },
      });
      if (updatedSub) {
        await this.billingScheduler.scheduleNextCharge(updatedSub);
      }
    } catch (scheduleError) {
      this.logger.error(
        `[Billing] 다음 결제 스케줄 등록 실패 (Cron 안전망 대체): ${scheduleError}`,
      );
    }

    // 결제 성공 이벤트 발행
    this.eventEmitter.emit(PaymentEvents.PAYMENT_SUCCESS, {
      userId: data.userId,
      paymentId: paymentResult.paymentKey,
      amount: data.amount,
      currency: "KRW",
      provider: "toss",
      metadata: {
        subscriptionId: subscription.id,
        orderId: data.orderId,
        billingType: "recurring",
      },
      timestamp: new Date(),
    });

    this.logger.log(
      `[Billing] 정기결제 성공: subscriptionId=${subscription.id}, ` +
        `paymentKey=${paymentResult.paymentKey}, nextBilling=${nextBillingDate.toISOString()}`,
    );
  }

  /**
   * 결제 실패 처리
   */
  private async handleChargeFailure(
    data: BillingChargeJobData,
    reason: string,
    attemptsMade: number,
  ): Promise<void> {
    // 실패 카운트 원자적 증가 (동시 워커 race condition 방지)
    await this.subscriptionRepository.increment(
      { id: data.subscriptionId },
      "failedPaymentCount",
      1,
    );

    // 증가 후 현재 값 조회
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: data.subscriptionId },
    });

    if (!subscription) return;

    const updateData: Partial<Subscription> = {};

    // 3회 연속 실패 → PAST_DUE
    if (subscription.failedPaymentCount >= 3 && subscription.status !== SubscriptionStatus.PAST_DUE) {
      updateData.status = SubscriptionStatus.PAST_DUE;
      this.logger.error(
        `[Billing] 3회 연속 실패 → PAST_DUE: subscriptionId=${data.subscriptionId}`,
      );
    }

    // 7회 연속 실패 → EXPIRED (자동 취소)
    if (subscription.failedPaymentCount >= 7) {
      updateData.status = SubscriptionStatus.EXPIRED;
      updateData.canceledAt = new Date();
      updateData.cancelReason = "결제 7회 연속 실패로 자동 취소";
      this.logger.error(
        `[Billing] 7회 연속 실패 → EXPIRED: subscriptionId=${data.subscriptionId}`,
      );
    }

    if (Object.keys(updateData).length > 0) {
      await this.subscriptionRepository.update(subscription.id, updateData);
    }

    // PaymentHistory 실패 기록
    await this.paymentHistoryRepository.save({
      userId: data.userId,
      subscriptionId: subscription.id,
      amount: data.amount,
      currency: "KRW",
      status: PaymentStatus.FAILED,
      provider: "toss",
      failureReason: reason,
      description: `${data.orderName} (시도 ${attemptsMade + 1})`,
      metadata: {
        orderId: data.orderId,
        billingKeyId: data.billingKeyId,
        attemptsMade: attemptsMade + 1,
      },
    });

    // 결제 실패 이벤트 발행
    this.eventEmitter.emit(PaymentEvents.PAYMENT_FAILED, {
      userId: data.userId,
      paymentId: data.orderId,
      reason,
      provider: "toss",
      metadata: {
        subscriptionId: subscription.id,
        failedCount: subscription.failedPaymentCount,
        billingType: "recurring",
      },
      timestamp: new Date(),
    });
  }
}
