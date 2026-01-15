import {
  IsEnum,
  IsString,
  IsOptional,
  MaxLength,
  IsObject,
} from "class-validator";
import { ReportStatus, ReportAction } from "../enums/report.enum";

export class UpdateReportDto {
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @IsEnum(ReportAction)
  @IsOptional()
  actionTaken?: ReportAction;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  moderatorNotes?: string;

  @IsOptional()
  @IsObject()
  actionPayload?: Record<string, any>;
}
