import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  PaymentProvider
} from '../../common/enums/subscription.enum';

@Entity('subscriptions')
@Index(['userId'])
@Index(['status'])
@Index(['tier'])
@Index(['nextBillingDate'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  planId: string;

  @ManyToOne(() => SubscriptionPlan, { eager: true })
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE
  })
  tier: SubscriptionTier;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE
  })
  status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    nullable: true
  })
  billingCycle: BillingCycle;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEndDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextBillingDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancelReason: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ default: true })
  autoRenew: boolean;

  // Payment Provider 관련 필드
  @Column({
    type: 'enum',
    enum: PaymentProvider,
    nullable: true
  })
  paymentProvider: PaymentProvider;

  @Column({ nullable: true })
  paymentCustomerId: string; // Stripe Customer ID, Toss Customer ID 등

  @Column({ nullable: true })
  paymentSubscriptionId: string; // Provider's subscription ID

  @Column({ nullable: true })
  paymentMethodId: string; // 결제 수단 ID

  @Column({ nullable: true })
  lastPaymentDate: Date;

  @Column({ nullable: true })
  lastPaymentAmount: number;

  @Column({ default: 0 })
  failedPaymentCount: number; // 연속 결제 실패 횟수

  // 프로모션/할인 관련
  @Column({ nullable: true })
  discountCode: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercentage: number;

  @Column({ type: 'timestamp', nullable: true })
  discountEndDate: Date;

  // 메타데이터
  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Lifecycle hooks

  @BeforeInsert()
  setStartDate() {
    if (!this.startDate) {
      this.startDate = new Date();
    }
  }

  // Helper methods

  /**
   * 구독이 활성 상태인지 확인
   */
  isActive(): boolean {
    return this.status === SubscriptionStatus.ACTIVE &&
           (!this.endDate || this.endDate > new Date());
  }

  /**
   * 구독이 체험 기간인지 확인
   */
  isInTrial(): boolean {
    return this.status === SubscriptionStatus.TRIAL &&
           this.trialEndDate &&
           this.trialEndDate > new Date();
  }

  /**
   * 구독 취소 가능 여부
   */
  canCancel(): boolean {
    return this.status === SubscriptionStatus.ACTIVE || this.status === SubscriptionStatus.TRIAL;
  }

  /**
   * 업그레이드 가능 여부
   */
  canUpgrade(): boolean {
    return this.tier !== SubscriptionTier.PRO && this.isActive();
  }

  /**
   * 다운그레이드 가능 여부
   */
  canDowngrade(): boolean {
    return this.tier !== SubscriptionTier.FREE && this.isActive();
  }

  /**
   * 남은 일수 계산
   */
  getRemainingDays(): number {
    if (!this.endDate) return -1; // 무제한
    const now = new Date();
    const diff = this.endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * 체험 기간 남은 일수
   */
  getTrialRemainingDays(): number {
    if (!this.trialEndDate) return 0;
    const now = new Date();
    const diff = this.trialEndDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * 할인 적용 가격 계산
   */
  getDiscountedPrice(): number {
    if (!this.discountPercentage || !this.discountEndDate) {
      return this.price;
    }
    if (this.discountEndDate < new Date()) {
      return this.price;
    }
    return this.price * (1 - this.discountPercentage / 100);
  }
}