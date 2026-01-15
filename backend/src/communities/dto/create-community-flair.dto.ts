import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  MaxLength,
  MinLength,
  Matches,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { FlairType } from "../enums";

/**
 * 커뮤니티 플레어 생성 DTO
 *
 * @description 커뮤니티 플레어(태그) 생성 요청 시 사용
 *
 * **타입:**
 * - POST: 게시물용 플레어 (예: "질문", "정보", "토론")
 * - USER: 사용자용 플레어 (예: "뉴비", "고수", "기여자")
 */
export class CreateCommunityFlairDto {
  @ApiProperty({
    description: "플레어 이름 (1-64자)",
    example: "질문",
    minLength: 1,
    maxLength: 64,
  })
  @IsString()
  @MinLength(1, { message: "플레어 이름은 최소 1자 이상이어야 합니다" })
  @MaxLength(64, { message: "플레어 이름은 최대 64자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: "배경색 (HEX 코드, #RRGGBB)",
    example: "#FF5733",
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
    description: "플레어 타입",
    enum: FlairType,
    default: FlairType.POST,
    example: FlairType.POST,
  })
  @IsOptional()
  @IsEnum(FlairType, { message: "유효한 플레어 타입이 아닙니다" })
  type?: FlairType;

  @ApiPropertyOptional({
    description: "모더레이터 전용 여부",
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isModOnly?: boolean;

  @ApiPropertyOptional({
    description: "활성화 여부",
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: "표시 순서 (0부터 시작)",
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
