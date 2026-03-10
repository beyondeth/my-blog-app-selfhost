import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
  IsUUID,
  IsIn,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class CreatePostDto {
  @ApiProperty({
    description: "게시글 제목",
    example: "블로그 포스트 제목",
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: "게시글 내용 (HTML 형식 또는 마크다운이 변환된 HTML)",
    example: "게시글의 상세 내용...",
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: "썸네일 이미지 파일 ID (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsOptional()
  @Transform(({ value }) => {
    // 빈 문자열, null, undefined를 모두 undefined로 통일
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  @IsUUID("4", { message: "썸네일 ID는 유효한 UUID v4 형식이어야 합니다" })
  thumbnailImageId?: string;

  @ApiPropertyOptional({
    description: "썸네일 이미지 인덱스 (첨부 파일 배열의 인덱스, 0-based)",
    example: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: "썸네일 인덱스는 숫자여야 합니다" })
  @Min(0, { message: "썸네일 인덱스는 0 이상이어야 합니다" })
  thumbnailIndex?: number;

  @ApiPropertyOptional({
    description: "태그 배열",
    example: ["javascript", "nodejs", "nestjs"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: "카테고리 (필수, 최대 2단계, 각 카테고리는 1~15글자)",
    example: "JavaScript/React",
  })
  @IsString()
  @Matches(/^.{1,15}$|^.{1,15}\/.{1,15}$/, {
    message:
      "카테고리는 최대 2단계까지 가능하며, 각 카테고리는 1~15글자여야 합니다 (예: JavaScript/React)",
  })
  category: string;

  @ApiPropertyOptional({
    description: "첨부 파일 ID 배열 (UUID)",
    example: [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001",
    ],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", {
    each: true,
    message: "첨부 파일 ID는 유효한 UUID v4 형식이어야 합니다",
  })
  attachedFileIds?: string[];

  @ApiPropertyOptional({
    description: "마크다운 원본 내용 (하이브리드 저장용, 최대 200,000자)",
    example: "# 제목\n\n마크다운 **내용**...",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200000, { message: "포스트 내용은 최대 200,000자까지 가능합니다" })
  content_markdown?: string;

  @ApiPropertyOptional({
    description: "콘텐츠 품질 점수 (0-100, MCP 서버에서 자동 계산)",
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
    description: "발행 여부 (true면 즉시 발행, false면 초안으로 저장)",
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: "포스트 공개 범위 (public | private)",
    example: "public",
    enum: ["public", "private"],
    default: "public",
  })
  @IsOptional()
  @IsIn(["public", "private"])
  visibility?: "public" | "private";

  @ApiPropertyOptional({
    description: "회원가입 사용자에게만 공개할 GitHub 리소스 주소",
    example: "https://github.com/beyondeth/codebase-skills",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  githubUrl?: string;

  @ApiPropertyOptional({
    description: "GitHub 리소스 한줄 설명",
    example: "이 글에서 소개한 예제 코드를 받아볼 수 있습니다.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  githubDescription?: string;
}
