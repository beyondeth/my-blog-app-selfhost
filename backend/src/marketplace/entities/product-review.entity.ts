import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from "typeorm";
import { Post } from "../../posts/entities/post.entity";
import { User } from "../../users/entities/user.entity";
import { Order } from "./order.entity";

/**
 * 상품 리뷰 엔티티
 *
 * 구매 확인된 사용자만 리뷰 작성 가능 (isVerifiedPurchase).
 * 구매자당 상품 1개 리뷰 제한 (UNIQUE productPostId + buyerId).
 * 판매자 응답 기능 포함.
 *
 * 역정규화: ProductDetail.averageRating, ProductDetail.reviewCount
 *           → 리뷰 생성/수정/삭제 시 recalculate
 */
@Entity("product_reviews")
@Index(["productPostId", "buyerId"], { unique: true })
@Index(["productPostId", "createdAt"])
@Index(["buyerId"])
@Check(`"rating" >= 1 AND "rating" <= 5`)
export class ProductReview {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  productPostId: string;

  @ManyToOne(() => Post, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productPostId" })
  productPost: Post;

  /** 리뷰 작성자 (구매자) */
  @Column({ type: "uuid", nullable: true })
  buyerId: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "buyerId" })
  buyer: User | null;

  /** 연결된 주문 */
  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order: Order;

  /** 평점 (1-5) */
  @Column({ type: "integer" })
  rating: number;

  /** 리뷰 텍스트 (선택, 최대 2000자 — 서비스 레벨 검증) */
  @Column({ type: "text", nullable: true })
  content: string | null;

  /** 리뷰 이미지 (최대 5장) */
  @Column({ type: "jsonb", default: [] })
  images: { fileKey: string; fileName: string; mimeType?: string }[];

  /** 구매 인증 리뷰 여부 */
  @Column({ type: "boolean", default: true })
  isVerifiedPurchase: boolean;

  /** 판매자 응답 */
  @Column({ type: "text", nullable: true })
  sellerResponse: string | null;

  @Column({ type: "timestamptz", nullable: true })
  sellerRespondedAt: Date | null;

  /** 관리자 숨김 처리 */
  @Column({ type: "boolean", default: false })
  isHidden: boolean;

  @Column({ type: "text", nullable: true })
  hiddenReason: string | null;

  /** 확장 메타데이터 (editedAt, editCount 등) */
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
