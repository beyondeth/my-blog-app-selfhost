import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  ValidateNested,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { SocialLinkDto } from "./social-link.dto";

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: "Username",
    minLength: 2,
    maxLength: 20,
    example: "john_doe",
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "닉네임은 최소 2자 이상 입력하세요" })
  @MaxLength(30, { message: "Username must not exceed 30 characters" })
  username?: string;

  @ApiPropertyOptional({
    description: "User email address",
    example: "user@example.com",
  })
  @IsOptional()
  @IsEmail({}, { message: "Please provide a valid email address" })
  email?: string;

  @ApiPropertyOptional({
    description: "User bio",
    maxLength: 1000,
    example: "A passionate developer who loves coding",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Bio must not exceed 1000 characters" })
  bio?: string;

  @ApiPropertyOptional({
    description: "User job title or occupation",
    maxLength: 30,
    example: "Backend Engineer",
  })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: "직업 정보는 30자를 넘을 수 없습니다." })
  jobTitle?: string;

  @ApiPropertyOptional({
    description: "Profile image URL or character path",
    example: "https://example.com/avatar.jpg or /character/Bimmo.jpeg",
  })
  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/.+|\/character\/.+\.jpeg)$/, {
    message:
      "Profile image must be a valid URL or character path (/character/xxx.jpeg)",
  })
  profileImage?: string;

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
