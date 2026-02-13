import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateMobilePrivacyPreferencesDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  profileVisible: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  activityVisible: boolean;
}
