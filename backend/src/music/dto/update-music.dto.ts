import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
} from "class-validator";

/**
 * 음악 정보 수정 DTO
 * 관리자가 메타데이터 수정 시 사용
 */
export class UpdateMusicDto {
  @ApiPropertyOptional({
    description: "표시용 제목 (ID3 태그 대신 사용)",
    example: "My Custom Title",
  })
  @IsOptional()
  @IsString()
  displayTitle?: string;

  @ApiPropertyOptional({
    description: "표시용 아티스트 (ID3 태그 대신 사용)",
    example: "Custom Artist",
  })
  @IsOptional()
  @IsString()
  displayArtist?: string;

  @ApiPropertyOptional({
    description: "활성화 상태",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "재생 순서",
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    description:
      "표시용 장르 (관리자 지정, 기본: Lo-Fi, Chill, Electronic, Ambient 또는 커스텀)",
    example: "Lo-Fi",
  })
  @IsOptional()
  @IsString()
  displayGenre?: string;
}
