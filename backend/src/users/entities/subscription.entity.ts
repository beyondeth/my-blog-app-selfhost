import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { User } from './user.entity';
import { SubscriptionTier, SubscriptionStatus } from '../../common/enums/subscription.enum';

/**
 * UserSubscription 엔티티 (Phase 1-2-3 리팩토링)
 *
 * **설계 원칙 (체크포인트 1):**
 * - User 테이블에서 구독/결제 관련 기본 정보만 분리
 * - Single Responsibility: 사용자 구독 상태 관리
 * - 1:1 관계로 User와 연결
 * - UUID v7 사용으로 시간순 정렬 및 구독 이력 추적 용이
 *
 * **주의:**
 * - subscription 모듈의 subscriptions 테이블과 구분하기 위해 user_subscriptions 사용
 * - 간단한 구독 상태만 관리 (tier, status 등)
 * - 복잡한 결제/플랜 정보는 subscription 모듈 사용
 *
 * **비즈니스 요구사항:**
 * - 사용자별 구독 티어 (Free, Basic, Pro)
 * - 구독 상태 관리 (Active, Canceled, Expired)
 * - Stripe 연동을 위한 최소 정보
 *
 * **확장성:**
 * - subscription 모듈과 통합 가능
 * - 구독 이력 추적 (별도 subscription_history 테이블로 확장 가능)
 */
@Entity('user_subscriptions')
@Index(['userId'], { unique: true }) // 1:1 관계 보장
@Index(['subscriptionStatus']) // 구독 상태별 조회 최적화
@Index(['subscriptionEndDate']) // 만료 예정 구독 조회 최적화
export class Subscription {
  /**
   * 기본 키 (UUID v7)
   * - 시간순 정렬로 구독 순서 파악 용이
   * - B-tree 인덱스 성능 최적화
   */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * User 관계 (1:1)
   * - onDelete: 'CASCADE' → User 삭제 시 Subscription도 자동 삭제
   * - nullable: false → User 없이 Subscription 존재 불가
   */
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  /**
   * 구독 티어
   * - FREE: 무료 (기본 기능만)
   * - BASIC: 기본 유료 (월 $9.99)
   * - PRO: 프로 (월 $29.99, 모든 기능)
   *
   * 기본값: FREE
   */
  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  /**
   * 구독 상태
   * - ACTIVE: 활성 (정상 결제 중)
   * - TRIAL: 무료 체험 중
   * - PAST_DUE: 결제 실패 (유예 기간)
   * - CANCELED: 취소됨 (기간 만료 전까지 사용 가능)
   * - EXPIRED: 만료됨 (접근 불가)
   *
   * nullable: 무료 사용자는 null
   */
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    nullable: true,
  })
  subscriptionStatus: SubscriptionStatus;

  /**
   * 구독 시작일
   * - 유료 구독 시작 시점
   * - 무료 사용자는 null
   */
  @Column({ type: 'timestamp', nullable: true })
  subscriptionStartDate: Date;

  /**
   * 구독 종료일
   * - 다음 결제 예정일 또는 구독 만료일
   * - 자동 갱신 시 매달 업데이트
   * - cancelAtPeriodEnd=true일 경우 이 날짜에 만료
   */
  @Column({ type: 'timestamp', nullable: true })
  subscriptionEndDate: Date;

  /**
   * 무료 체험 종료일
   * - 신규 가입 시 14일 무료 체험 제공
   * - 체험 종료 후 자동으로 유료 전환 또는 FREE로 다운그레이드
   */
  @Column({ type: 'timestamp', nullable: true })
  trialEndDate: Date;

  /**
   * 결제 시스템 Customer ID (범용)
   * - Stripe, Toss, PayPal 등 모든 결제 시스템 지원
   * - 미래 확장성을 위한 범용 필드
   */
  @Column({ length: 255, nullable: true })
  paymentCustomerId: string;

  /**
   * Stripe Customer ID (호환성)
   * - Stripe 전용 Customer ID
   * - 기존 코드 호환성 유지를 위해 별도 필드 유지
   * - 신규 개발에서는 paymentCustomerId 사용 권장
   */
  @Column({ length: 255, nullable: true })
  stripeCustomerId: string;

  /**
   * 결제 시스템 Subscription ID
   * - Stripe Subscription ID
   * - 구독 취소, 변경 시 필요
   */
  @Column({ length: 255, nullable: true })
  paymentSubscriptionId: string;

  /**
   * 저장된 결제 수단 ID
   * - Stripe Payment Method ID
   * - 자동 결제에 사용
   * - 카드 정보는 Stripe에 저장, ID만 보관 (PCI-DSS 준수)
   */
  @Column({ length: 255, nullable: true })
  paymentMethodId: string;

  /**
   * 기간 만료 시 취소 여부
   * - true: 현재 기간 종료 후 자동 갱신 중단
   * - false: 자동 갱신 (기본값)
   * - 사용자가 "구독 취소" 버튼 클릭 시 true 설정
   */
  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  /**
   * UUID v7 자동 생성
   */
  @BeforeInsert()
  generateUuidV7() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /**
   * 구독 활성 여부 확인
   * - 상태가 ACTIVE이고 종료일이 미래인 경우
   * - 비즈니스 로직에서 유료 기능 접근 제어에 사용
   */
  isActive(): boolean {
    return (
      this.subscriptionStatus === SubscriptionStatus.ACTIVE &&
      (!this.subscriptionEndDate || this.subscriptionEndDate > new Date())
    );
  }

  /**
   * 무료 체험 중인지 확인
   * - 상태가 TRIAL이고 체험 종료일이 미래인 경우
   */
  isInTrial(): boolean {
    return (
      this.subscriptionStatus === SubscriptionStatus.TRIAL &&
      this.trialEndDate &&
      this.trialEndDate > new Date()
    );
  }

  /**
   * 업그레이드 가능 여부
   * - PRO가 아닌 모든 티어는 업그레이드 가능
   */
  canUpgrade(): boolean {
    return this.subscriptionTier !== SubscriptionTier.PRO;
  }

  /**
   * 유료 사용자 여부
   * - FREE가 아니고 구독이 활성 상태인 경우
   */
  isPaidUser(): boolean {
    return this.subscriptionTier !== SubscriptionTier.FREE && this.isActive();
  }

  /**
   * 구독 만료 임박 여부 (7일 이내)
   * - 결제 실패 알림, 자동 갱신 안내 등에 사용
   */
  isExpiringSoon(): boolean {
    if (!this.subscriptionEndDate) return false;
    const daysUntilExpiry = Math.ceil(
      (this.subscriptionEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }

  /**
   * 공개 JSON 변환
   * - 민감정보 제외 (결제 수단 ID 등)
   */
  toPublicJSON() {
    return {
      id: this.id,
      subscriptionTier: this.subscriptionTier,
      subscriptionStatus: this.subscriptionStatus,
      subscriptionStartDate: this.subscriptionStartDate,
      subscriptionEndDate: this.subscriptionEndDate,
      trialEndDate: this.trialEndDate,
      cancelAtPeriodEnd: this.cancelAtPeriodEnd,
      isActive: this.isActive(),
      isInTrial: this.isInTrial(),
      isPaidUser: this.isPaidUser(),
      isExpiringSoon: this.isExpiringSoon(),
    };
  }
}
