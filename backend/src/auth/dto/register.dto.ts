import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '올바른 이메일 주소를 입력해주세요' })
  email: string;

  @ApiProperty({
    description: 'Username',
    minLength: 3,
    maxLength: 20,
    example: 'john_doe',
  })
  @IsString()
  @MinLength(3, { message: '사용자명은 최소 3자 이상이어야 합니다' })
  @MaxLength(20, { message: '사용자명은 20자를 초과할 수 없습니다' })
  @Matches(/^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ_\s]+$/, {
    message: '사용자명은 한글, 영문자, 숫자, 언더스코어(_), 공백만 사용할 수 있습니다',
  })
  username: string;

  @ApiProperty({
    description: 'User password',
    minLength: 8,
    example: 'StrongPassword123!',
  })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: '비밀번호는 최소 하나의 소문자, 하나의 대문자, 그리고 하나의 숫자를 포함해야 합니다',
  })
  password: string;

  @ApiProperty({
    description: 'Email verification session token (필수)',
    example: 'abc123def456...',
    required: true,
  })
  @IsString()
  emailVerificationToken: string;
} 