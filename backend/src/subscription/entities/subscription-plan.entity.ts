import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { SubscriptionTier } from "../../common/enums/subscription.enum";

// 플랜 기능 인터페이스 (간소화 버전)
export interface PlanFeatures {
  // MCP 자동포스팅 제한 (일반 사용자 작성 포스트는 무제한)
  maxMcpPostsPerDay: number; // MCP 자동포스팅 일 제한
  maxMcpPostsPerMonth: number; // MCP 자동포스팅 월 제한
  maxBlogCount: number; // 블로그 개수 제한 (모든 플랜 1개)
  analytics: "none" | "basic" | "advanced"; // 분석 기능 레벨
  removeAds: boolean; // 광고 제거
  exportData: boolean; // 데이터 내보내기 기능
  scheduledPosts: boolean; // 예약 포스팅
}

// 가격 인터페이스
export interface PlanPricing {
  monthly: number;
  yearly: number;
  currency: string;
  discountPercentage?: number; // 연간 결제 할인율
}

@Entity("subscription_plans")
@Index(["tier"], { unique: true })
export class SubscriptionPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 50 })
  name: string; // 'Free', 'Starter', 'Pro'

  @Column({ length: 255, nullable: true })
  displayName: string; // 화면 표시용 이름

  @Column({
    type: "enum",
    enum: SubscriptionTier,
    unique: true,
  })
  tier: SubscriptionTier;

  @Column("jsonb")
  features: PlanFeatures;

  @Column("jsonb")
  pricing: PlanPricing;

  @Column({ type: "text", nullable: true })
  description: string; // 플랜 설명

  @Column({ default: true })
  isActive: boolean; // 활성 플랜 여부

  @Column({ default: 0 })
  sortOrder: number; // 표시 순서

  @Column({ default: false })
  isPopular: boolean; // 인기 플랜 표시

  @Column({ nullable: true })
  badge: string; // 'BEST VALUE', 'POPULAR' 등

  @Column({ default: 7 })
  trialDays: number; // 무료 체험 기간 (일)

  @Column("jsonb", { nullable: true })
  metadata: Record<string, any>; // 추가 메타데이터

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods

  /**
   * 월 가격 가져오기
   */
  getMonthlyPrice(): number {
    return this.pricing.monthly;
  }

  /**
   * 연간 가격 가져오기
   */
  getYearlyPrice(): number {
    return this.pricing.yearly;
  }

  /**
   * 연간 결제 시 월 단가
   */
  getYearlyMonthlyPrice(): number {
    return Math.round(this.pricing.yearly / 12);
  }

  /**
   * 특정 기능 확인
   */
  hasFeature(featureName: keyof PlanFeatures): boolean {
    return !!this.features[featureName];
  }

  /**
   * 리소스 제한 확인
   */
  getResourceLimit(resource: keyof PlanFeatures): number {
    const value = this.features[resource];
    return typeof value === "number" ? value : 0;
  }
}
