import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/**
 * 판매자 프로필 엔티티 (1:1 User)
 *
 * 판매자 신뢰 지표 (Trust Signals):
 *   - 인증 뱃지 (이메일/본인인증)
 *   - 총 판매 수/상품 수
 *   - 평균 평점/리뷰 수
 *   - 응답률/응답 시간 (Phase 3 거래 채팅 연동)
 *   - 표시 뱃지 (top_seller, fast_responder, verified)
 *
 * 역정규화 필드는 일별 Cron으로 재계산.
 */
@Entity("seller_profiles")
@Index(["averageRating"], { where: '"totalSales" > 0' })
@Index(["totalSales"])
export class SellerProfile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  /** 본인인증 완료 여부 */
  @Column({ type: "boolean", default: false })
  isVerified: boolean;

  @Column({ type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  /** 인증 수준: none | email | identity */
  @Column({ type: "varchar", length: 20, default: "none" })
  verificationLevel: "none" | "email" | "identity";

  // ── 역정규화 통계 (Cron 재계산) ──

  /** 총 판매 건수 */
  @Column({ type: "integer", default: 0 })
  totalSales: number;

  /** 총 등록 상품 수 */
  @Column({ type: "integer", default: 0 })
  totalProducts: number;

  /** 전체 상품 평균 평점 */
  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
  averageRating: number;

  /** 총 받은 리뷰 수 */
  @Column({ type: "integer", default: 0 })
  totalReviews: number;

  /** 평균 응답 시간 (분) — Phase 3 거래 채팅 연동 */
  @Column({ type: "integer", nullable: true })
  averageResponseTimeMinutes: number | null;

  /** 24시간 내 응답률 (%) */
  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  responseRate: number | null;

  /** 표시 뱃지 목록 */
  @Column({ type: "jsonb", default: [] })
  displayBadges: string[];

  /** 확장 메타데이터 */
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
