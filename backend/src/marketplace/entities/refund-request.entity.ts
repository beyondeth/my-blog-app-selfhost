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
import { Order } from "./order.entity";

/**
 * 환불 요청 상태
 */
export const RefundStatus = {
  /** 판매자 검토 대기 */
  PENDING: "pending",
  /** 판매자 승인 */
  APPROVED: "approved",
  /** 판매자 거부 */
  REJECTED: "rejected",
  /** 24시간 무응답 → 자동 승인 */
  AUTO_APPROVED: "auto_approved",
  /** 환불 처리 완료 (토스 취소 완료) */
  PROCESSED: "processed",
  /** 판매자 7일 무응답 → 관리자 확인 필요 */
  ESCALATED: "escalated",
} as const;

export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

/**
 * 환불 사유 카테고리
 */
export const RefundReasonCategory = {
  /** 중복 결제 */
  DUPLICATE_PAYMENT: "duplicate_payment",
  /** 상품 결함/불량 */
  PRODUCT_DEFECT: "product_defect",
  /** 설명과 다른 상품 */
  NOT_AS_DESCRIBED: "not_as_described",
  /** 기타 */
  OTHER: "other",
} as const;

export type RefundReasonCategory =
  (typeof RefundReasonCategory)[keyof typeof RefundReasonCategory];

/**
 * 마켓플레이스 환불 요청 엔티티
 *
 * 워크플로:
 * 1. 구매자 요청 (PENDING)
 * 2. 시스템 자격 자동 검증 (열람/다운로드/기간)
 * 3. 판매자 승인(APPROVED) / 거부(REJECTED) / 24시간 무응답(AUTO_APPROVED)
 * 4. 토스 환불 처리 (PROCESSED)
 */
@Entity("refund_requests")
@Index(["orderId"])
@Index(["buyerId"])
@Index(["sellerId"])
@Index(["status"])
@Index(["orderId"], { unique: true }) // 주문당 1건만
export class RefundRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** 환불 대상 주문 */
  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order: Order;

  /** 구매자 (환불 요청자) — nullable: User 삭제 시 SET NULL */
  @Column({ type: "uuid", nullable: true })
  buyerId: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "buyerId" })
  buyer: User | null;

  /** 판매자 — nullable: User 삭제 시 SET NULL */
  @Column({ type: "uuid", nullable: true })
  sellerId: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "sellerId" })
  seller: User | null;

  /** 환불 사유 상세 */
  @Column({ type: "text" })
  reason: string;

  /** 환불 사유 카테고리 */
  @Column({ type: "varchar", length: 30 })
  reasonCategory: RefundReasonCategory;

  /** 환불 요청 상태 */
  @Column({ type: "varchar", length: 20, default: RefundStatus.PENDING })
  status: RefundStatus;

  /** 판매자 거부 사유 */
  @Column({ type: "text", nullable: true })
  sellerResponse: string | null;

  /** 판매자 응답 시각 */
  @Column({ type: "timestamp", nullable: true })
  respondedAt: Date | null;

  /** 환불 처리 완료 시각 (토스 취소 완료) */
  @Column({ type: "timestamp", nullable: true })
  processedAt: Date | null;

  /** 자격 검증 결과 + 처리 메타데이터 */
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
