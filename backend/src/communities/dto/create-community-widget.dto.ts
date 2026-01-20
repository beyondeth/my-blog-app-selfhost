import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
  IsObject,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CommunitySidebarWidgetType } from "../enums";

export class CommunityWidgetItemInputDto {
  @ApiPropertyOptional({ description: "항목 레이블", maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  label?: string;

  @ApiPropertyOptional({ description: "본문/설명", maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({ description: "링크 URL" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  )
  @IsUrl({
    require_protocol: true,
    protocols: ["https"],
  })
  linkUrl?: string;

  @ApiPropertyOptional({ description: "CTA 라벨", maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ctaLabel?: string;

  @ApiPropertyOptional({ description: "CTA URL" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  )
  @IsUrl({
    require_protocol: true,
    protocols: ["https"],
  })
  ctaUrl?: string;

  @ApiPropertyOptional({ description: "이미지 URL" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  )
  @IsUrl({
    require_protocol: true,
    protocols: ["https"],
  })
  imageUrl?: string;

  @ApiPropertyOptional({ description: "이미지 대체 텍스트", maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageAlt?: string;

  @ApiPropertyOptional({ description: "위치 정보", maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  location?: string;

  @ApiPropertyOptional({ description: "이벤트 시작 시간 ISO8601" })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: "이벤트 종료 시간 ISO8601" })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    description: "추천 커뮤니티 ID",
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  targetCommunityId?: string;

  @ApiPropertyOptional({
    description: "추천 커뮤니티 slug (ID 대신 사용 가능)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetCommunitySlug?: string;

  @ApiPropertyOptional({
    description: "임의의 메타데이터 (widget 타입별 옵션)",
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateCommunityWidgetDto {
  @ApiProperty({
    enum: CommunitySidebarWidgetType,
    description: "위젯 타입",
  })
  @IsEnum(CommunitySidebarWidgetType)
  type: CommunitySidebarWidgetType;

  @ApiPropertyOptional({ description: "위젯 제목", maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  title?: string;

  @ApiPropertyOptional({ description: "위젯 설명", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: "활성화 여부" })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: "위젯 메타데이터",
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: "위젯 항목 목록 (타입별 최대 10개)",
    type: [CommunityWidgetItemInputDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: "위젯 항목은 최대 10개까지 추가할 수 있습니다" })
  @ValidateNested({ each: true })
  @Type(() => CommunityWidgetItemInputDto)
  items?: CommunityWidgetItemInputDto[];
}
