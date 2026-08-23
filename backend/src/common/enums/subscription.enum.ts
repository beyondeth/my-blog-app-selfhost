// 구독 티어 열거형
export const SubscriptionTier = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
} as const;

export type SubscriptionTier =
  (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

// 구독 상태 열거형
export const SubscriptionStatus = {
  ACTIVE: "active",
  CANCELED: "canceled",
  PAST_DUE: "past_due",
  EXPIRED: "expired",
  TRIAL: "trial",
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

// 결제 주기 열거형
export const BillingCycle = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

// 결제 상태 열거형
export const PaymentStatus = {
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  SUCCESS: "succeeded", // 호환성을 위한 별칭
  FAILED: "failed",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// 리소스 타입 열거형 (사용량 추적용)
export const ResourceType = {
  POST: "post", // 일반 사용자 작성 포스트 (무제한)
  MCP_POST: "mcp_post", // MCP 자동포스팅 (v1 self-hosted usage is unlimited)
  BLOG: "blog", // 블로그 (모든 플랜 1개)
  STORAGE: "storage",
  VIEWS: "views",
  API_CALLS: "api_calls",
  AI_CREDITS: "ai_credits",
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

// 결제 제공자 열거형
export const PaymentProvider = {
  STRIPE: "stripe",
  TOSS: "toss",
  PAYPAL: "paypal",
  MANUAL: "manual", // 수동 결제나 테스트용
} as const;

export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];
