import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ReportStatus } from "../enums";

/**
 * 신고 처리 DTO
 *
 * @description 모더레이터가 신고를 처리할 때 사용합니다.
 */
export class HandleReportDto {
  @ApiProperty({
    description: "처리 상태",
    enum: [
      ReportStatus.RESOLVED,
      ReportStatus.DISMISSED,
      ReportStatus.ESCALATED,
    ],
    example: ReportStatus.RESOLVED,
  })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({
    description: "모더레이터 처리 메모",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  moderatorNote?: string;
}

/**
 * 신고 에스컬레이션 DTO
 *
 * @description 사이트 관리자에게 에스컬레이션할 때 사용합니다.
 */
export class EscalateReportDto {
  @ApiPropertyOptional({
    description: "에스컬레이션 사유",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * 신고 목록 쿼리 DTO
 */
export class GetReportsQueryDto {
  @ApiPropertyOptional({
    description: "신고 상태 필터",
    enum: ReportStatus,
  })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({
    description: "페이지 번호",
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: "페이지 크기",
    default: 20,
  })
  @IsOptional()
  limit?: number;
}
