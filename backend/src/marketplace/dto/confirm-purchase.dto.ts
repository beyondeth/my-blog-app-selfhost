import { IsString, IsInt, Min } from "class-validator";

/**
 * 구매 확인 DTO
 * 토스 결제창에서 돌아온 후 결제 승인 요청
 */
export class ConfirmPurchaseDto {
  /** 토스 paymentKey (결제창에서 반환) */
  @IsString()
  paymentKey: string;

  /** 주문 번호 (prepare에서 생성) */
  @IsString()
  orderId: string;

  /** 결제 금액 (서버에서 재검증 — 프론트엔드 값은 신뢰하지 않음) */
  @IsInt()
  @Min(1000)
  amount: number;
}
