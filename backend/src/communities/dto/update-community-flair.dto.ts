import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  MaxLength,
  MinLength,
  Matches,
  Min,
  Max,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

/**
 * 커뮤니티 플레어 수정 DTO
 *
 * @description 커뮤니티 플레어 수정 요청 시 사용
 * 모든 필드가 선택적이며, 제공된 필드만 업데이트됩니다.
 *
 * **주의:**
 * - type 필드는 변경 불가 (POST ↔ USER 변환 금지)
 * - 기존 게시물/사용자에 할당된 플레어는 영향 없음
 */
export class UpdateCommunityFlairDto {
  @ApiPropertyOptional({
    description: "플레어 이름 (1-64자)",
    example: "질문/도움요청",
    minLength: 1,
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "플레어 이름은 최소 1자 이상이어야 합니다" })
  @MaxLength(64, { message: "플레어 이름은 최대 64자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({
    description: "배경색 (HEX 코드, #RRGGBB)",
    example: "#3366FF",
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: "배경색은 유효한 HEX 코드 형식이어야 합니다 (예: #FF5733)",
  })
  backgroundColor?: string;

  @ApiPropertyOptional({
    description: "텍스트색 (HEX 코드, #RRGGBB)",
    example: "#FFFFFF",
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: "텍스트색은 유효한 HEX 코드 형식이어야 합니다 (예: #FFFFFF)",
  })
  textColor?: string;

  @ApiPropertyOptional({
    description: "모더레이터 전용 여부",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isModOnly?: boolean;

  @ApiPropertyOptional({
    description: "활성화 여부",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: "표시 순서 (0부터 시작)",
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
