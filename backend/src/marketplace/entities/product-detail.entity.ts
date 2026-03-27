import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
  Check,
} from "typeorm";
import { Post } from "../../posts/entities/post.entity";
import { DeliveryItem } from "./delivery-item.entity";
import { ProductCategory } from "../../common/enums/product-category.enum";

/**
 * 상품 상세 정보 (1:1 with Post)
 *
 * PostStats/PostMetadata 패턴과 동일 — Post 테이블을 비대하게 만들지 않고
 * 상품 전용 필드를 별도 테이블로 분리하여 blog 포스트 조회 성능에 영향 없음.
 *
 * 역정규화: salesCount, totalRevenue → 원자적 SQL UPDATE로 증가 (레이스 컨디션 방지)
 */
@Entity("product_details")
@Index(["postId"], { unique: true })
@Index(["productCategory"])
@Index(["price"])
@Index(["salesCount"])
@Check(`"price" >= 1000`)
export class ProductDetail {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** 연결된 포스트 (1:1, 포스트 삭제 시 함께 삭제) */
  @Column({ type: "uuid", unique: true })
  postId: string;

  @OneToOne(() => Post, { onDelete: "CASCADE" })
  @JoinColumn({ name: "postId" })
  post: Post;

  /** 가격 (KRW, 최소 1,000원) */
  @Column({ type: "integer" })
  price: number;

  /** 통화 (기본: KRW) */
  @Column({ type: "varchar", length: 3, default: "KRW" })
  currency: string;

  /** 상품 카테고리 */
  @Column({ type: "varchar", length: 50, default: ProductCategory.OTHERS })
  productCategory: ProductCategory;

  /** 공개 마케팅 설명 HTML (구매 전 모든 사용자에게 노출) */
  @Column({ type: "text", nullable: true })
  descriptionHtml: string | null;

  /** 구매 전 미리보기 HTML (null이면 본문 앞부분 자동 추출) */
  @Column({ type: "text", nullable: true })
  previewContent: string | null;

  /** 전달 방식: content(본문이 상품) / file(별도 파일) / mixed(복합) */
  @Column({ type: "varchar", length: 20, default: "content" })
  deliveryType: "content" | "file" | "mixed";

  /** 디지털 파일 다운로드 URL (하위 호환 — 신규는 DeliveryItem 사용) */
  @Column({ type: "varchar", length: 500, nullable: true })
  digitalDeliveryUrl: string | null;

  /** 배송 항목 수 (역정규화 — DeliveryItem 변경 시 원자적 업데이트) */
  @Column({ type: "integer", default: 0 })
  deliveryItemCount: number;

  /** 배송 항목 목록 */
  @OneToMany(() => DeliveryItem, (item) => item.productDetail)
  deliveryItems: DeliveryItem[];

  /** 누적 판매 수 (역정규화 — 원자적 UPDATE로만 증가) */
  @Column({ type: "integer", default: 0 })
  salesCount: number;

  /** 누적 총 매출 KRW (역정규화) */
  @Column({ type: "integer", default: 0 })
  totalRevenue: number;

  /** 플랫폼 수수료율 % (기본 20%) */
  @Column({ type: "decimal", precision: 5, scale: 2, default: 20.0 })
  commissionRate: number;

  /** 판매 활성 상태 (false면 마켓플레이스 미노출) */
  @Column({ type: "boolean", default: true })
  isActive: boolean;

  /** 평균 평점 (역정규화 — 리뷰 변경 시 재계산) */
  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
  averageRating: number;

  /** 리뷰 수 (역정규화) */
  @Column({ type: "integer", default: 0 })
  reviewCount: number;

  /** 확장 메타데이터 (라이선스, 버전 등) */
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
