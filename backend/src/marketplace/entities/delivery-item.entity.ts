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
import { ProductDetail } from "./product-detail.entity";

/**
 * 배송 항목 엔티티 (1:N with ProductDetail)
 *
 * 하나의 상품에 여러 콘텐츠/파일을 묶어 판매 가능.
 * 3-Layer 콘텐츠 모델의 Layer 3 (구매자 전용 콘텐츠).
 *
 * type별 필수 필드:
 *   content_html → contentHtml 필수
 *   file         → fileKey, fileName 필수
 *   external_link → externalUrl 필수
 */
@Entity("delivery_items")
@Index(["productDetailId"], { where: '"isActive" = true' })
@Index(["fileKey"], { where: '"fileKey" IS NOT NULL' })
@Check(`"type" IN ('content_html', 'file', 'external_link')`)
export class DeliveryItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  productDetailId: string;

  @ManyToOne(() => ProductDetail, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productDetailId" })
  productDetail: ProductDetail;

  /** 배송 항목 유형 */
  @Column({ type: "varchar", length: 20, default: "content_html" })
  type: "content_html" | "file" | "external_link";

  /** 표시 이름 ("Chapter 3: 심화", "소스코드 ZIP" 등) */
  @Column({ type: "varchar", length: 200 })
  label: string;

  /** 정렬 순서 */
  @Column({ type: "integer", default: 0 })
  sortOrder: number;

  // ── file 타입 전용 필드 ──

  /** S3 키 (type='file'일 때 필수) */
  @Column({ type: "varchar", length: 500, nullable: true })
  fileKey: string | null;

  /** 원본 파일명 (다운로드 시 표시) */
  @Column({ type: "varchar", length: 300, nullable: true })
  fileName: string | null;

  /** 파일 크기 (bytes) */
  @Column({ type: "bigint", nullable: true })
  fileSize: number | null;

  /** MIME 타입 */
  @Column({ type: "varchar", length: 100, nullable: true })
  mimeType: string | null;

  // ── content_html 타입 전용 ──

  /** 인라인 HTML 콘텐츠 (type='content_html'일 때) */
  @Column({ type: "text", nullable: true })
  contentHtml: string | null;

  // ── external_link 타입 전용 ──

  /** 외부 링크 URL */
  @Column({ type: "varchar", length: 1000, nullable: true })
  externalUrl: string | null;

  /** 파일 격리 상태 (Phase 2: 안전성 검증) */
  @Column({ type: "varchar", length: 20, nullable: true })
  quarantineStatus: "pending" | "scanning" | "clean" | "infected" | "failed" | null;

  /** 파일 검증 완료 시각 */
  @Column({ type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  /** 확장 메타데이터 (checksum, version, dimensions 등) */
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  /** 활성 상태 (false면 구매자에게 미노출) */
  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
