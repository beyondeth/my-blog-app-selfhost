import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ResourceType } from '../../common/enums/subscription.enum';

@Entity('usage_tracking')
@Unique(['userId', 'resourceType', 'period']) // 사용자-리소스-기간별 유니크
@Index(['userId'])
@Index(['period'])
@Index(['resourceType'])
export class UsageTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: ResourceType
  })
  resourceType: ResourceType;

  @Column({ type: 'integer', default: 0 })
  count: number; // 현재 사용량

  @Column({ type: 'integer', default: 0 })
  limit: number; // 제한 수량 (-1 = 무제한)

  @Column({ type: 'date' })
  period: Date; // YYYY-MM-01 형식으로 저장 (월 단위)

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date; // 마지막 사용 시간

  // 추가 통계 필드
  @Column({ type: 'integer', default: 0 })
  peakUsage: number; // 해당 기간 최대 사용량

  @Column({ type: 'timestamp', nullable: true })
  peakUsageAt: Date; // 최대 사용량 발생 시간

  @Column({ type: 'integer', default: 0 })
  warningsSent: number; // 제한 경고 발송 횟수

  @Column({ type: 'timestamp', nullable: true })
  lastWarningAt: Date; // 마지막 경고 발송 시간

  @Column({ default: false })
  limitReached: boolean; // 제한 도달 여부

  @Column({ type: 'timestamp', nullable: true })
  limitReachedAt: Date; // 제한 도달 시간

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>; // 추가 메타데이터

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods

  /**
   * 사용량 증가
   */
  incrementUsage(amount: number = 1): void {
    this.count += amount;
    this.lastUsedAt = new Date();

    // 최대 사용량 업데이트
    if (this.count > this.peakUsage) {
      this.peakUsage = this.count;
      this.peakUsageAt = new Date();
    }

    // 제한 도달 체크
    if (this.limit > 0 && this.count >= this.limit && !this.limitReached) {
      this.limitReached = true;
      this.limitReachedAt = new Date();
    }
  }

  /**
   * 사용량 감소 (삭제 등의 경우)
   */
  decrementUsage(amount: number = 1): void {
    this.count = Math.max(0, this.count - amount);

    // 제한 도달 상태 업데이트
    if (this.limit > 0 && this.count < this.limit && this.limitReached) {
      this.limitReached = false;
    }
  }

  /**
   * 남은 사용량 계산
   */
  getRemainingUsage(): number {
    if (this.limit === -1) return -1; // 무제한
    return Math.max(0, this.limit - this.count);
  }

  /**
   * 사용률 계산 (퍼센트)
   */
  getUsagePercentage(): number {
    if (this.limit === -1 || this.limit === 0) return 0;
    return Math.round((this.count / this.limit) * 100);
  }

  /**
   * 제한 확인
   */
  canUse(amount: number = 1): boolean {
    if (this.limit === -1) return true; // 무제한
    return (this.count + amount) <= this.limit;
  }

  /**
   * 경고가 필요한지 확인 (80% 이상 사용 시)
   */
  needsWarning(): boolean {
    if (this.limit === -1 || this.limit === 0) return false;
    const percentage = this.getUsagePercentage();
    return percentage >= 80 && percentage < 100;
  }

  /**
   * 사용량 초기화
   */
  resetUsage(): void {
    this.count = 0;
    this.limitReached = false;
    this.limitReachedAt = null;
    this.warningsSent = 0;
    this.lastWarningAt = null;
    this.peakUsage = 0;
    this.peakUsageAt = null;
  }

  /**
   * 현재 기간 문자열 반환 (YYYY-MM)
   */
  getPeriodString(): string {
    const year = this.period.getFullYear();
    const month = String(this.period.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}