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
import { normalizeLegacyScope } from './scope-normalization.js';
import type {
  AuthorizationCode,
  AccessToken,
  RefreshToken,
  OAuthSession,
  TokenResponse,
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
  return config.MCP_BASE_URL || `http://localhost:${config.MCP_PROXY_PORT}`;
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
        prompt,
      } = req.query as Record<string, string>;

      logger.debug({
        client_id,
        redirect_uri,
        scope,
        state: state?.substring(0, 8),
        prompt,
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
      if (!code_challenge || code_challenge_method !== 'S256') {
        logger.warn({ client_id }, '⚠️ PKCE required');
        return res.redirect(
          `${redirect_uri}?error=${OAuthErrorCodes.INVALID_REQUEST}&error_description=PKCE%20required&state=${state || ''}`
        );
      }

      // 5. 리소스 파라미터 (RFC 8707)
      const resourceUri = resource || getServerUrl();

      // 6. 세션 저장 (state 검증용)
      const normalizedScope = normalizeLegacyScope(scope || client.scope);

      const session: OAuthSession = {
        state: state || crypto.randomBytes(16).toString('hex'),
        clientId: client_id,
        redirectUri: redirect_uri,
        scope: normalizedScope,
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
      backendAuthUrl.searchParams.set('callback_url', `${getServerUrl()}/oauth/callback`);
      // prompt=login 요청이 들어오면 브라우저 기존 세션을 무시하고 재로그인을 강제한다.
      // OpenAI/기타 OAuth 클라이언트에서 계정 전환 UX를 구현할 때 사용한다.
      const forceLogin = prompt
        ?.split(' ')
        .map((value) => value.trim().toLowerCase())
        .includes('login');
      if (forceLogin) {
        backendAuthUrl.searchParams.set('force_login', '1');
      }

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
   * - user_id: 인증된 사용자 ID (Backend에서 전달)
   * - error: 에러 코드 (실패 시)
   */
  router.get('/callback', async (req: Request, res: Response) => {
    try {
      const { state, user_id, error: authError } = req.query as Record<string, string>;

      logger.debug({ state: state?.substring(0, 8), user_id: user_id?.substring(0, 8) }, '🔙 OAuth callback');

      // 1. 세션 조회 및 삭제 (일회성)
      const session = await storage.consumeSession(state);
      if (!session) {
        logger.warn({ state: state?.substring(0, 8) }, '⚠️ Invalid or expired session');
        return res.status(400).json({
          error: OAuthErrorCodes.INVALID_REQUEST,
          error_description: 'Invalid or expired session',
        });
      }

      // 2. 인증 에러 처리
      if (authError) {
        return res.redirect(
          `${session.redirectUri}?error=${authError}&state=${state}`
        );
      }

      // 3. 사용자 ID 필수
      if (!user_id) {
        logger.warn('⚠️ Missing user_id in callback');
        return res.redirect(
          `${session.redirectUri}?error=${OAuthErrorCodes.ACCESS_DENIED}&state=${state}`
        );
      }

      // 4. 인증 코드 생성
      const code = storage.generateToken('mcp_code', 32);
      const authCode: AuthorizationCode = {
        code,
        clientId: session.clientId,
        userId: user_id,
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
        userId: user_id.substring(0, 8),
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
        const normalizedScope = normalizeLegacyScope(authCode.scope);

        const accessToken: AccessToken = {
          token: accessTokenValue,
          clientId: authCode.clientId,
          userId: authCode.userId,
          scope: normalizedScope,
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
          scope: normalizedScope,
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
          scope: normalizedScope,
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
        const normalizedScope = normalizeLegacyScope(storedRefreshToken.scope);

        const newAccessToken: AccessToken = {
          token: newAccessTokenValue,
          clientId: storedRefreshToken.clientId,
          userId: storedRefreshToken.userId,
          scope: normalizedScope,
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
          scope: normalizedScope,
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
          scope: normalizedScope,
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
