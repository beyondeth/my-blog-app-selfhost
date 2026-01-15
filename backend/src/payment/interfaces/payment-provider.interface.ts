import { BillingCycle } from "../../common/enums/subscription.enum";

/**
 * 결제 세션 생성 옵션
 */
export interface CreateCheckoutSessionOptions {
  customerId?: string;
  priceAmount: number;
  currency: string;
  productName: string;
  billingCycle: BillingCycle;
  metadata?: Record<string, any>;
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * 결제 세션 응답
 */
export interface CheckoutSessionResponse {
  id: string;
  url: string;
  status: string;
  customerId?: string;
  subscriptionId?: string;
}

/**
 * 고객 생성 옵션
 */
export interface CreateCustomerOptions {
  email: string;
  name?: string;
  metadata?: Record<string, any>;
}

/**
 * 구독 생성 옵션
 */
export interface CreateSubscriptionOptions {
  customerId: string;
  priceId: string;
  metadata?: Record<string, any>;
  trialDays?: number;
}

/**
 * 구독 응답
 */
export interface SubscriptionResponse {
  id: string;
  customerId: string;
  status: string;
  currentPeriodEnd?: Date;
  cancelAt?: Date;
}

/**
 * 결제 수단 정보
 */
export interface PaymentMethod {
  id: string;
  type: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

/**
 * 웹훅 이벤트
 */
export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: Date;
}

/**
 * 결제 제공자 인터페이스
 * Stripe, Toss, PayPal 등 다양한 결제 서비스를 지원하기 위한 공통 인터페이스
 */
export interface PaymentProvider {
  /**
   * 제공자 이름 (stripe, toss, paypal 등)
   */
  getName(): string;

  /**
   * 고객 생성
   */
  createCustomer(options: CreateCustomerOptions): Promise<string>;

  /**
   * 고객 조회
   */
  getCustomer(customerId: string): Promise<any>;

  /**
   * 고객 업데이트
   */
  updateCustomer(
    customerId: string,
    updates: Partial<CreateCustomerOptions>,
  ): Promise<void>;

  /**
   * 고객 삭제
   */
  deleteCustomer(customerId: string): Promise<void>;

  /**
   * 결제 세션 생성
   */
  createCheckoutSession(
    options: CreateCheckoutSessionOptions,
  ): Promise<CheckoutSessionResponse>;

  /**
   * 구독 생성
   */
  createSubscription(
    options: CreateSubscriptionOptions,
  ): Promise<SubscriptionResponse>;

  /**
   * 구독 조회
   */
  getSubscription(subscriptionId: string): Promise<SubscriptionResponse>;

  /**
   * 구독 업데이트
   */
  updateSubscription(
    subscriptionId: string,
    updates: any,
  ): Promise<SubscriptionResponse>;

  /**
   * 구독 취소
   */
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean,
  ): Promise<void>;

  /**
   * 구독 재개
   */
  resumeSubscription(subscriptionId: string): Promise<void>;

  /**
   * 결제 수단 목록 조회
   */
  listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

  /**
   * 기본 결제 수단 설정
   */
  setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void>;

  /**
   * 결제 수단 삭제
   */
  deletePaymentMethod(paymentMethodId: string): Promise<void>;

  /**
   * 인보이스 목록 조회
   */
  listInvoices(customerId: string, limit?: number): Promise<any[]>;

  /**
   * 환불 처리
   */
  createRefund(paymentIntentId: string, amount?: number): Promise<any>;

  /**
   * 웹훅 서명 검증
   */
  verifyWebhookSignature(payload: any, signature: string): boolean;

  /**
   * 웹훅 이벤트 처리
   */
  parseWebhookEvent(payload: any): WebhookEvent;
}
