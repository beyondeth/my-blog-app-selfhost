/**
 * 구독 관련 타입 정의
 */

/**
 * 구독 티어
 */
export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
}

/**
 * 결제 주기
 */
export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

/**
 * 구독 상태
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  EXPIRED = 'expired',
  TRIALING = 'trialing',
}

/**
 * 결제 상태
 */
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

/**
 * 리소스 타입
 */
export enum ResourceType {
  POST = 'post',
  BLOG = 'blog',
  COMMENT = 'comment',
  FILE = 'file',
}

/**
 * 구독 플랜 기능
 */
export interface SubscriptionFeatures {
  maxPostsPerMonth: number;
  maxBlogCount: number;
  analytics: 'none' | 'basic' | 'advanced';
  removeAds: boolean;
  exportData: boolean;
  scheduledPosts: boolean;
}

/**
 * 구독 플랜
 */
export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  billingCycle?: BillingCycle;
  features: SubscriptionFeatures;
  highlights: string[];
  limitations: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 구독 정보
 */
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  cancelReason?: string;
  trialEndsAt?: string;
  plan?: SubscriptionPlan;
  createdAt: string;
  updatedAt: string;
}

/**
 * 사용량 통계
 */
export interface UsageStats {
  userId: string;
  resourceType: ResourceType;
  currentUsage: number;
  limit: number;
  percentage: number;
  resetDate: string;
  period: 'daily' | 'monthly' | 'yearly';
}

/**
 * 사용량 추적
 */
export interface UsageTracking {
  id: string;
  userId: string;
  resourceType: ResourceType;
  action: string;
  count: number;
  metadata?: Record<string, any>;
  trackedAt: string;
}

/**
 * 결제 내역
 */
export interface PaymentHistory {
  id: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  provider?: string;
  providerId?: string;
  invoiceUrl?: string;
  failureReason?: string;
  refundAmount?: number;
  refundReason?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 사용량 통계 응답 형태
 */
export interface UsageStatsResponse {
  tier: SubscriptionTier;
  limits: Record<string, number>;
  usage: Record<string, number>;
  percentages: Record<string, number>;
}

/**
 * 구독 응답 데이터
 */
export interface SubscriptionResponse {
  subscription: Subscription | null;
  usage: UsageStatsResponse | UsageStats[];  // 백엔드 응답 형태에 따라 둘 다 지원
}

/**
 * 체크아웃 세션 응답
 */
export interface CheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

/**
 * 사용량 체크 응답
 */
export interface UsageLimitResponse {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
}

/**
 * 업그레이드 시뮬레이션 응답
 */
export interface UpgradeSimulation {
  currentPlan: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  proratedAmount?: number;
  nextBillingAmount: number;
  nextBillingDate: string;
  immediateCharge: boolean;
  changes: {
    feature: string;
    from: any;
    to: any;
  }[];
}