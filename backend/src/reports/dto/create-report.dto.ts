import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  IsObject,
} from "class-validator";
import { ReportType, ReportReason } from "../enums/report.enum";

export class CreateReportDto {
  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  targetId: string;

  @IsUUID()
  @IsOptional()
  communityId?: string;

  @IsUUID()
  @IsOptional()
  reportedModeratorId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
