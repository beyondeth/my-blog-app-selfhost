/**
 * OAuth 메타데이터 엔드포인트
 *
 * RFC 8414 - Authorization Server Metadata
 * RFC 9728 - Protected Resource Metadata
 *
 * Claude 커스텀 커넥터가 서버를 발견하고 연결하는 데 사용
 */

import { Router, type Request } from 'express';
import { config } from '../config/env.validation.js';
import type { AuthorizationServerMetadata, ProtectedResourceMetadata } from './types.js';

const router = Router();

/**
 * 서버 기본 URL 가져오기
 * - 개발: http://localhost:3002
 * - 프로덕션: 설치자가 지정한 MCP_BASE_URL
 */
function getServerUrl(req?: Request): string {
  const forwardedProto = ((req?.headers['x-forwarded-proto'] as string) || '')
    .split(',')[0]
    ?.trim();
  const forwardedHost = ((req?.headers['x-forwarded-host'] as string) || '')
    .split(',')[0]
    ?.trim();
  const requestHost = forwardedHost || req?.headers.host || '';
  if (requestHost) {
    const proto = forwardedProto || req?.protocol || 'http';
    return `${proto}://${requestHost}`;
  }
  return config.MCP_BASE_URL || `http://localhost:${config.MCP_PROXY_PORT}`;
}

/**
 * RFC 9728 - Protected Resource Metadata
 *
 * GET /.well-known/oauth-protected-resource
 *
 * MCP 서버가 보호된 리소스임을 선언하고,
 * 사용해야 할 인증 서버 정보를 제공
 *
 * Claude는 이 엔드포인트를 먼저 호출하여
 * 어떤 인증 서버를 사용해야 하는지 확인
 */
function buildProtectedResourceMetadata(serverUrl: string): ProtectedResourceMetadata {
  return {
    // 리소스 식별자 (RFC 8707에서 토큰 요청 시 사용)
    resource: serverUrl,

    // 이 리소스를 보호하는 인증 서버 목록
    // (MCP 서버 자체가 인증 서버 역할도 함)
    authorization_servers: [serverUrl],

    // 지원하는 Bearer 토큰 전달 방식
    bearer_methods_supported: ['header'],

    // 문서 URL
    resource_documentation: `${config.PUBLIC_SITE_URL}/docs/mcp-oauth`,
  };
}

function buildAuthorizationServerMetadata(serverUrl: string): AuthorizationServerMetadata {
  return {
    // 발급자 식별자 (토큰의 iss 클레임과 일치해야 함)
    issuer: serverUrl,

    // OAuth 엔드포인트
    authorization_endpoint: `${serverUrl}/oauth/authorize`,
    token_endpoint: `${serverUrl}/oauth/token`,
    registration_endpoint: `${serverUrl}/oauth/register`,
    revocation_endpoint: `${serverUrl}/oauth/revoke`,

    // 지원하는 응답 타입
    response_types_supported: ['code'],  // Authorization Code Flow만 지원

    // 지원하는 응답 모드
    response_modes_supported: ['query'],  // 쿼리 파라미터로 응답

    // 지원하는 Grant 타입
    grant_types_supported: [
      'authorization_code',
      'refresh_token',
    ],

    // 토큰 엔드포인트 인증 방식
    // Claude는 client_secret_post 사용
    token_endpoint_auth_methods_supported: [
      'none',                 // 공개 클라이언트 (PKCE 필수)
      'client_secret_post',   // 시크릿을 body에 포함
      'client_secret_basic',  // 시크릿을 Authorization 헤더에 포함
    ],

    // 지원하는 스코프
    scopes_supported: [
      'mcp:tools',      // MCP 도구 사용 권한
      'mcp:read',       // 읽기 전용
      'mcp:write',      // 쓰기 권한
      'mcp:create',     // 게시물 생성 권한 (자동 포스팅)
    ],

    // PKCE 지원 (필수)
    // Claude는 S256만 사용
    code_challenge_methods_supported: ['S256'],

    // 서비스 정보
    service_documentation: `${config.PUBLIC_SITE_URL}/docs/mcp`,
    op_policy_uri: `${config.PUBLIC_SITE_URL}/legal/privacy`,
    op_tos_uri: `${config.PUBLIC_SITE_URL}/legal/terms`,

    // UI 로케일
    ui_locales_supported: ['en', 'ko'],
  };
}

router.get('/oauth-protected-resource', (req, res) => {
  const serverUrl = getServerUrl(req);
  res.json(buildProtectedResourceMetadata(serverUrl));
});

// 일부 클라이언트는 resource path suffix를 붙여 조회한다.
router.get('/oauth-protected-resource/*path', (req, res) => {
  const serverUrl = getServerUrl(req);
  res.json(buildProtectedResourceMetadata(serverUrl));
});

/**
 * RFC 8414 - Authorization Server Metadata
 *
 * GET /.well-known/oauth-authorization-server
 *
 * 인증 서버의 모든 엔드포인트와 지원 기능을 선언
 * Claude는 이 정보를 바탕으로 OAuth 흐름 수행
 */
router.get('/oauth-authorization-server', (req, res) => {
  const serverUrl = getServerUrl(req);
  res.json(buildAuthorizationServerMetadata(serverUrl));
});

// 일부 MCP 클라이언트는 suffix path를 붙여 metadata를 조회한다.
router.get('/oauth-authorization-server/*path', (req, res) => {
  const serverUrl = getServerUrl(req);
  res.json(buildAuthorizationServerMetadata(serverUrl));
});

// OpenAI SDK/aiohttp 계열 클라이언트 호환: OpenID metadata 조회 대응
router.get('/openid-configuration', (req, res) => {
  const serverUrl = getServerUrl(req);
  res.json(buildAuthorizationServerMetadata(serverUrl));
});
router.get('/openid-configuration/*path', (req, res) => {
  const serverUrl = getServerUrl(req);
  res.json(buildAuthorizationServerMetadata(serverUrl));
});

/**
 * 401 Unauthorized 응답 시 WWW-Authenticate 헤더 생성 헬퍼
 *
 * MCP 스펙에 따라 토큰이 필요할 때 메타데이터 URL 제공
 */
export function getWWWAuthenticateHeader(
  req?: Request,
  options?: {
    error?: 'invalid_token' | 'insufficient_scope' | 'invalid_request';
    errorDescription?: string;
  }
): string {
  const serverUrl = getServerUrl(req);
  const resourceMetadataUrl = `${serverUrl}/.well-known/oauth-protected-resource`;

  // RFC 9728 형식
  const parts = [`Bearer resource_metadata="${resourceMetadataUrl}"`];

  if (options?.error) {
    parts.push(`error="${options.error}"`);
  }
  if (options?.errorDescription) {
    const escaped = options.errorDescription.replace(/"/g, '\\"');
    parts.push(`error_description="${escaped}"`);
  }

  return parts.join(', ');
}

export default router;
