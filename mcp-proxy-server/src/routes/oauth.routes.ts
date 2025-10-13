/**
 * OAuth 콜백 라우트 및 Discovery 엔드포인트
 *
 * - OAuth Provider가 리디렉션하는 엔드포인트
 * - OAuth Discovery 엔드포인트 (.well-known)
 * - MCP 표준 준수
 */

import { Router } from 'express';
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
   * OAuth 콜백 웹페이지
   * GET /oauth/callback
   *
   * OAuth Provider (Google, GitHub, Kakao 등)가 인증 완료 후 리디렉션하는 엔드포인트
   * 정적 HTML 파일을 제공하여 클라이언트 측에서 안전하게 토큰 교환 요청 수행
   *
   * 프로덕션 환경에서 여러 사용자가 동시에 인증할 수 있도록 설계됨
   */
  router.get('/oauth/callback', (req, res) => {
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
  router.get('/.well-known/mcp-oauth-discovery', (req, res) => {
    res.json({
      oauth_authorization_server: '/.well-known/oauth-authorization-server',
    });
  });

  /**
   * OAuth Protected Resource Discovery
   * GET /.well-known/oauth-protected-resource
   *
   * MCP 표준에 따른 보호된 리소스 정보 제공
   * LLM이 이 엔드포인트를 통해 OAuth 서버 정보를 자동으로 발견할 수 있음
   */
  router.get('/.well-known/oauth-protected-resource', (req, res) => {
    res.json({
      resource: 'MCP Blog Server',
      oauth_authorization_server: '/.well-known/oauth-authorization-server',
      scopes_supported: ['mcp:post:create'],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://github.com/yourusername/mcp-blog-server',
      resource_signing_alg_values_supported: ['RS256'],
    });
  });

  /**
   * OAuth Authorization Server Discovery
   * GET /.well-known/oauth-authorization-server
   *
   * MCP 표준에 따른 인증 서버 설정 정보 제공
   * OAuth2 PKCE 플로우를 위한 엔드포인트 및 지원 기능 명시
   *
   * 프록시 서버 자체를 OAuth 서버로 제공하고, 내부적으로 백엔드로 프록시
   */
  router.get('/.well-known/oauth-authorization-server', (req, res) => {
    const proxyBaseUrl = `http://localhost:${config.PORT}`;

    res.json({
      issuer: proxyBaseUrl,
      authorization_endpoint: `${proxyBaseUrl}/api/v1/oauth/authorize`,
      token_endpoint: `${proxyBaseUrl}/api/v1/oauth/token`,
      registration_endpoint: `${proxyBaseUrl}/api/v1/oauth/register`,
      revocation_endpoint: `${proxyBaseUrl}/api/v1/oauth/revoke`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp:post:create'],
      service_documentation: 'https://github.com/yourusername/mcp-blog-server',
      ui_locales_supported: ['en', 'ko'],
    });
  });

  return router;
}
