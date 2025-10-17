import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';

/**
 * OAuth 2.0 Discovery 컨트롤러
 *
 * MCP (Model Context Protocol) 표준을 준수하기 위해
 * RFC 9728 (Protected Resource Metadata)와
 * RFC 8414 (Authorization Server Metadata)를 구현합니다.
 *
 * 이를 통해 MCP 클라이언트가 Authorization Server를 자동으로 발견하고
 * Dynamic Client Registration을 수행할 수 있습니다.
 */
@ApiTags('OAuth2 Discovery')
@Controller('.well-known')
export class DiscoveryController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Protected Resource Metadata (RFC 9728)
   *
   * MCP 서버(Resource Server)가 어떤 Authorization Server를 사용하는지,
   * 어떤 스코프를 지원하는지 등의 메타데이터를 제공합니다.
   *
   * MCP 클라이언트는 이 엔드포인트를 먼저 호출하여
   * Authorization Server 정보를 발견합니다.
   *
   * @returns Protected Resource Metadata
   */
  @Public()
  @Get('oauth-protected-resource')
  @ApiOperation({
    summary: 'Protected Resource Metadata (RFC 9728)',
    description: 'MCP 서버의 Authorization Server 정보를 제공합니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'Protected Resource Metadata 반환 성공',
    schema: {
      example: {
        resource: 'http://localhost:3000',
        authorization_servers: ['http://localhost:3000/api/v1/oauth'],
        scopes_supported: ['mcp:post:create'],
        bearer_methods_supported: ['header'],
        resource_signing_alg_values_supported: ['RS256'],
      },
    },
  })
  async getProtectedResourceMetadata() {
    // Backend 공개 URL (브라우저에서 접근 가능한 URL)
    const backendPublicUrl = this.configService.get<string>(
      'BACKEND_PUBLIC_URL',
      'http://localhost:3000',
    );

    // OAuth Authorization Server URL (일반적으로 Backend URL과 동일)
    const authServerUrl = `${backendPublicUrl}/api/v1/oauth`;

    return {
      /**
       * 이 Resource Server의 고유 식별자 (URI 형식)
       * Access Token의 audience (aud) claim과 일치해야 합니다.
       */
      resource: backendPublicUrl,

      /**
       * 이 Resource Server를 인증할 수 있는 Authorization Server 목록
       * MCP 클라이언트는 이 URL에서 Authorization Server Metadata를 조회합니다.
       */
      authorization_servers: [authServerUrl],

      /**
       * 이 Resource Server가 지원하는 스코프 목록
       * MCP는 포스트 생성 권한만 필요합니다.
       */
      scopes_supported: ['mcp:post:create'],

      /**
       * Bearer Token을 전달할 수 있는 방법
       * MCP 표준: Authorization 헤더만 허용 (URL 파라미터 금지)
       */
      bearer_methods_supported: ['header'],

      /**
       * Access Token 서명에 사용되는 알고리즘
       * JWT의 경우 RS256 또는 HS256 사용
       */
      resource_signing_alg_values_supported: ['RS256'],
    };
  }

  /**
   * Authorization Server Metadata (RFC 8414)
   *
   * Authorization Server가 제공하는 OAuth 2.0 엔드포인트와
   * 지원하는 기능(PKCE, DCR 등)을 명시합니다.
   *
   * MCP 클라이언트는 Protected Resource Metadata에서 얻은
   * Authorization Server URL을 통해 이 엔드포인트를 호출합니다.
   *
   * @returns Authorization Server Metadata
   */
  @Public()
  @Get('oauth-authorization-server')
  @ApiOperation({
    summary: 'Authorization Server Metadata (RFC 8414)',
    description: 'OAuth 2.0 Authorization Server의 메타데이터를 제공합니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization Server Metadata 반환 성공',
    schema: {
      example: {
        issuer: 'http://localhost:3000/api/v1/oauth',
        authorization_endpoint: 'http://localhost:3000/api/v1/oauth/authorize',
        token_endpoint: 'http://localhost:3000/api/v1/oauth/token',
        registration_endpoint: 'http://localhost:3000/api/v1/oauth/register',
        introspection_endpoint: 'http://localhost:3000/api/v1/oauth/introspect',
        revocation_endpoint: 'http://localhost:3000/api/v1/oauth/revoke',
        scopes_supported: ['mcp:post:create'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: [
          'none',
          'client_secret_post',
          'client_secret_basic',
        ],
      },
    },
  })
  async getAuthorizationServerMetadata() {
    // Backend 공개 URL
    const backendPublicUrl = this.configService.get<string>(
      'BACKEND_PUBLIC_URL',
      'http://localhost:3000',
    );

    // OAuth 엔드포인트 Base URL
    const oauthBaseUrl = `${backendPublicUrl}/api/v1/oauth`;

    return {
      /**
       * Authorization Server의 고유 식별자 (Issuer)
       * JWT의 iss claim과 일치해야 합니다.
       */
      issuer: oauthBaseUrl,

      /**
       * Authorization Code를 받기 위한 엔드포인트
       * 사용자가 브라우저에서 권한 부여를 승인하는 페이지
       */
      authorization_endpoint: `${oauthBaseUrl}/authorize`,

      /**
       * Authorization Code를 Access Token으로 교환하는 엔드포인트
       * 또는 Refresh Token을 사용하여 새 Access Token을 발급받는 엔드포인트
       */
      token_endpoint: `${oauthBaseUrl}/token`,

      /**
       * Dynamic Client Registration (RFC 7591) 엔드포인트
       * MCP 클라이언트가 자동으로 등록할 수 있습니다.
       * ✅ Phase 2에서 구현 예정
       */
      registration_endpoint: `${oauthBaseUrl}/register`,

      /**
       * Token Introspection (RFC 7662) 엔드포인트
       * Access Token의 유효성과 정보를 조회합니다.
       */
      introspection_endpoint: `${oauthBaseUrl}/introspect`,

      /**
       * Token Revocation (RFC 7009) 엔드포인트
       * Access Token 또는 Refresh Token을 취소합니다.
       */
      revocation_endpoint: `${oauthBaseUrl}/revoke`,

      /**
       * 지원하는 스코프 목록
       * MCP는 포스트 생성 권한만 필요합니다.
       */
      scopes_supported: ['mcp:post:create'],

      /**
       * 지원하는 OAuth 2.0 Response Type
       * MCP는 Authorization Code Flow만 사용합니다.
       */
      response_types_supported: ['code'],

      /**
       * 지원하는 OAuth 2.0 Grant Type
       * - authorization_code: 기본 Authorization Code Flow
       * - refresh_token: Refresh Token을 사용한 토큰 갱신
       */
      grant_types_supported: ['authorization_code', 'refresh_token'],

      /**
       * 지원하는 PKCE Code Challenge Method
       * MCP 표준: S256 (SHA-256) 필수
       * plain은 보안상 취약하므로 지원하지 않습니다.
       */
      code_challenge_methods_supported: ['S256'],

      /**
       * Token Endpoint에서 지원하는 클라이언트 인증 방법
       * - none: Public Client (client_secret 없음, PKCE 사용)
       * - client_secret_post: POST body에 client_secret 포함
       * - client_secret_basic: Basic Auth 헤더에 client_secret 포함
       */
      token_endpoint_auth_methods_supported: [
        'none', // ✅ MCP 표준: Public Client 지원 (PKCE로 보안 보장)
        'client_secret_post', // 기존 호환성 유지
        'client_secret_basic', // 기존 호환성 유지
      ],

      /**
       * 추가 메타데이터 (선택적)
       */
      service_documentation: `${backendPublicUrl}/docs/oauth`,
      ui_locales_supported: ['ko', 'en'],
    };
  }
}
