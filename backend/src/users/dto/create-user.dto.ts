import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "../../common/enums/role.enum";
import { AuthProvider } from "../entities/user.entity";

export class CreateUserDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address" })
  email: string;

  @ApiProperty({
    description: "Username",
    minLength: 3,
    maxLength: 30,
    example: "john_doe",
  })
  @IsString()
  @MinLength(3, { message: "Username must be at least 3 characters long" })
  @MaxLength(30, { message: "Username must not exceed 30 characters" })
  username: string;

  @ApiPropertyOptional({
    description: "User password (required for local auth)",
    minLength: 8,
    example: "StrongPassword123!",
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  password?: string;

  @ApiPropertyOptional({
    description: "Profile image URL",
    example: "https://example.com/avatar.jpg",
  })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({
    description: "User role",
    enum: Role,
    default: Role.USER,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: "Authentication provider",
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  @IsOptional()
  @IsEnum(AuthProvider)
  authProvider?: AuthProvider;

  @ApiPropertyOptional({
    description: "Provider ID for OAuth users",
    example: "1234567890",
  })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({
    description: "Email verification status",
    default: false,
  })
  @IsOptional()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    description: "User bio",
    example: "Software developer passionate about web technologies",
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: "Job title or occupation",
    maxLength: 30,
    example: "Product Designer",
  })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: "Job title must not exceed 30 characters" })
  jobTitle?: string;

  @ApiPropertyOptional({
    description: "Account verification timestamp",
    example: new Date().toISOString(),
  })
  @IsOptional()
  accountVerifiedAt?: Date;

  @ApiPropertyOptional({
    description: "이용약관 동의 시각",
    example: new Date().toISOString(),
  })
  @IsOptional()
  termsAcceptedAt?: Date | null;

  @ApiPropertyOptional({
    description: "개인정보 처리방침 동의 시각",
    example: new Date().toISOString(),
  })
  @IsOptional()
  privacyAcceptedAt?: Date | null;

  @ApiPropertyOptional({
    description: "마케팅 정보 수신 동의",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @ApiPropertyOptional({
    description: "마케팅 정보 수신 동의 시각",
    example: new Date().toISOString(),
  })
  @IsOptional()
  marketingOptInAt?: Date | null;

  @ApiPropertyOptional({
    description: "뉴스레터 수신 동의",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  newsletterOptIn?: boolean;
}
