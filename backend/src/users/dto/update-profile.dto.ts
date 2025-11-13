import { IsString, IsEmail, IsOptional, MinLength, MaxLength, IsUrl, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Username',
    minLength: 2,
    maxLength: 20,
    example: 'john_doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '닉네임은 최소 2자 이상 입력하세요' })
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
    description: 'Profile image URL or character path',
    example: 'https://example.com/avatar.jpg or /character/Bimmo.jpeg',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/.+|\/character\/.+\.jpeg)$/, {
    message: 'Profile image must be a valid URL or character path (/character/xxx.jpeg)',
  })
  profileImage?: string;
}