import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({
    description: '계정 삭제 확인을 위한 비밀번호',
    example: 'currentPassword123!',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'Soft delete 여부 (true: 30일 후 삭제, false: 즉시 삭제)',
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  softDelete?: boolean;

  @ApiProperty({
    description: '삭제 이유 (선택사항)',
    required: false,
    example: '더 이상 서비스를 사용하지 않습니다.',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}