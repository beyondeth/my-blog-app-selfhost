import { SubscriptionTier, BillingCycle, PaymentStatus } from '../../common/enums/subscription.enum';

/**
 * 결제 이벤트 페이로드 타입 정의
 * 각 이벤트에 필요한 데이터 구조를 정의
 */

/**
 * 결제 성공 이벤트 페이로드
 */
export interface PaymentSuccessPayload {
  userId: number | string;
  paymentId: string;
  amount: number;
  currency: string;
  provider: string;
  metadata: {
    tier?: SubscriptionTier;
    billingCycle?: BillingCycle;
    subscriptionId?: string;
    paymentIntentId?: string;
    [key: string]: any;
  };
  timestamp: Date;
}

/**
 * 결제 실패 이벤트 페이로드
 */
export interface PaymentFailedPayload {
  userId: number | string;
  paymentId: string;
  reason: string;
  provider: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

/**
 * 구독 생성 이벤트 페이로드
 */
export interface SubscriptionCreatedPayload {
  userId: number;
  subscriptionId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  startDate: Date;
  endDate: Date;
  provider: string;
}

/**
 * 구독 취소 이벤트 페이로드
 */
export interface SubscriptionCancelledPayload {
  userId: number;
  subscriptionId: string;
  reason?: string;
  immediately: boolean;
  cancelAt?: Date;
  timestamp: Date;
}

/**
 * 환불 이벤트 페이로드
 */
export interface RefundPayload {
  userId: number | string;
  paymentId: string;
  refundId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: Date;
}

/**
 * 인보이스 결제 이벤트 페이로드 (정기 결제)
 */
export interface InvoicePaymentPayload {
  userId: number;
  invoiceId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  nextBillingDate?: Date;
  timestamp: Date;
}

/**
 * 웹훅 이벤트 페이로드
 */
export interface WebhookPayload {
  provider: string;
  eventType: string;
  data: any;
  signature?: string;
  timestamp: Date;
}