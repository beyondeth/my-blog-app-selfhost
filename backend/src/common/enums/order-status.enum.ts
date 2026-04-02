/**
 * 마켓플레이스 주문 상태
 */
export const OrderStatus = {
  /** 결제 대기 중 (주문 생성 직후) */
  PENDING: "pending",
  /** 결제 완료 (상품 접근 가능) */
  PAID: "paid",
  /** 결제 실패 */
  FAILED: "failed",
  /** 환불 완료 */
  REFUNDED: "refunded",
  /** 주문 취소 (결제 전) */
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
