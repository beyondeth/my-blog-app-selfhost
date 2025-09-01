import { IsString, IsEmail, IsOptional, MinLength, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Username',
    minLength: 3,
    maxLength: 20,
    example: 'john_doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must not exceed 20 characters' })
  username?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'User bio',
    maxLength: 1000,
    example: 'A passionate developer who loves coding',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Bio must not exceed 1000 characters' })
  bio?: string;

  @ApiPropertyOptional({
    description: 'Profile image URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Please provide a valid URL for profile image' })
  profileImage?: string;
}