import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/**
 * 토스페이먼츠 빌링키 엔티티
 *
 * 사용자의 카드 정보를 토큰화한 빌링키를 저장
 * 정기결제 시 이 빌링키로 자동 결제 실행
 * 사용자당 여러 빌링키 보유 가능 (카드 여러 장)
 */
@Entity("toss_billing_keys")
@Index(["userId"])
@Index(["customerKey"])
@Index(["isActive"])
export class TossBillingKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  /** 토스 customerKey — 사용자 식별용 */
  @Column({ length: 255 })
  customerKey: string;

  /** 토스 billingKey — 카드 토큰 (결제 실행에 사용) */
  @Column({ length: 255 })
  billingKey: string;

  /** 카드사 코드 (예: 신한, 삼성 등) */
  @Column({ length: 50, nullable: true })
  cardCompany: string;

  /** 마스킹된 카드번호 (예: ****1234) */
  @Column({ length: 50, nullable: true })
  cardNumber: string;

  /** 카드 타입: 신용/체크 */
  @Column({ length: 20, nullable: true })
  cardType: string;

  /** 빌링키 활성 상태 — false면 결제에 사용하지 않음 */
  @Column({ default: true })
  isActive: boolean;

  /** 카드 인증 일시 (토스에서 받은 값) */
  @Column({ type: "timestamp", nullable: true })
  authenticatedAt: Date;

  /** 추가 메타데이터 */
  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
