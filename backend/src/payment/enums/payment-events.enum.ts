/**
 * 결제 관련 이벤트 타입 정의
 * Event-Driven Architecture를 위한 이벤트 목록
 */
export enum PaymentEvents {
  // 결제 이벤트
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_CANCELLED = 'payment.cancelled',

  // 환불 이벤트
  REFUND_INITIATED = 'refund.initiated',
  REFUND_SUCCESS = 'refund.success',
  REFUND_FAILED = 'refund.failed',

  // 구독 이벤트
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',

  // 인보이스 이벤트 (정기 결제)
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAYMENT_SUCCESS = 'invoice.payment.success',
  INVOICE_PAYMENT_FAILED = 'invoice.payment.failed',

  // 웹훅 이벤트
  WEBHOOK_RECEIVED = 'webhook.received',
  WEBHOOK_PROCESSED = 'webhook.processed',
  WEBHOOK_FAILED = 'webhook.failed',
}