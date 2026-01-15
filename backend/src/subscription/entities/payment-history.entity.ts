import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Subscription } from "./subscription.entity";
import {
  PaymentStatus,
  PaymentProvider,
} from "../../common/enums/subscription.enum";

@Entity("payment_history")
@Index(["userId"])
@Index(["subscriptionId"])
@Index(["status"])
@Index(["createdAt"])
export class PaymentHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid", nullable: true })
  subscriptionId: string;

  @ManyToOne(() => Subscription, { onDelete: "SET NULL" })
  @JoinColumn({ name: "subscriptionId" })
  subscription: Subscription;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3, default: "USD" })
  currency: string;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: "enum",
    enum: PaymentProvider,
    nullable: true,
  })
  paymentProvider: PaymentProvider;

  @Column({ nullable: true })
  provider: string; // 결제 제공자 (문자열 버전, 호환성용)

  @Column({ nullable: true })
  providerId: string; // 결제 제공자의 ID

  @Column({ nullable: true })
  transactionId: string; // 외부 결제 시스템의 트랜잭션 ID

  @Column({ nullable: true })
  paymentMethodId: string; // 결제 수단 ID

  @Column({ type: "text", nullable: true })
  paymentMethod: string; // 'card', 'bank_transfer', 'paypal' 등

  @Column({ type: "text", nullable: true })
  description: string; // 결제 설명

  @Column({ type: "text", nullable: true })
  invoiceUrl: string; // 인보이스 URL

  @Column({ type: "text", nullable: true })
  receiptUrl: string; // 영수증 URL

  @Column({ type: "text", nullable: true })
  failureReason: string; // 실패 사유

  @Column({ nullable: true })
  failureCode: string; // 실패 코드

  @Column({ nullable: true })
  refundedAt: Date; // 환불 일시

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  refundedAmount: number; // 환불 금액

  @Column({ type: "text", nullable: true })
  refundReason: string; // 환불 사유

  // 메타데이터 (Provider별 추가 정보)
  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  // Helper methods

  /**
   * 결제 성공 여부 확인
   */
  isSuccessful(): boolean {
    return this.status === PaymentStatus.SUCCEEDED;
  }

  /**
   * 환불 가능 여부 확인
   */
  canRefund(): boolean {
    return this.status === PaymentStatus.SUCCEEDED && !this.refundedAt;
  }

  /**
   * 부분 환불 여부 확인
   */
  isPartiallyRefunded(): boolean {
    return !!this.refundedAmount && this.refundedAmount < this.amount;
  }

  /**
   * 전액 환불 여부 확인
   */
  isFullyRefunded(): boolean {
    return !!this.refundedAmount && this.refundedAmount >= this.amount;
  }
}
