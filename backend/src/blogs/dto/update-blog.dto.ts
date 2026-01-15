import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

/**
 * 블로그 업데이트 DTO
 *
 * @description
 * 블로그 정보 업데이트에 사용되는 DTO입니다.
 * 기본 정보(이름, 설명, 썸네일)와 브랜딩(로고, 아이콘, 커버, 색상) 필드를 포함합니다.
 */
export class UpdateBlogDto {
  // =====================================
  // 기본 정보 필드
  // =====================================

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  // =====================================
  // 브랜딩 필드 (개인 블로그 커스터마이징)
  // =====================================

  /**
   * 블로그 로고 URL
   * - 블로그 헤더에 표시
   * - 권장 사이즈: 200x60px
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  /**
   * 블로그 아이콘 URL
   * - 파비콘 및 목록 썸네일에 사용
   * - 권장 사이즈: 64x64px (정사각형)
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  iconUrl?: string | null;

  /**
   * 커버 이미지 URL
   * - 블로그 홈페이지 헤더 배경
   * - 권장 사이즈: 1200x400px
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string | null;

  @IsOptional()
  @IsIn(["cover", "contain"], {
    message: "coverImageFit 값은 cover 또는 contain 이어야 합니다.",
  })
  coverImageFit?: "cover" | "contain";

  @IsOptional()
  @IsIn(["cover", "contain"], {
    message: "iconImageFit 값은 cover 또는 contain 이어야 합니다.",
  })
  iconImageFit?: "cover" | "contain";

  @IsOptional()
  @IsIn(["inline", "badge"], {
    message: "iconPlacement 값은 inline 또는 badge 이어야 합니다.",
  })
  iconPlacement?: "inline" | "badge";

  @IsOptional()
  @IsBoolean()
  iconTextEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  iconLabel?: string | null;

  @IsOptional()
  @IsBoolean()
  iconLabelEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  iconSubtitle?: string | null;

  @IsOptional()
  @IsBoolean()
  iconSubtitleEnabled?: boolean;

  @IsOptional()
  @IsIn(["cover", "contain"], {
    message: "logoImageFit 값은 cover 또는 contain 이어야 합니다.",
  })
  logoImageFit?: "cover" | "contain";

  /**
   * 브랜드 색상 (HEX 코드)
   * - 블로그 테마 색상
   * - 형식: #RRGGBB (예: #FF5722)
   */
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: "브랜드 색상은 HEX 형식이어야 합니다 (예: #FF5722)",
  })
  brandColor?: string;
}
