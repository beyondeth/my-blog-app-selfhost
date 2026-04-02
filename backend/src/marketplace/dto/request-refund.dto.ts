import { IsString, MaxLength, IsEnum } from "class-validator";
import { RefundReasonCategory } from "../entities/refund-request.entity";

/**
 * 환불 요청 DTO — 입력 검증
 */
export class RequestRefundDto {
  @IsString()
  orderId: string;

  @IsString()
  @MaxLength(1000, { message: "환불 사유는 1000자 이내로 입력해주세요" })
  reason: string;

  @IsEnum(RefundReasonCategory, { message: "유효하지 않은 환불 사유 카테고리입니다" })
  reasonCategory: RefundReasonCategory;
}
