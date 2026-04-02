import { IsUUID } from "class-validator";

/**
 * 구매 준비 DTO
 * 주문 생성 + 토스 결제 파라미터 반환
 */
export class PreparePurchaseDto {
  /** 구매할 상품 포스트 ID */
  @IsUUID()
  productPostId: string;
}
