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
import { Post } from "../../posts/entities/post.entity";
import { OrderStatus } from "../../common/enums/order-status.enum";

/**
 * 마켓플레이스 주문 엔티티
 *
 * 안전성 조치:
 * - UNIQUE(buyerId, productPostId): 동일 상품 중복 구매 방지 + 멱등성
 * - UNIQUE(orderId): 토스 결제 orderId 기반 멱등성
 * - UNIQUE(paymentKey): 결제 키 중복 방지
 * - sellerId !== buyerId: 판매자 본인 구매 차단 (서비스 레벨 검증)
 */
@Entity("orders")
@Index(["orderId"], { unique: true })
@Index(["buyerId"])
@Index(["sellerId"])
@Index(["productPostId"])
@Index(["status"])
@Index(["buyerId", "productPostId"], { unique: true })
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** 토스 결제 주문번호 (멱등성 키) */
  @Column({ type: "varchar", length: 64, unique: true })
  orderId: string;

  /** 구매자 (탈퇴 시 주문 기록 보존) */
  @Column({ type: "uuid", nullable: true })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "buyerId" })
  buyer: User;

  /** 판매자 */
  @Column({ type: "uuid", nullable: true })
  sellerId: string;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "sellerId" })
  seller: User;

  /** 구매한 상품 포스트 */
  @Column({ type: "uuid", nullable: true })
  productPostId: string;

  @ManyToOne(() => Post, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "productPostId" })
  productPost: Post;

  /** 결제 금액 (KRW) */
  @Column({ type: "integer" })
  amount: number;

  /** 플랫폼 수수료 */
  @Column({ type: "integer", default: 0 })
  platformFee: number;

  /** 판매자 수익 (amount - platformFee) */
  @Column({ type: "integer", default: 0 })
  sellerRevenue: number;

  /** 통화 */
  @Column({ type: "varchar", length: 3, default: "KRW" })
  currency: string;

  /** 주문 상태 */
  @Column({ type: "varchar", length: 20, default: OrderStatus.PENDING })
  status: OrderStatus;

  /** 토스 paymentKey (결제 완료 시 설정) */
  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  paymentKey: string | null;

  /** 카드 영수증 URL */
  @Column({ type: "text", nullable: true })
  receiptUrl: string | null;

  /** 환불 일시 */
  @Column({ type: "timestamp", nullable: true })
  refundedAt: Date | null;

  /** 환불 사유 */
  @Column({ type: "text", nullable: true })
  refundReason: string | null;

  /** 결제 상세 메타데이터 (카드 정보, 승인번호 등) */
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
