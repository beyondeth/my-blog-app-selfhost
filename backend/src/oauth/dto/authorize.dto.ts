import { IsString, IsOptional, IsEnum, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * OAuth 인증 요청 DTO
 */
export class AuthorizeDto {
  @ApiProperty({
    description: '응답 타입 (code만 지원)',
    example: 'code',
  })
  @IsString()
  @IsEnum(['code'])
  response_type: string;

  @ApiProperty({
    description: 'OAuth 클라이언트 ID',
    example: 'mcp_1234567890abcdef',
  })
  @IsString()
  client_id: string;

  @ApiProperty({
    description: '인증 후 리다이렉트될 URI',
    example: 'http://localhost:8080/callback',
  })
  @IsString()
  @Matches(
    /^https?:\/\/.+$/,
    { message: 'redirect_uri must be a valid HTTP(S) URL' }
  )
  redirect_uri: string;

  @ApiProperty({
    description: '요청할 권한 스코프 (공백으로 구분)',
    example: 'mcp:post:create',
    required: false,
  })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiProperty({
    description: 'CSRF 방지를 위한 상태값',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'PKCE code challenge',
    required: false,
  })
  @IsOptional()
  @IsString()
  code_challenge?: string;

  @ApiProperty({
    description: 'PKCE code challenge method (S256)',
    required: false,
  })
  @IsOptional()
  @IsEnum(['S256', 'plain'])
  code_challenge_method?: string;

  @ApiProperty({
    description: '계정 전환 플래그',
    required: false,
  })
  @IsOptional()
  @IsString()
  switch_account?: string;

  @ApiProperty({
    description: 'RFC 8707 Resource Indicator (MCP 서버 식별자)',
    example: 'http://localhost:3002',
    required: false,
  })
  @IsOptional()
  @IsString()
  resource?: string;
}