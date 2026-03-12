/**
 * RFC 7591 - 동적 클라이언트 등록 (DCR)
 *
 * Claude 커스텀 커넥터가 서버에 연결할 때
 * 자동으로 OAuth 클라이언트를 등록
 *
 * 흐름:
 * 1. Claude가 POST /oauth/register 호출
 * 2. 서버가 client_id, client_secret 발급
 * 3. Claude가 이 자격증명으로 OAuth 흐름 수행
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { OAuthStorage } from './storage.js';
import type {
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  StoredClient,
} from './types.js';
import { OAuthErrorCodes } from './types.js';
import { normalizeLegacyScope } from './scope-normalization.js';

const router = Router();

// 허용된 redirect URI 패턴 (Claude, ChatGPT, Perplexity, OpenAI review)
const ALLOWED_REDIRECT_PATTERNS = [
  /^https:\/\/claude\.ai\/api\/mcp\/auth_callback(?:\/.*)?$/, // Claude 프로덕션
  /^https:\/\/.*\.claude\.ai\/api\/mcp\/auth_callback(?:\/.*)?$/, // Claude 서브도메인
  /^https:\/\/chatgpt\.com\/connector\/oauth\/[^/]+$/, // ChatGPT connector callback
  /^https:\/\/(?:[a-z0-9-]+\.)?perplexity\.(?:ai|com)\/rest\/connections\/oauth_callback(?:\/.*)?$/, // Perplexity connector callback
  /^https:\/\/platform\.openai\.com\/apps-manage\/oauth$/, // OpenAI app review callback
  /^http:\/\/localhost(?::\d+)?\/.+$/, // 로컬 개발
  /^http:\/\/127\.0\.0\.1(?::\d+)?\/.+$/, // 로컬 개발
];

/**
 * Redirect URI 검증
 */
function validateRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);

    // HTTPS 필수 (localhost 제외)
    if (url.protocol !== 'https:' && !url.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
      return false;
    }

    // 허용된 패턴 확인
    return ALLOWED_REDIRECT_PATTERNS.some(pattern => pattern.test(uri));
  } catch {
    return false;
  }
}

/**
 * 클라이언트 등록 요청 검증
 */
function validateRegistrationRequest(body: any): {
  valid: boolean;
  error?: string;
  data?: ClientRegistrationRequest;
} {
  // redirect_uris 필수
  if (!body.redirect_uris || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return {
      valid: false,
      error: 'redirect_uris is required and must be a non-empty array',
    };
  }

  // 각 redirect_uri 검증
  for (const uri of body.redirect_uris) {
    if (typeof uri !== 'string' || !validateRedirectUri(uri)) {
      return {
        valid: false,
        error: `Invalid redirect_uri: ${uri}`,
      };
    }
  }

  // grant_types 검증 (지정된 경우)
  if (body.grant_types) {
    const allowedGrantTypes = ['authorization_code', 'refresh_token'];
    for (const grantType of body.grant_types) {
      if (!allowedGrantTypes.includes(grantType)) {
        return {
          valid: false,
          error: `Unsupported grant_type: ${grantType}`,
        };
      }
    }
  }

  // response_types 검증 (지정된 경우)
  if (body.response_types) {
    for (const responseType of body.response_types) {
      if (responseType !== 'code') {
        return {
          valid: false,
          error: `Unsupported response_type: ${responseType}`,
        };
      }
    }
  }

  // token_endpoint_auth_method 검증 (지정된 경우)
  if (body.token_endpoint_auth_method) {
    const allowedMethods = ['none', 'client_secret_post', 'client_secret_basic'];
    if (!allowedMethods.includes(body.token_endpoint_auth_method)) {
      return {
        valid: false,
        error: `Unsupported token_endpoint_auth_method: ${body.token_endpoint_auth_method}`,
      };
    }
  }

  return {
    valid: true,
    data: body as ClientRegistrationRequest,
  };
}

/**
 * 동적 클라이언트 등록 라우터 팩토리
 */
export function createClientRegistrationRouter(storage: OAuthStorage): Router {
  /**
   * POST /oauth/register - 동적 클라이언트 등록
   *
   * Claude가 커스텀 커넥터 추가 시 자동 호출
   *
   * 요청:
   * {
   *   "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
   *   "client_name": "Claude",
   *   "grant_types": ["authorization_code", "refresh_token"],
   *   "response_types": ["code"],
   *   "token_endpoint_auth_method": "client_secret_post"
   * }
   *
   * 응답:
   * {
   *   "client_id": "mcp_abc123...",
   *   "client_secret": "secret_xyz...",
   *   "client_id_issued_at": 1234567890,
   *   "client_secret_expires_at": 0,
   *   ...
   * }
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      logger.debug({ body: req.body }, '📝 Client registration request');

      // 요청 검증
      const validation = validateRegistrationRequest(req.body);
      if (!validation.valid) {
        logger.warn({ error: validation.error }, '⚠️ Invalid registration request');
        return res.status(400).json({
          error: OAuthErrorCodes.INVALID_CLIENT_METADATA,
          error_description: validation.error,
        });
      }

      const request = validation.data!;

      // 새 클라이언트 생성
      const clientId = storage.generateClientId();
      const clientSecret = storage.generateClientSecret();
      const now = Math.floor(Date.now() / 1000);

      // 저장할 클라이언트 데이터
      const normalizedScope = normalizeLegacyScope(request.scope);

      const client: StoredClient = {
        clientId,
        clientSecret,
        clientSecretExpiresAt: 0,  // 무기한 (0 = 만료 안 함)
        clientIdIssuedAt: now,
        redirectUris: request.redirect_uris,
        clientName: request.client_name || 'Unknown Client',
        clientUri: request.client_uri,
        scope: normalizedScope,
        tokenEndpointAuthMethod: request.token_endpoint_auth_method || 'client_secret_post',
        grantTypes: request.grant_types || ['authorization_code', 'refresh_token'],
        responseTypes: request.response_types || ['code'],
        softwareId: request.software_id,
        softwareVersion: request.software_version,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Redis에 저장
      await storage.saveClient(client);

      // 응답 생성
      const response: ClientRegistrationResponse = {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: now,
        client_secret_expires_at: 0,  // 무기한
        redirect_uris: client.redirectUris,
        client_name: client.clientName,
        client_uri: client.clientUri,
        scope: client.scope,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        software_id: client.softwareId,
        software_version: client.softwareVersion,
      };

      logger.info({
        clientId,
        clientName: client.clientName,
        redirectUris: client.redirectUris,
      }, '✅ Client registered successfully');

      res.status(201).json(response);
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Client registration failed');
      res.status(500).json({
        error: OAuthErrorCodes.SERVER_ERROR,
        error_description: 'Failed to register client',
      });
    }
  });

  /**
   * GET /oauth/register/:client_id - 클라이언트 정보 조회
   *
   * 등록된 클라이언트 정보를 조회 (디버깅용)
   * 프로덕션에서는 인증 필요할 수 있음
   */
  router.get('/register/:client_id', async (req: Request, res: Response) => {
    try {
      const { client_id } = req.params;

      const client = await storage.getClient(client_id);
      if (!client) {
        return res.status(404).json({
          error: OAuthErrorCodes.INVALID_CLIENT,
          error_description: 'Client not found',
        });
      }

      // 시크릿은 제외하고 반환
      const response: Partial<ClientRegistrationResponse> = {
        client_id: client.clientId,
        client_id_issued_at: client.clientIdIssuedAt,
        redirect_uris: client.redirectUris,
        client_name: client.clientName,
        client_uri: client.clientUri,
        scope: client.scope,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
      };

      res.json(response);
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Failed to get client');
      res.status(500).json({
        error: OAuthErrorCodes.SERVER_ERROR,
        error_description: 'Failed to get client information',
      });
    }
  });

  /**
   * DELETE /oauth/register/:client_id - 클라이언트 삭제
   *
   * 클라이언트 등록 해제
   */
  router.delete('/register/:client_id', async (req: Request, res: Response) => {
    try {
      const { client_id } = req.params;
      const authHeader = req.headers.authorization;

      // 클라이언트 확인
      const client = await storage.getClient(client_id);
      if (!client) {
        return res.status(404).json({
          error: OAuthErrorCodes.INVALID_CLIENT,
          error_description: 'Client not found',
        });
      }

      // 시크릿 검증 (Basic Auth 또는 Bearer)
      if (client.clientSecret) {
        let providedSecret: string | null = null;

        if (authHeader?.startsWith('Basic ')) {
          const decoded = Buffer.from(authHeader.substring(6), 'base64').toString();
          const [id, secret] = decoded.split(':');
          if (id === client_id) {
            providedSecret = secret;
          }
        } else if (authHeader?.startsWith('Bearer ')) {
          providedSecret = authHeader.substring(7);
        }

        if (!providedSecret || !(await storage.verifyClientSecret(client_id, providedSecret))) {
          return res.status(401).json({
            error: OAuthErrorCodes.INVALID_CLIENT,
            error_description: 'Invalid client credentials',
          });
        }
      }

      await storage.deleteClient(client_id);

      logger.info({ clientId: client_id }, '🗑️ Client deleted');
      res.status(204).send();
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Failed to delete client');
      res.status(500).json({
        error: OAuthErrorCodes.SERVER_ERROR,
        error_description: 'Failed to delete client',
      });
    }
  });

  return router;
}

export default router;
