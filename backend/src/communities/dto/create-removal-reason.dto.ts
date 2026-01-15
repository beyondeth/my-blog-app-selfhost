import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 삭제 사유 생성 DTO
 */
export class CreateRemovalReasonDto {
  @ApiProperty({
    description: "삭제 사유 제목",
    example: "스팸 또는 광고",
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({
    description: "삭제 사유 상세 설명",
    example: "이 게시물은 스팸 또는 광고성 콘텐츠로 삭제되었습니다.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: "표시 순서 (낮을수록 먼저 표시)",
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    description: "사용자에게 알림 메시지 포함 여부",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}

/**
 * 삭제 사유 수정 DTO
 */
export class UpdateRemovalReasonDto {
  @ApiPropertyOptional({
    description: "삭제 사유 제목",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: "삭제 사유 상세 설명",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: "표시 순서",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    description: "사용자에게 알림 메시지 포함 여부",
  })
  @IsOptional()
  @IsBoolean()
  notifyUser?: boolean;
}
