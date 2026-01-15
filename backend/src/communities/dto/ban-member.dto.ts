import {
  IsString,
  IsOptional,
  IsNumber,
  MaxLength,
  MinLength,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";

/**
 * 커뮤니티 멤버 차단 DTO
 *
 * @description 커뮤니티에서 멤버 차단 요청 시 사용
 *
 * **차단 유형:**
 * - durationDays 없음: 영구 차단
 * - durationDays 제공: 임시 차단 (해당 일수 후 자동 해제)
 */
export class BanMemberDto {
  @ApiProperty({
    description: "차단 사유 (1-500자)",
    example: "커뮤니티 규칙 위반: 스팸 게시물 반복 작성",
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1, { message: "차단 사유는 최소 1자 이상이어야 합니다" })
  @MaxLength(500, { message: "차단 사유는 최대 500자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  reason: string;

  @ApiPropertyOptional({
    description: "차단 기간 (일 단위, 미제공 시 영구 차단)",
    minimum: 1,
    maximum: 365,
    example: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: "차단 기간은 최소 1일 이상이어야 합니다" })
  @Max(365, { message: "차단 기간은 최대 365일까지 가능합니다" })
  durationDays?: number;
}
