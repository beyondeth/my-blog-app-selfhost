import { IsString, IsEnum, IsUrl, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 토큰 교환 요청 DTO (Authorization Code)
 */
export class TokenExchangeDto {
  @ApiProperty({
    description: 'Grant 타입',
    example: 'authorization_code',
  })
  @IsEnum(['authorization_code'])
  grant_type: 'authorization_code';

  @ApiProperty({
    description: '인증 코드',
    example: 'abc123def456...',
  })
  @IsString()
  code: string;

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

  @ApiProperty({
    description: '리다이렉트 URI (인증시 사용한 것과 동일해야 함)',
    example: 'http://localhost:8080/callback',
  })
  @IsString()
  redirect_uri: string;

  @ApiProperty({
    description: 'PKCE code verifier',
    required: false,
  })
  @IsOptional()
  @IsString()
  code_verifier?: string;
}