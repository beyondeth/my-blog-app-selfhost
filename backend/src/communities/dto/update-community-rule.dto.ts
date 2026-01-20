import {
  IsString,
  IsOptional,
  IsNumber,
  MaxLength,
  MinLength,
  Min,
  Max,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

/**
 * 커뮤니티 규칙 수정 DTO
 *
 * @description 커뮤니티 규칙 수정 요청 시 사용
 * 모든 필드가 선택적이며, 제공된 필드만 업데이트됩니다.
 */
export class UpdateCommunityRuleDto {
  @ApiPropertyOptional({
    description: "규칙 제목 (1-30자)",
    example: "스팸/광고 금지",
    minLength: 1,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "규칙 제목은 최소 1자 이상이어야 합니다" })
  @MaxLength(30, { message: "규칙 제목은 최대 30자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  title?: string;

  @ApiPropertyOptional({
    description: "규칙 설명 (1-300자)",
    example: "수정된 규칙 설명...",
    minLength: 1,
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "규칙 설명은 최소 1자 이상이어야 합니다" })
  @MaxLength(300, { message: "규칙 설명은 최대 300자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description: "표시 순서 (0부터 시작, 낮을수록 상단)",
    minimum: 0,
    maximum: 100,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  displayOrder?: number;
}
