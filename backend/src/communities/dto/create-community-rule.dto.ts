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
import { Transform } from "class-transformer";

/**
 * 커뮤니티 규칙 생성 DTO
 *
 * @description 커뮤니티 규칙 생성 요청 시 사용
 *
 * **제한:**
 * - 커뮤니티당 최대 15개 규칙 권장
 * - displayOrder로 표시 순서 관리
 */
export class CreateCommunityRuleDto {
  @ApiProperty({
    description: "규칙 제목 (1-100자)",
    example: "스팸 금지",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1, { message: "규칙 제목은 최소 1자 이상이어야 합니다" })
  @MaxLength(100, { message: "규칙 제목은 최대 100자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiProperty({
    description: "규칙 설명 (1-1000자)",
    example: "광고, 스팸, 반복적인 홍보 게시물은 삭제됩니다.",
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(1, { message: "규칙 설명은 최소 1자 이상이어야 합니다" })
  @MaxLength(1000, { message: "규칙 설명은 최대 1000자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  description: string;

  @ApiPropertyOptional({
    description: "표시 순서 (0부터 시작, 낮을수록 상단)",
    default: 0,
    minimum: 0,
    maximum: 100,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  displayOrder?: number;
}
