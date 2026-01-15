import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * 커뮤니티 가입 신청 DTO
 *
 * @description RESTRICTED 커뮤니티 가입 시 신청서 작성용
 */
export class JoinApplicationDto {
  /**
   * 가입 신청 메시지
   * - RESTRICTED 커뮤니티에서 모더레이터에게 보내는 메시지
   * - 선택적 필드 (없어도 가입 신청 가능)
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

/**
 * 가입 신청 승인/거부 DTO
 */
export class HandleApplicationDto {
  /**
   * 승인/거부 사유 (거부 시 필수)
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
