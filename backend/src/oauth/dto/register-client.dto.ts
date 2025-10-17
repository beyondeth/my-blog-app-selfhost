import { IsString, IsArray, IsOptional, IsIn, ArrayNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Dynamic Client Registration DTO (RFC 7591)
 *
 * MCP 클라이언트가 자동으로 등록하기 위한 요청 데이터
 */
export class RegisterClientDto {
  /**
   * 클라이언트 이름
   * 사용자에게 표시될 친근한 이름
   */
  @ApiProperty({
    description: '클라이언트 애플리케이션 이름',
    example: 'MCP Blog Client',
  })
  @IsString()
  client_name: string;

  /**
   * 허용된 리다이렉트 URI 목록
   * Authorization Code를 받을 URI
   *
   * MCP 표준: localhost 또는 loopback 주소 허용
   */
  @ApiProperty({
    description: '리다이렉트 URI 목록 (Authorization Code 수신용)',
    example: ['http://localhost:8080/callback', 'http://127.0.0.1:8080/callback'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ require_tld: false }, { each: true })  // localhost 허용
  redirect_uris: string[];

  /**
   * 지원하는 Grant Type 목록
   * MCP는 authorization_code와 refresh_token 사용
   */
  @ApiProperty({
    description: 'OAuth 2.0 Grant Type 목록',
    example: ['authorization_code', 'refresh_token'],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @IsIn(['authorization_code', 'refresh_token'], { each: true })
  grant_types?: string[];

  /**
   * 지원하는 Response Type 목록
   * MCP는 code만 사용 (Authorization Code Flow)
   */
  @ApiProperty({
    description: 'OAuth 2.0 Response Type 목록',
    example: ['code'],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @IsIn(['code'], { each: true })
  response_types?: string[];

  /**
   * Token Endpoint 인증 방법
   * - 'none': Public Client (client_secret 불필요, PKCE 필수)
   * - 'client_secret_post': Confidential Client
   * - 'client_secret_basic': Confidential Client
   *
   * MCP 권장: 'none' (Public Client)
   */
  @ApiProperty({
    description: 'Token Endpoint 인증 방법',
    example: 'none',
    enum: ['none', 'client_secret_post', 'client_secret_basic'],
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsIn(['none', 'client_secret_post', 'client_secret_basic'])
  token_endpoint_auth_method?: string;

  /**
   * 요청하는 스코프
   * MCP는 'mcp:post:create'만 필요
   */
  @ApiProperty({
    description: '요청하는 권한 스코프 (공백으로 구분)',
    example: 'mcp:post:create',
    required: false,
  })
  @IsString()
  @IsOptional()
  scope?: string;

  /**
   * 클라이언트 설명 (선택적)
   */
  @ApiProperty({
    description: '클라이언트 설명',
    example: 'MCP client for automated blog posting',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
