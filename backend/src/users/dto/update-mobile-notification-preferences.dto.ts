import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateMobileNotificationPreferencesDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  pushEnabled: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  marketingEnabled: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  communityReplyEnabled: boolean;
}
