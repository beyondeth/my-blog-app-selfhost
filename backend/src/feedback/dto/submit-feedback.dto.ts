import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { FeedbackMode, FeedbackType } from "../entities/feedback-ticket.entity";

export class SubmitFeedbackDto {
  @IsEnum(FeedbackMode)
  @IsNotEmpty()
  mode: FeedbackMode;

  @IsEnum(FeedbackType)
  @IsOptional()
  type?: FeedbackType;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  pagePath?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  theme?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}
