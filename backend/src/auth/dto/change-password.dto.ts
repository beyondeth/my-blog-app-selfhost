import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 비밀번호 변경 DTO
 * 로그인한 사용자가 현재 비밀번호를 입력하고 새 비밀번호로 변경
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    minLength: 8,
    example: 'currentPassword123',
  })
  @IsString()
  @MinLength(8, { message: '현재 비밀번호는 최소 8자 이상이어야 합니다' })
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    minLength: 8,
    example: 'newPassword123',
  })
  @IsString()
  @MinLength(8, { message: '새 비밀번호는 최소 8자 이상이어야 합니다' })
  newPassword: string;
}
