import { IsOptional, IsInt, Min, Max } from "class-validator";

/**
 * 커뮤니티 초대 링크 생성 DTO
 */
export class CreateInviteDto {
  /**
   * 최대 사용 횟수
   * - 0: 무제한
   * - 1~1000: 제한된 횟수
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  maxUses?: number = 0;

  /**
   * 만료 기간 (시간 단위)
   * - 1: 1시간
   * - 24: 1일
   * - 168: 7일 (기본값)
   * - 720: 30일
   * - 0: 무제한 (최대 1년)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760) // 1년 = 8760시간
  expiresInHours?: number = 168; // 기본 7일
}
