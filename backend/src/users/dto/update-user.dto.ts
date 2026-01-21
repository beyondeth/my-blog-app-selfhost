import { PartialType, ApiPropertyOptional } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";
import {
  IsOptional,
  IsDate,
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SocialLinkDto } from "./social-link.dto";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: "Account verification timestamp",
    example: new Date().toISOString(),
  })
  @IsOptional()
  @IsDate()
  accountVerifiedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  suspensionUntil?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suspensionReason?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBanned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  bannedAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  banReason?: string | null;

  @ApiPropertyOptional({
    description: "User social links",
    type: [SocialLinkDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];
}
