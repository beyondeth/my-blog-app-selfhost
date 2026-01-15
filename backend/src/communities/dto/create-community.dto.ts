import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { JoinPolicy } from "../enums";

/**
 * 커뮤니티 생성 DTO
 *
 * @description 새로운 커뮤니티 생성 요청 시 사용
 *
 * **검증 규칙:**
 * - name: 2-50자, 한글/영문/숫자/공백 허용
 * - slug: 3-30자, 소문자 영문/숫자/하이픈 (URL 식별자)
 * - description: 최대 500자
 */
export class CreateCommunityDto {
  @ApiProperty({
    description: "커뮤니티 이름 (2-50자)",
    example: "개발자 커뮤니티",
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2, { message: "커뮤니티 이름은 최소 2자 이상이어야 합니다" })
  @MaxLength(50, { message: "커뮤니티 이름은 최대 50자까지 가능합니다" })
  @Matches(/^[a-zA-Z0-9가-힣\s]+$/, {
    message: "커뮤니티 이름은 한글, 영문, 숫자, 공백만 사용할 수 있습니다",
  })
  name: string;

  @ApiProperty({
    description: "URL 식별자 (3-30자, 소문자/숫자/하이픈)",
    example: "dev-community",
    minLength: 3,
    maxLength: 30,
  })
  @IsString()
  @MinLength(3, { message: "slug는 최소 3자 이상이어야 합니다" })
  @MaxLength(30, { message: "slug는 최대 30자까지 가능합니다" })
  @Transform(({ value }) => value?.toLowerCase().trim())
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      "slug는 소문자 영문, 숫자, 하이픈만 사용 가능하며 하이픈으로 시작/끝날 수 없습니다",
  })
  slug: string;

  @ApiPropertyOptional({
    description: "커뮤니티 설명 (최대 500자)",
    example: "개발자들의 지식 공유 커뮤니티입니다.",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "설명은 최대 500자까지 가능합니다" })
  description?: string;

  @ApiPropertyOptional({
    description: "아이콘 이미지 URL",
    example: "https://example.com/icon.png",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === "" ? undefined : value))
  iconUrl?: string;

  @ApiPropertyOptional({
    description: "배너 이미지 URL",
    example: "https://example.com/banner.png",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === "" ? undefined : value))
  bannerUrl?: string;

  @ApiPropertyOptional({
    description: "가입 정책",
    enum: JoinPolicy,
    default: JoinPolicy.OPEN,
    example: JoinPolicy.OPEN,
  })
  @IsOptional()
  @IsEnum(JoinPolicy, { message: "유효한 가입 정책이 아닙니다" })
  joinPolicy?: JoinPolicy;

  @ApiPropertyOptional({
    description: "커뮤니티 공개 여부 (목록/검색 노출)",
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: "커뮤니티 게시물 노출 여부 (홈피드/검색/트렌딩)",
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPostDiscoverable?: boolean;

  @ApiPropertyOptional({
    description: "NSFW(성인 콘텐츠) 여부",
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isNsfw?: boolean;
}
