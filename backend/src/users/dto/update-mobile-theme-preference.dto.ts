import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

export enum ThemePreference {
  SYSTEM = "SYSTEM",
  LIGHT = "LIGHT",
  DARK = "DARK",
}

export class UpdateMobileThemePreferenceDto {
  @ApiProperty({ enum: ThemePreference, example: ThemePreference.SYSTEM })
  @IsEnum(ThemePreference)
  themePreference: ThemePreference;
}
