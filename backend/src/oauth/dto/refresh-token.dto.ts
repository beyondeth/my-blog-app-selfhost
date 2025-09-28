import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Refresh Token 요청 DTO
 * grant_type이 refresh_token일 때 사용
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Grant 타입 (refresh_token 고정)',
    example: 'refresh_token',
    enum: ['refresh_token'],
  })
  @IsEnum(['refresh_token'])
  grant_type: 'refresh_token';

  @ApiProperty({
    description: 'Refresh token',
    example: 'refresh_xyz789...',
  })
  @IsString()
  refresh_token: string;

  @ApiProperty({
    description: 'OAuth 클라이언트 ID',
    example: 'mcp_1234567890abcdef',
  })
  @IsString()
  client_id: string;

  @ApiProperty({
    description: 'OAuth 클라이언트 시크릿',
    example: 'secret_xyz789...',
  })
  @IsString()
  client_secret: string;
}