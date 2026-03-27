import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OnEvent } from "@nestjs/event-emitter";
import { Subscription } from "../../subscription/entities/subscription.entity";
import { TossBillingKey } from "../entities/toss-billing-key.entity";
import {
  SubscriptionStatus,
  BillingCycle,
} from "../../common/enums/subscription.enum";
import { PaymentEvents } from "../enums/payment-events.enum";

/**
 * 정기결제 job 데이터 인터페이스
 */
export interface BillingChargeJobData {
  subscriptionId: string;
  userId: string;
  billingKeyId: string;
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
}

/**
 * 정기결제 스케줄러
 *
 * 하이브리드 방식:
 * - BullMQ: 각 구독별 정확한 시간에 결제 job 실행 + 자동 재시도
 * - Cron (안전망): 6시간마다 누락된 결제를 잡아냄
 *
 * 토스페이먼츠는 정기결제 스케줄링을 제공하지 않으므로
 * 서버에서 직접 billingKey 기반으로 결제를 실행해야 함
 */
@Injectable()
export class BillingSchedulerService {
  private readonly logger = new Logger(BillingSchedulerService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(TossBillingKey)
    private readonly billingKeyRepository: Repository<TossBillingKey>,
    @InjectQueue("billing")
    private readonly billingQueue: Queue,
  ) {}

  /**
   * 다음 결제 job 등록
   * 구독 생성/갱신 시 호출하여 nextBillingDate에 맞춰 job 예약
   */
  async scheduleNextCharge(subscription: Subscription): Promise<void> {
    if (!subscription.nextBillingDate || !subscription.autoRenew) {
      return;
    }

    const billingKey = await this.billingKeyRepository.findOne({
      where: { userId: subscription.userId, isActive: true },
      order: { createdAt: "DESC" },
    });

    if (!billingKey) {
      this.logger.warn(
        `활성 빌링키 없음 — 정기결제 스케줄 건너뜀: userId=${subscription.userId}`,
      );
      return;
    }

    const delay = Math.max(
      0,
      subscription.nextBillingDate.getTime() - Date.now(),
    );
    const orderId = `sub_${subscription.id}_${Date.now()}`;
    const orderName = `${subscription.tier.toUpperCase()} 플랜 정기결제`;

    const jobData: BillingChargeJobData = {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      billingKeyId: billingKey.id,
      billingKey: billingKey.billingKey,
      customerKey: billingKey.customerKey,
      amount: Number(subscription.price),
      orderId,
      orderName,
    };

    // 기존 동일 구독 job이 있으면 제거 후 새로 등록
    const jobId = `billing_${subscription.id}`;
    const existingJob = await this.billingQueue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }

    await this.billingQueue.add("charge", jobData, {
      jobId,
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3600000, // 1시간 → 2시간 → 4시간 (지수 백오프)
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(
      `정기결제 예약: subscriptionId=${subscription.id}, ` +
        `delay=${Math.round(delay / 1000 / 60)}분, amount=${jobData.amount}`,
    );
  }

  /**
   * 정기결제 스케줄 취소
   * 구독 취소 시 호출
   */
  async cancelScheduledCharge(subscriptionId: string): Promise<void> {
    const jobId = `billing_${subscriptionId}`;
    const job = await this.billingQueue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`정기결제 예약 취소: subscriptionId=${subscriptionId}`);
    }
  }

  /**
   * 구독 취소 이벤트 수신 → 예약된 정기결제 Job 제거
   * SubscriptionService.cancelSubscription()에서 이벤트 발행
   */
  @OnEvent(PaymentEvents.SUBSCRIPTION_CANCELLED)
  async handleSubscriptionCancelled(payload: {
    subscriptionId: string;
    userId: string;
  }): Promise<void> {
    await this.cancelScheduledCharge(payload.subscriptionId);
    this.logger.log(
      `구독 취소 이벤트 처리 완료: subscriptionId=${payload.subscriptionId}`,
    );
  }

  /**
   * Cron 안전망: 누락된 결제 잡아냄
   * 6시간마다 실행 — nextBillingDate가 지났는데 결제가 안 된 구독 처리
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async catchMissedCharges(): Promise<void> {
    const now = new Date();

    // nextBillingDate가 지났고, 활성 상태이며, 자동갱신이 켜진 구독 조회
    // failedPaymentCount < 7인 경우만 (7회 이상은 EXPIRED 처리 대상)
    const overdueSubscriptions = await this.subscriptionRepository
      .createQueryBuilder("sub")
      .where("sub.status = :status", { status: SubscriptionStatus.ACTIVE })
      .andWhere("sub.autoRenew = true")
      .andWhere("sub.nextBillingDate <= :now", { now })
      .andWhere("sub.paymentProvider = :provider", { provider: "toss" })
      .andWhere("sub.failedPaymentCount < :maxFail", { maxFail: 7 })
      .getMany();

    if (overdueSubscriptions.length === 0) return;

    this.logger.warn(
      `[Cron 안전망] 누락된 정기결제 ${overdueSubscriptions.length}건 발견`,
    );

    for (const sub of overdueSubscriptions) {
      // 이미 BullMQ job이 있으면 건너뜀
      const jobId = `billing_${sub.id}`;
      const existingJob = await this.billingQueue.getJob(jobId);
      if (existingJob) continue;

      // 새 job 등록 (즉시 실행)
      await this.scheduleNextCharge({
        ...sub,
        nextBillingDate: new Date(), // 즉시 실행
      } as Subscription);
    }
  }

  /**
   * 다음 결제일 계산
   */
  /**
   * 다음 결제일 계산
   * 월말 클램핑: 1/31 + 1개월 = 2/28 (3/3이 아님)
   */
  static calculateNextBillingDate(
    currentDate: Date,
    billingCycle: BillingCycle,
  ): Date {
    const current = new Date(currentDate);
    const day = current.getDate();

    if (billingCycle === BillingCycle.MONTHLY) {
      // 다음 달의 마지막 날 계산 후 클램핑
      const nextMonth = current.getMonth() + 1;
      const nextYear =
        nextMonth > 11 ? current.getFullYear() + 1 : current.getFullYear();
      const normalizedMonth = nextMonth > 11 ? 0 : nextMonth;
      // 해당 월의 마지막 날
      const daysInNextMonth = new Date(
        nextYear,
        normalizedMonth + 1,
        0,
      ).getDate();
      const clampedDay = Math.min(day, daysInNextMonth);
      return new Date(nextYear, normalizedMonth, clampedDay);
    } else {
      // 연간: 윤년 대응 (2/29 → 2/28)
      const nextYear = current.getFullYear() + 1;
      const daysInMonth = new Date(
        nextYear,
        current.getMonth() + 1,
        0,
      ).getDate();
      const clampedDay = Math.min(day, daysInMonth);
      return new Date(nextYear, current.getMonth(), clampedDay);
    }
  }
}
