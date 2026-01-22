import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEnum,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
  Max,
  IsArray,
  ArrayMaxSize,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { CommunityPostStatus } from "../enums";

/**
 * 커뮤니티 게시물 수정 DTO
 *
 * @description 커뮤니티 게시물 수정 요청 시 사용
 * 모든 필드가 선택적이며, 제공된 필드만 업데이트됩니다.
 *
 * **권한:**
 * - 작성자: 대부분의 필드 수정 가능
 * - 모더레이터: status, isPinned 수정 가능
 */
export class UpdateCommunityPostDto {
  @ApiPropertyOptional({
    description: "게시물 제목 (2-200자)",
    example: "NestJS에서 Redis 캐싱 구현하기 (수정)",
    minLength: 2,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "제목은 최소 2자 이상이어야 합니다" })
  @MaxLength(200, { message: "제목은 최대 200자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  title?: string;

  @ApiPropertyOptional({
    description: "게시물 내용 (HTML 형식, 최대 200,000자)",
    example: "<p>수정된 내용...</p>",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200000, { message: "내용은 최대 200,000자까지 가능합니다" })
  content?: string;

  @ApiPropertyOptional({
    description: "마크다운 원본 내용 (하이브리드 저장용, 최대 200,000자)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200000, {
    message: "마크다운 내용은 최대 200,000자까지 가능합니다",
  })
  contentMarkdown?: string;

  @ApiPropertyOptional({
    description: "플레어(태그) ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsUUID("all", { message: "플레어 ID는 유효한 UUID 형식이어야 합니다" })
  flairId?: string;

  @ApiPropertyOptional({
    description: "게시물 태그 목록 (최대 10개, 각 태그 최대 50자)",
    example: ["nestjs", "redis", "caching"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: "태그는 최대 10개까지 가능합니다" })
  @IsString({ each: true })
  @MaxLength(50, { each: true, message: "각 태그는 최대 50자까지 가능합니다" })
  tags?: string[];

  @ApiPropertyOptional({
    description: "NSFW(성인/민감) 콘텐츠 여부",
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isNsfw?: boolean;

  @ApiPropertyOptional({
    description: "스포일러 포함 여부",
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isSpoiler?: boolean;

  @ApiPropertyOptional({
    description: "썸네일 이미지 파일 ID (UUID)",
  })
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsUUID("all", { message: "썸네일 ID는 유효한 UUID 형식이어야 합니다" })
  thumbnailImageId?: string;

  @ApiPropertyOptional({
    description: "게시물 상태",
    enum: CommunityPostStatus,
    example: CommunityPostStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(CommunityPostStatus, { message: "유효한 게시물 상태가 아닙니다" })
  status?: CommunityPostStatus;

  @ApiPropertyOptional({
    description: "고정 게시물 여부 (모더레이터 전용)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({
    description: "댓글 잠금 여부 (모더레이터 전용)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiPropertyOptional({
    description: "콘텐츠 품질 점수 (0-100)",
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;
}
