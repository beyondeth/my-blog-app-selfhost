import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ReportReason, ReportTargetType } from "../enums";

/**
 * 신고 생성 DTO
 *
 * @description 게시물 또는 댓글을 신고할 때 사용합니다.
 * targetType에 따라 targetPostId 또는 targetCommentId가 필수입니다.
 */
export class CreateReportDto {
  @ApiProperty({
    description: "신고 대상 유형",
    enum: ReportTargetType,
    example: ReportTargetType.POST,
  })
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @ApiPropertyOptional({
    description: "신고 대상 게시물 ID (targetType이 post인 경우)",
  })
  @IsOptional()
  @IsUUID()
  targetPostId?: string;

  @ApiPropertyOptional({
    description: "신고 대상 댓글 ID (targetType이 comment인 경우)",
  })
  @IsOptional()
  @IsUUID()
  targetCommentId?: string;

  @ApiProperty({
    description: "신고 사유",
    enum: ReportReason,
    example: ReportReason.SPAM,
  })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({
    description: "위반한 커뮤니티 규칙 ID (reason이 RULE_VIOLATION인 경우)",
  })
  @IsOptional()
  @IsUUID()
  violatedRuleId?: string;

  @ApiPropertyOptional({
    description: "추가 설명",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/**
 * 게시물 신고 DTO (경로 파라미터에서 postId 받음)
 */
export class ReportPostDto {
  @ApiProperty({
    description: "신고 사유",
    enum: ReportReason,
    example: ReportReason.SPAM,
  })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({
    description: "위반한 커뮤니티 규칙 ID",
  })
  @IsOptional()
  @IsUUID()
  violatedRuleId?: string;

  @ApiPropertyOptional({
    description: "추가 설명",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/**
 * 댓글 신고 DTO (경로 파라미터에서 commentId 받음)
 */
export class ReportCommentDto {
  @ApiProperty({
    description: "신고 사유",
    enum: ReportReason,
    example: ReportReason.SPAM,
  })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({
    description: "위반한 커뮤니티 규칙 ID",
  })
  @IsOptional()
  @IsUUID()
  violatedRuleId?: string;

  @ApiPropertyOptional({
    description: "추가 설명",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
