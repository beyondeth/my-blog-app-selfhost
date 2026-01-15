import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { JoinPolicy } from "../enums";

/**
 * 커뮤니티 수정 DTO
 *
 * @description 커뮤니티 정보 수정 요청 시 사용
 * 모든 필드가 선택적이며, 제공된 필드만 업데이트됩니다.
 *
 * **권한:**
 * - OWNER: 모든 필드 수정 가능
 * - MODERATOR: name, description, isNsfw만 수정 가능 (설정에 따라)
 */
export class UpdateCommunityDto {
  @ApiPropertyOptional({
    description: "커뮤니티 이름 (2-50자)",
    example: "개발자 커뮤니티",
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "커뮤니티 이름은 최소 2자 이상이어야 합니다" })
  @MaxLength(50, { message: "커뮤니티 이름은 최대 50자까지 가능합니다" })
  @Matches(/^[a-zA-Z0-9가-힣\s]+$/, {
    message: "커뮤니티 이름은 한글, 영문, 숫자, 공백만 사용할 수 있습니다",
  })
  name?: string;

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
    description: "아이콘 표시 방식 (cover 또는 contain)",
    example: "contain",
  })
  @IsOptional()
  @IsString()
  @Matches(/^(cover|contain)$/, {
    message: "iconImageFit 값은 cover 또는 contain 이어야 합니다.",
  })
  iconImageFit?: "cover" | "contain";

  @ApiPropertyOptional({
    description: "배너 표시 방식 (cover 또는 contain)",
    example: "cover",
  })
  @IsOptional()
  @IsString()
  @Matches(/^(cover|contain)$/, {
    message: "bannerImageFit 값은 cover 또는 contain 이어야 합니다.",
  })
  bannerImageFit?: "cover" | "contain";

  @ApiPropertyOptional({
    description: "가입 정책",
    enum: JoinPolicy,
    example: JoinPolicy.OPEN,
  })
  @IsOptional()
  @IsEnum(JoinPolicy, { message: "유효한 가입 정책이 아닙니다" })
  joinPolicy?: JoinPolicy;

  @ApiPropertyOptional({
    description: "NSFW(성인 콘텐츠) 여부",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isNsfw?: boolean;

  @ApiPropertyOptional({
    description: "커뮤니티 공개 여부 (검색/탐색 노출)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: "커뮤니티 게시물 노출 여부 (홈피드/검색/트렌딩)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPostDiscoverable?: boolean;
}
