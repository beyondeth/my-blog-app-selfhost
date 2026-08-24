/**
 * OAuth 2.1 인증/토큰 엔드포인트
 *
 * - GET /oauth/authorize - 인증 페이지 (Backend로 리다이렉트)
 * - POST /oauth/token - 토큰 발급/갱신
 * - POST /oauth/revoke - 토큰 무효화
 *
 * PKCE (RFC 7636) 필수 - code_challenge/code_verifier
 * Resource Parameter (RFC 8707) 필수 - 토큰 audience 바인딩
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.validation.js';
import { OAuthStorage } from './storage.js';
import { OAuthErrorCodes } from './types.js';
import type {
  AuthorizationCode,
  AccessToken,
  RefreshToken,
  OAuthSession,
  TokenResponse,
  McpOAuthGrantClaims,
} from './types.js';

// 토큰 수명 설정
const TOKEN_LIFETIME = {
  ACCESS_TOKEN: 60 * 60,              // 1시간
  REFRESH_TOKEN: 60 * 60 * 24 * 30,   // 30일
  AUTH_CODE: 60 * 10,                 // 10분
};

/**
 * 서버 기본 URL
 */
function getServerUrl(): string {
  return normalizePublicBaseUrl(
    config.MCP_BASE_URL || `http://localhost:${config.MCP_PROXY_PORT}`
  );
}

function normalizePublicBaseUrl(value: string): string {
  const url = new URL(value);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  return url.toString().replace(/\/$/, '');
}

function getBackendGrantIssuer(): string {
  return `${normalizePublicBaseUrl(config.BACKEND_PUBLIC_URL)}/api/v1/auth/oauth/mcp`;
}

function getGrantCallbackUrl(): string {
  return `${getServerUrl()}/oauth/callback`;
}

function decodeGrantPart<T>(part: string): T {
  if (!part || part.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(part)) {
    throw new Error('Malformed authorization grant');
  }

  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

/**
 * Verify the Backend's compact HS256 authorization grant before any OAuth
 * session or authorization code is consumed.
 */
export function verifyMcpOAuthGrant(
  grant: string,
  secret: string | undefined,
  expected: {
    issuer: string;
    audience: string;
    callback: string;
    state: string;
    now?: number;
  }
): McpOAuthGrantClaims {
  if (!secret || secret.length < 16) {
    throw new Error('Authorization grant verification is not configured');
  }

  const parts = grant?.split('.') || [];
  if (parts.length !== 3) {
    throw new Error('Malformed authorization grant');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeGrantPart<{ alg?: string; typ?: string }>(encodedHeader);
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Unsupported authorization grant algorithm');
  }

  const providedSignature = Buffer.from(encodedSignature, 'base64url');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new Error('Invalid authorization grant signature');
  }

  const claims = decodeGrantPart<McpOAuthGrantClaims>(encodedPayload);
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  const stringClaims = [
    claims.iss,
    claims.aud,
    claims.sub,
    claims.state,
    claims.callback,
    claims.jti,
  ];

  if (
    stringClaims.some((value) => typeof value !== 'string' || value.length === 0) ||
    !Number.isInteger(claims.iat) ||
    !Number.isInteger(claims.exp)
  ) {
    throw new Error('Invalid authorization grant claims');
  }

  if (
    claims.iss !== expected.issuer ||
    claims.aud !== expected.audience ||
    claims.callback !== expected.callback ||
    claims.state !== expected.state
  ) {
    throw new Error('Authorization grant binding mismatch');
  }

  if (
    claims.iat > now + 5 ||
    claims.exp <= now ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > 60
  ) {
    throw new Error('Authorization grant expired or has invalid lifetime');
  }

  return claims;
}

/**
 * PKCE code_challenge 검증
 *
 * code_verifier를 SHA256 해시하여 code_challenge와 비교
 */
function verifyCodeChallenge(codeVerifier: string, codeChallenge: string): boolean {
  const hash = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return hash === codeChallenge;
}

export function isValidPkceRequest(
  codeChallenge: string | undefined,
  codeChallengeMethod: string | undefined
): boolean {
  return Boolean(codeChallenge) && codeChallengeMethod === 'S256';
}

/**
 * 인증 라우터 팩토리
 */
export function createAuthorizationRouter(storage: OAuthStorage): Router {
  const router = Router();

  /**
   * GET /oauth/authorize - 인증 시작
   *
   * Claude가 사용자를 이 URL로 리다이렉트
   * Backend의 로그인 페이지로 다시 리다이렉트
   *
   * 쿼리 파라미터:
   * - response_type: "code" (필수)
   * - client_id: 클라이언트 ID (필수)
   * - redirect_uri: 콜백 URL (필수)
   * - scope: 요청 스코프 (선택)
   * - state: CSRF 방지 토큰 (권장)
   * - code_challenge: PKCE challenge (필수)
   * - code_challenge_method: "S256" (필수)
   * - resource: 리소스 URI (RFC 8707, 권장)
   */
  router.get('/authorize', async (req: Request, res: Response) => {
    try {
      const {
        response_type,
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        resource,
      } = req.query as Record<string, string>;

      logger.debug({
        client_id,
        redirect_uri,
        scope,
        state: state?.substring(0, 8),
      }, '🔐 Authorization request');

      // 1. response_type 검증
      if (response_type !== 'code') {
        return res.redirect(
          `${redirect_uri}?error=${OAuthErrorCodes.UNSUPPORTED_RESPONSE_TYPE}&state=${state || ''}`
        );
      }

      // 2. 클라이언트 검증
      const client = await storage.getClient(client_id);
      if (!client) {
        logger.warn({ client_id }, '⚠️ Unknown client');
        return res.redirect(
          `${redirect_uri}?error=${OAuthErrorCodes.UNAUTHORIZED_CLIENT}&state=${state || ''}`
        );
      }

      // 3. redirect_uri 검증
      if (!client.redirectUris.includes(redirect_uri)) {
        logger.warn({ client_id, redirect_uri }, '⚠️ Invalid redirect_uri');
        return res.status(400).json({
          error: OAuthErrorCodes.INVALID_REQUEST,
          error_description: 'Invalid redirect_uri',
        });
      }

      // 4. PKCE 검증 (필수)
      if (!isValidPkceRequest(code_challenge, code_challenge_method)) {
        logger.warn({ client_id }, '⚠️ PKCE required');
        return res.redirect(
          `${redirect_uri}?error=${OAuthErrorCodes.INVALID_REQUEST}&error_description=PKCE%20required&state=${state || ''}`
        );
      }

      // 5. 리소스 파라미터 (RFC 8707)
      const resourceUri = resource || getServerUrl();

      // 6. 세션 저장 (state 검증용)
      const session: OAuthSession = {
        state: state || crypto.randomBytes(16).toString('hex'),
        clientId: client_id,
        redirectUri: redirect_uri,
        scope: scope || client.scope,
        codeChallenge: code_challenge,
        codeChallengeMethod: 'S256',
        resource: resourceUri,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + TOKEN_LIFETIME.AUTH_CODE * 1000),
      };
      await storage.saveSession(session);

      // 7. Backend 로그인 페이지로 리다이렉트
      // Backend에서 로그인 후 /oauth/callback으로 돌아옴
      // BACKEND_PUBLIC_URL 사용 (브라우저가 접근할 수 있는 공개 URL)
      const backendAuthUrl = new URL(`${config.BACKEND_PUBLIC_URL}/api/v1/auth/oauth/mcp/login`);
      backendAuthUrl.searchParams.set('state', session.state);
      backendAuthUrl.searchParams.set('client_name', client.clientName || 'MCP Client');
      backendAuthUrl.searchParams.set('scope', session.scope);

      logger.debug({ backendAuthUrl: backendAuthUrl.toString() }, '➡️ Redirecting to backend login');
      res.redirect(backendAuthUrl.toString());
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Authorization failed');
      res.status(500).json({
        error: OAuthErrorCodes.SERVER_ERROR,
        error_description: 'Authorization failed',
      });
    }
  });

  /**
   * GET /oauth/callback - Backend 로그인 후 콜백
   *
   * Backend에서 사용자 인증 후 이 URL로 리다이렉트
   * 인증 코드를 생성하여 Claude 콜백 URL로 전달
   *
   * 쿼리 파라미터:
   * - state: 세션 식별자
   * - grant: Backend가 서명한 60초 일회성 인증 결과
   * - error: 에러 코드 (실패 시)
   */
  router.get('/callback', async (req: Request, res: Response) => {
    try {
      const { state, grant, error: authError } = req.query as Record<string, string>;

      logger.debug({ state: state?.substring(0, 8) }, '🔙 OAuth callback');

      if (!state) {
        return res.status(400).json({
          error: OAuthErrorCodes.INVALID_REQUEST,
          error_description: 'Missing state',
        });
      }

      // Backend가 명시적으로 거절한 경우에만 세션을 소비하여 client로 전달
      if (authError) {
        const session = await storage.consumeSession(state);
        if (!session) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_REQUEST,
            error_description: 'Invalid or expired session',
          });
        }
        return res.redirect(
          `${session.redirectUri}?error=${authError}&state=${state}`
        );
      }

      if (!grant) {
        return res.status(400).json({
          error: OAuthErrorCodes.ACCESS_DENIED,
          error_description: 'Missing signed authorization grant',
        });
      }

      let claims: McpOAuthGrantClaims;
      try {
        claims = verifyMcpOAuthGrant(grant, config.MCP_SHARED_SECRET, {
          issuer: getBackendGrantIssuer(),
          audience: getServerUrl(),
          callback: getGrantCallbackUrl(),
          state,
        });
      } catch (error: any) {
        logger.warn({ reason: error.message }, '⚠️ Invalid MCP OAuth grant');
        return res.status(400).json({
          error: OAuthErrorCodes.ACCESS_DENIED,
          error_description: 'Invalid or expired authorization grant',
        });
      }

      // jti와 state 모두 일회성으로 소비한다.
      if (!(await storage.consumeGrantJti(claims.jti, claims.exp))) {
        return res.status(400).json({
          error: OAuthErrorCodes.ACCESS_DENIED,
          error_description: 'Authorization grant already used',
        });
      }

      const session = await storage.consumeSession(state);
      if (!session) {
        logger.warn({ state: state.substring(0, 8) }, '⚠️ Invalid or expired session');
        return res.status(400).json({
          error: OAuthErrorCodes.INVALID_REQUEST,
          error_description: 'Invalid or expired session',
        });
      }

      // 4. 인증 코드 생성
      const code = storage.generateToken('mcp_code', 32);
      const authCode: AuthorizationCode = {
        code,
        clientId: session.clientId,
        userId: claims.sub,
        redirectUri: session.redirectUri,
        scope: session.scope,
        codeChallenge: session.codeChallenge,
        codeChallengeMethod: session.codeChallengeMethod,
        resource: session.resource,
        expiresAt: new Date(Date.now() + TOKEN_LIFETIME.AUTH_CODE * 1000),
        createdAt: new Date(),
      };

      await storage.saveAuthorizationCode(authCode);

      // 5. Claude 콜백 URL로 리다이렉트
      const callbackUrl = new URL(session.redirectUri);
      callbackUrl.searchParams.set('code', code);
      callbackUrl.searchParams.set('state', state);

      logger.info({
        clientId: session.clientId,
        userId: claims.sub.substring(0, 8),
      }, '✅ Authorization code issued');

      res.redirect(callbackUrl.toString());
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Callback processing failed');
      res.status(500).json({
        error: OAuthErrorCodes.SERVER_ERROR,
        error_description: 'Callback processing failed',
      });
    }
  });

  /**
   * POST /oauth/token - 토큰 발급/갱신
   *
   * grant_type에 따라 동작:
   * - authorization_code: 인증 코드를 토큰으로 교환
   * - refresh_token: 리프레시 토큰으로 새 액세스 토큰 발급
   */
  router.post('/token', async (req: Request, res: Response) => {
    try {
      const {
        grant_type,
        code,
        redirect_uri,
        client_id,
        client_secret,
        code_verifier,
        refresh_token,
        resource,
      } = req.body;

      logger.debug({ grant_type, client_id }, '🎟️ Token request');

      // 클라이언트 인증
      let authenticatedClientId = client_id;

      // Basic Auth 지원
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.substring(6), 'base64').toString();
        const [id, secret] = decoded.split(':');
        authenticatedClientId = id;

        const client = await storage.getClient(id);
        if (!client || !(await storage.verifyClientSecret(id, secret))) {
          return res.status(401).json({
            error: OAuthErrorCodes.INVALID_CLIENT,
            error_description: 'Invalid client credentials',
          });
        }
      }
      // client_secret_post 방식
      else if (client_secret) {
        const client = await storage.getClient(client_id);
        if (!client || !(await storage.verifyClientSecret(client_id, client_secret))) {
          return res.status(401).json({
            error: OAuthErrorCodes.INVALID_CLIENT,
            error_description: 'Invalid client credentials',
          });
        }
      }

      // === authorization_code Grant ===
      if (grant_type === 'authorization_code') {
        // 인증 코드 조회 (일회성)
        const authCode = await storage.consumeAuthorizationCode(code);
        if (!authCode) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_GRANT,
            error_description: 'Invalid or expired authorization code',
          });
        }

        // 클라이언트 ID 검증
        if (authCode.clientId !== authenticatedClientId) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_GRANT,
            error_description: 'Client ID mismatch',
          });
        }

        // redirect_uri 검증
        if (authCode.redirectUri !== redirect_uri) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_GRANT,
            error_description: 'Redirect URI mismatch',
          });
        }

        // PKCE 검증 (필수)
        if (!code_verifier || !verifyCodeChallenge(code_verifier, authCode.codeChallenge)) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_GRANT,
            error_description: 'Invalid code_verifier',
          });
        }

        // 리소스 파라미터 검증 (RFC 8707)
        const requestedResource = resource || authCode.resource;
        if (resource && resource !== authCode.resource) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_REQUEST,
            error_description: 'Resource mismatch',
          });
        }

        // 액세스 토큰 생성
        const accessTokenValue = storage.generateToken('mcp_at', 32);
        const accessToken: AccessToken = {
          token: accessTokenValue,
          clientId: authCode.clientId,
          userId: authCode.userId,
          scope: authCode.scope,
          resource: requestedResource,
          expiresAt: new Date(Date.now() + TOKEN_LIFETIME.ACCESS_TOKEN * 1000),
          createdAt: new Date(),
        };
        await storage.saveAccessToken(accessToken);

        // 리프레시 토큰 생성
        const refreshTokenValue = storage.generateToken('mcp_rt', 32);
        const newRefreshToken: RefreshToken = {
          token: refreshTokenValue,
          clientId: authCode.clientId,
          userId: authCode.userId,
          scope: authCode.scope,
          resource: requestedResource,
          accessToken: accessTokenValue,
          expiresAt: new Date(Date.now() + TOKEN_LIFETIME.REFRESH_TOKEN * 1000),
          createdAt: new Date(),
        };
        await storage.saveRefreshToken(newRefreshToken);

        const response: TokenResponse = {
          access_token: accessTokenValue,
          token_type: 'Bearer',
          expires_in: TOKEN_LIFETIME.ACCESS_TOKEN,
          refresh_token: refreshTokenValue,
          scope: authCode.scope,
        };

        logger.info({
          clientId: authCode.clientId,
          userId: authCode.userId.substring(0, 8),
        }, '✅ Tokens issued (authorization_code)');

        return res.json(response);
      }

      // === refresh_token Grant ===
      if (grant_type === 'refresh_token') {
        if (!refresh_token) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_REQUEST,
            error_description: 'refresh_token required',
          });
        }

        // 리프레시 토큰 조회 및 삭제 (Rotation)
        const storedRefreshToken = await storage.consumeRefreshToken(refresh_token);
        if (!storedRefreshToken) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_GRANT,
            error_description: 'Invalid or expired refresh token',
          });
        }

        // 클라이언트 ID 검증
        if (storedRefreshToken.clientId !== authenticatedClientId) {
          return res.status(400).json({
            error: OAuthErrorCodes.INVALID_GRANT,
            error_description: 'Client ID mismatch',
          });
        }

        // 새 액세스 토큰 생성
        const newAccessTokenValue = storage.generateToken('mcp_at', 32);
        const newAccessToken: AccessToken = {
          token: newAccessTokenValue,
          clientId: storedRefreshToken.clientId,
          userId: storedRefreshToken.userId,
          scope: storedRefreshToken.scope,
          resource: storedRefreshToken.resource,
          expiresAt: new Date(Date.now() + TOKEN_LIFETIME.ACCESS_TOKEN * 1000),
          createdAt: new Date(),
        };
        await storage.saveAccessToken(newAccessToken);

        // 새 리프레시 토큰 생성 (Rotation)
        const newRefreshTokenValue = storage.generateToken('mcp_rt', 32);
        const rotatedRefreshToken: RefreshToken = {
          token: newRefreshTokenValue,
          clientId: storedRefreshToken.clientId,
          userId: storedRefreshToken.userId,
          scope: storedRefreshToken.scope,
          resource: storedRefreshToken.resource,
          accessToken: newAccessTokenValue,
          expiresAt: new Date(Date.now() + TOKEN_LIFETIME.REFRESH_TOKEN * 1000),
          createdAt: new Date(),
        };
        await storage.saveRefreshToken(rotatedRefreshToken);

        const response: TokenResponse = {
          access_token: newAccessTokenValue,
          token_type: 'Bearer',
          expires_in: TOKEN_LIFETIME.ACCESS_TOKEN,
          refresh_token: newRefreshTokenValue,
          scope: storedRefreshToken.scope,
        };

        logger.info({
          clientId: storedRefreshToken.clientId,
          userId: storedRefreshToken.userId.substring(0, 8),
        }, '✅ Tokens refreshed');

        return res.json(response);
      }

      // 지원하지 않는 grant_type
      return res.status(400).json({
        error: OAuthErrorCodes.UNSUPPORTED_GRANT_TYPE,
        error_description: `Unsupported grant_type: ${grant_type}`,
      });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Token request failed');
      res.status(500).json({
        error: OAuthErrorCodes.SERVER_ERROR,
        error_description: 'Token request failed',
      });
    }
  });

  /**
   * POST /oauth/revoke - 토큰 무효화
   *
   * 로그아웃 또는 연결 해제 시 사용
   */
  router.post('/revoke', async (req: Request, res: Response) => {
    try {
      const { token, token_type_hint } = req.body;

      if (!token) {
        return res.status(400).json({
          error: OAuthErrorCodes.INVALID_REQUEST,
          error_description: 'token required',
        });
      }

      // 토큰 유형에 따라 삭제 시도
      // 힌트가 없으면 둘 다 시도
      if (!token_type_hint || token_type_hint === 'access_token') {
        await storage.revokeAccessToken(token);
      }

      if (!token_type_hint || token_type_hint === 'refresh_token') {
        // 리프레시 토큰은 consume과 동일하게 처리
        await storage.consumeRefreshToken(token);
      }

      logger.debug('🗑️ Token revoked');

      // RFC 7009: 항상 200 OK 반환 (토큰이 없어도)
      res.status(200).send();
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Token revocation failed');
      res.status(500).json({
        error: OAuthErrorCodes.SERVER_ERROR,
        error_description: 'Token revocation failed',
      });
    }
  });

  return router;
}
