import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, Matches } from "class-validator";

export class SocialLinkDto {
  @ApiProperty({
    description: "Social platform key (lowercase, extensible)",
    example: "instagram",
  })
  @IsString()
  @MaxLength(30)
  @Matches(/^[a-z0-9._-]+$/i, {
    message: "platform must be alphanumeric and may include . _ -",
  })
  platform: string;

  @ApiProperty({
    description: "Social link URL (https required)",
    example: "https://instagram.com/username",
  })
  @IsString()
  @MaxLength(500)
  @Matches(/^https:\/\//, {
    message: "url must start with https://",
  })
  url: string;
}
