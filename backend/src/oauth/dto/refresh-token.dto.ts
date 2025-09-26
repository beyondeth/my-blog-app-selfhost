import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 리프레시 토큰 요청 DTO
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Grant 타입',
    example: 'refresh_token',
  })
  @IsEnum(['refresh_token'])
  grant_type: 'refresh_token';

  @ApiProperty({
    description: '리프레시 토큰',
    example: 'refresh_abc123...',
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