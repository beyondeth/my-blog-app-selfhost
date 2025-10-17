/**
 * OAuth 콜백 라우트 및 Discovery 엔드포인트
 *
 * - OAuth Provider가 리디렉션하는 엔드포인트
 * - OAuth Discovery 엔드포인트 (.well-known)
 * - RFC 8414 (Authorization Server Metadata) 표준 준수
 * - RFC 9728 (Protected Resource Metadata) 표준 준수
 * - MCP 표준 준수
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from '../config/env.validation.js';

// ES Module에서 __dirname 생성
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createOAuthRoutes(): Router {
  const router = Router();

  /**
   * 동적 Base URL 헬퍼 함수
   * 환경별로 자동으로 올바른 URL 반환
   */
  const getBaseUrl = (): string => config.MCP_BASE_URL;

  /**
   * OAuth 콜백 웹페이지
   * GET /oauth/callback
   *
   * OAuth Provider (Google, GitHub, Kakao 등)가 인증 완료 후 리디렉션하는 엔드포인트
   * 정적 HTML 파일을 제공하여 클라이언트 측에서 안전하게 토큰 교환 요청 수행
   *
   * 프로덕션 환경에서 여러 사용자가 동시에 인증할 수 있도록 설계됨
   */
  router.get('/oauth/callback', (_req: Request, res: Response) => {
    // 정적 HTML 파일 제공 (XSS/템플릿 주입 방지)
    const htmlPath = path.join(__dirname, '../../public/oauth-callback.html');
    res.sendFile(htmlPath);
  });

  /**
   * MCP OAuth Discovery (MCP 표준)
   * GET /.well-known/mcp-oauth-discovery
   *
   * Claude Code의 MCP SDK가 찾는 표준 OAuth discovery 엔드포인트
   * MCP 서버가 OAuth를 지원한다는 것을 알려주고 인증 서버 정보 제공
   */
  router.get('/.well-known/mcp-oauth-discovery', (_req: Request, res: Response) => {
    res.json({
      oauth_authorization_server: '/.well-known/oauth-authorization-server',
    });
  });

  /**
   * RFC 9728: OAuth 2.0 Protected Resource Metadata
   * GET /.well-known/oauth-protected-resource
   *
   * 표준 엔드포인트 (RFC 9728 준수) - 올바른 경로명 사용!
   * 에이전트가 인증되지 않은 요청 시 401 응답의 WWW-Authenticate 헤더에서 이 URL을 받아 접근
   */
  router.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
    const baseUrl = getBaseUrl();

    res.json({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      scopes_supported: ['mcp:post:create'],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://github.com/yourusername/mcp-blog-server',
    });
  });

  /**
   * RFC 8414: OAuth 2.0 Authorization Server Metadata
   * GET /.well-known/oauth-authorization-server
   *
   * 인증 서버 설정 정보 제공 (RFC 8414 표준 준수)
   * OAuth2 PKCE 플로우를 위한 엔드포인트 및 지원 기능 명시
   *
   * 프록시 서버 자체를 OAuth 서버로 제공하고, 내부적으로 백엔드로 프록시
   */
  router.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    const baseUrl = getBaseUrl();

    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/v1/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/v1/oauth/token`,
      registration_endpoint: `${baseUrl}/api/v1/oauth/register`, // SDK 호환성을 위해 URL만 제공 (실제로는 정적 클라이언트 사용)
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['mcp:post:create'],
      token_introspection_endpoint: `${baseUrl}/api/v1/oauth/introspect`,
      token_revocation_endpoint: `${baseUrl}/api/v1/oauth/revoke`, // ✅ MCP 표준: revocation_endpoint → token_revocation_endpoint
      token_endpoint_auth_methods_supported: ['none'],
      service_documentation: 'https://github.com/yourusername/mcp-blog-server',
      ui_locales_supported: ['en', 'ko'],
    });
  });

  return router;
}
