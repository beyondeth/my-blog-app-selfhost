import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
  Max,
  IsArray,
  ArrayMaxSize,
  ValidateIf,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

/**
 * 커뮤니티 게시물 생성 DTO
 *
 * @description 커뮤니티에 새 게시물 생성 요청 시 사용
 *
 * **검증 규칙:**
 * - title: 2-200자
 * - content: 최대 200,000자 (HTML)
 * - flairId: 선택적 (커뮤니티에서 정의한 플레어)
 */
export class CreateCommunityPostDto {
  @ApiProperty({
    description: "게시물 제목 (2-200자)",
    example: "NestJS에서 Redis 캐싱 구현하기",
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2, { message: "제목은 최소 2자 이상이어야 합니다" })
  @MaxLength(200, { message: "제목은 최대 200자까지 가능합니다" })
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiProperty({
    description: "게시물 내용 (HTML 형식, 최대 200,000자)",
    example: "<p>Redis 캐싱을 구현하는 방법을 알아봅시다...</p>",
  })
  @IsString()
  @IsNotEmpty({ message: "내용을 입력해주세요" })
  @MaxLength(200000, { message: "내용은 최대 200,000자까지 가능합니다" })
  content: string;

  @ApiPropertyOptional({
    description: "마크다운 원본 내용 (하이브리드 저장용, 최대 200,000자)",
    example: "# Redis 캐싱\n\nRedis 캐싱을 구현하는 방법...",
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
  // null, 빈 문자열, placeholder 값은 모두 undefined로 변환
  @Transform(({ value }) => {
    if (
      value === "" ||
      value === null ||
      value === undefined ||
      value === "__none__"
    ) {
      return undefined;
    }
    return value;
  })
  // 값이 truthy하고 '__none__' placeholder가 아닌 경우에만 UUID 검증 수행
  @ValidateIf((o) => {
    const val = o.flairId;
    return (
      val !== undefined && val !== null && val !== "" && val !== "__none__"
    );
  })
  @IsUUID("all", { message: "플레어 ID는 유효한 UUID 형식이어야 합니다" })
  flairId?: string;

  @ApiPropertyOptional({
    description: "썸네일 이미지 파일 ID (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440001",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  @ValidateIf(
    (o) =>
      o.thumbnailImageId !== undefined &&
      o.thumbnailImageId !== null &&
      o.thumbnailImageId !== "",
  )
  @IsUUID("all", { message: "썸네일 ID는 유효한 UUID 형식이어야 합니다" })
  thumbnailImageId?: string;

  @ApiPropertyOptional({
    description: "콘텐츠 품질 점수 (0-100, 자동 계산)",
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @ApiPropertyOptional({
    description: "발행 여부 (true면 즉시 발행, false면 초안)",
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

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
}
