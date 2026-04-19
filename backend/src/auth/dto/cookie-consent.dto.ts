import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CookieConsentDto {
  @ApiProperty({
    description: "Whether optional analytics cookies are enabled.",
    example: true,
  })
  @IsBoolean()
  analyticsEnabled: boolean;

  @ApiProperty({
    description: "Consent policy version used when the visitor made the choice.",
    example: "2026-04-global-strict-v1",
  })
  @IsString()
  @MaxLength(100)
  policyVersion: string;

  @ApiProperty({
    description: "Client-side source that triggered the consent update.",
    example: "acceptAll",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}
