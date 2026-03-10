/**
 * OAuth 2.1 라우터 통합
 *
 * OAuth 2.1 공유 엔드포인트
 * - Skills (MCPorter)
 * - Claude 커스텀 커넥터
 * - 기타 OAuth 클라이언트
 *
 * 엔드포인트:
 * - /.well-known/oauth-protected-resource (RFC 9728)
 * - /.well-known/oauth-authorization-server (RFC 8414)
 * - /oauth/register (RFC 7591)
 * - /oauth/authorize
 * - /oauth/callback
 * - /oauth/token
 * - /oauth/revoke
 */

import { Router, Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import axios from 'axios';

import { logger } from '../utils/logger.js';
import { config } from '../config/env.validation.js';
import { registerAllTools } from '../tools/index.js';
import { getDiscoveryTools } from '../tools/catalog.js';
import { MetricsService } from '../services/MetricsService.js';

import { OAuthStorage } from './storage.js';
import metadataRouter, { getWWWAuthenticateHeader } from './metadata.js';
import { createClientRegistrationRouter } from './client-registration.js';
import { createAuthorizationRouter } from './authorization.js';
import type { ValidatedToken } from './types.js';

/**
 * OAuth 미들웨어 - 토큰 검증
 *
 * Bearer 토큰을 검증하고 req.oauth에 토큰 정보 추가
 */
export async function oauthMiddleware(
  storage: OAuthStorage,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const acceptsEventStream =
    (req.headers.accept || '').includes('text/event-stream') ||
    (((req.headers['user-agent'] as string) || '').toLowerCase().includes('openai-mcp') &&
      req.method.toUpperCase() === 'GET');

  const sendOAuthError = (
    status: number,
    message: string,
    authenticateHeader?: string
  ) => {
    if (authenticateHeader) {
      res.header('WWW-Authenticate', authenticateHeader);
    }

    if (acceptsEventStream) {
      res.status(status);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const payload = JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message,
        },
        id: null,
      });

      res.write(`event: error\ndata: ${payload}\n\n`);
      res.end();
      return;
    }

    res.status(status).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message,
      },
      id: null,
    });
  };

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendOAuthError(
      401,
      'Unauthorized: Bearer token required',
      getWWWAuthenticateHeader(req, {
        error: 'invalid_request',
        errorDescription: 'Bearer token required',
      })
    );
    return;
  }

  const token = authHeader.substring(7);
  const accessToken = await storage.validateAccessToken(token);

  if (!accessToken) {
    sendOAuthError(
      401,
      'Unauthorized: Invalid or expired access token',
      getWWWAuthenticateHeader(req, {
        error: 'invalid_token',
        errorDescription: 'Invalid or expired access token',
      })
    );
    return;
  }

  // 리소스(audience) 검증 (RFC 8707)
  // 클라이언트마다 resource를 origin으로 보내거나, 보호 경로까지 포함해 보낼 수 있어 둘 다 허용한다.
  const normalizeUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
    } catch {
      return url.replace(/\/$/, '');
    }
  };
  const serverUrl = config.MCP_BASE_URL || `http://localhost:${config.MCP_PROXY_PORT}`;
  const forwardedProto = ((req.headers['x-forwarded-proto'] as string) || '')
    .split(',')[0]
    ?.trim();
  const forwardedHost = ((req.headers['x-forwarded-host'] as string) || '')
    .split(',')[0]
    ?.trim();
  const requestHost = forwardedHost || req.headers.host || '';
  const requestProto = forwardedProto || req.protocol || 'http';
  const requestOrigin = requestHost ? `${requestProto}://${requestHost}` : null;
  const requestBaseUrl = req.baseUrl || '';

  const normalizedResource = normalizeUrl(accessToken.resource);
  const normalizedServerUrl = normalizeUrl(serverUrl);
  const allowedResources = new Set<string>([
    normalizedServerUrl,
    normalizeUrl(`${serverUrl}/mcp-remote`),
    normalizeUrl(`${serverUrl}/mcp-openai`),
  ]);
  if (requestOrigin) {
    allowedResources.add(normalizeUrl(requestOrigin));
    if (requestBaseUrl) {
      allowedResources.add(normalizeUrl(`${requestOrigin}${requestBaseUrl}`));
    }
  }

  if (!allowedResources.has(normalizedResource)) {
    logger.warn({
      expected: serverUrl,
      actual: accessToken.resource,
      allowedResources: Array.from(allowedResources),
    }, '⚠️ Token audience mismatch');

    sendOAuthError(
      403,
      'Forbidden: Token not valid for this resource',
      getWWWAuthenticateHeader(req, {
        error: 'insufficient_scope',
        errorDescription: 'Token not valid for this resource',
      })
    );
    return;
  }

  // 토큰 정보를 요청에 추가
  (req as any).oauth = {
    token: accessToken.token,
    clientId: accessToken.clientId,
    userId: accessToken.userId,
    scope: accessToken.scope,
    resource: accessToken.resource,
    expiresAt: accessToken.expiresAt,
  } as ValidatedToken;

  next();
}

/**
 * OAuth 인증 사용자 정보 조회 (Backend에서)
 */
export async function getUserInfo(userId: string): Promise<{
  user: { id: string; username: string; email: string };
  blog: { id: string; name: string; slug: string; isPublic?: boolean };
} | null> {
  try {
    // Backend에서 사용자 정보 조회
    const headers: Record<string, string> = {};
    if (config.MCP_SHARED_SECRET) {
      headers['X-Internal-Secret'] = config.MCP_SHARED_SECRET;
    }

    const response = await axios.get(
      `${config.BACKEND_BASE_URL}/api/v1/users/${userId}/mcp-info`,
      {
        timeout: 5000,
        headers,
      }
    );

    if (response.data) {
      return response.data;
    }

    return null;
  } catch (error: any) {
    logger.warn({ error: error.message, userId }, '⚠️ Failed to get user info');
    return null;
  }
}

/**
 * OAuth 라우터 팩토리
 *
 * @param redis Redis 인스턴스
 * @param metricsService 메트릭 서비스
 */
export function createOAuthRouter(redis: Redis, metricsService: MetricsService): {
  wellKnownRouter: Router;
  oauthRouter: Router;
  mcpRemoteRouter: Router;
  storage: OAuthStorage;
} {
  const storage = new OAuthStorage(redis);

  // /.well-known/* 라우터
  const wellKnownRouter = metadataRouter;

  // /oauth/* 라우터
  const oauthRouter = Router();
  oauthRouter.use(createClientRegistrationRouter(storage));
  oauthRouter.use(createAuthorizationRouter(storage));

  // OAuth 통계 엔드포인트
  oauthRouter.get('/stats', async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Failed to get OAuth stats');
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  // /mcp-remote 라우터 (OAuth 인증된 MCP 엔드포인트)
  const mcpRemoteRouter = Router();

  const handleOAuthMcpRequest = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    // OAuth 토큰 검증 미들웨어
    await oauthMiddleware(storage, req, res, () => {});

    // 미들웨어에서 응답을 보냈으면 종료
    if (res.headersSent) {
      return;
    }

    const oauth = (req as any).oauth as ValidatedToken;

    try {
      logger.debug(
        {
          method: req.method,
          userId: oauth.userId.substring(0, 8),
          clientId: oauth.clientId.substring(0, 12),
        },
        '🔐 OAuth MCP request',
      );

      // 사용자 정보 조회
      const userInfo = await getUserInfo(oauth.userId);
      if (!userInfo) {
        res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32002,
            message: 'Forbidden: User not found or no blog configured',
          },
          id: null,
        });
        return;
      }

      // MCP 서버 생성
      const mcpServer = new McpServer(
        {
          name: 'codebase-blog-mcp',
          version: '8.0.0',
        },
        {
          capabilities: {
            tools: {},
            prompts: {},
          },
        },
      );

      // 도구 등록 (OAuth 모드 - API Key 없음)
      await registerAllTools(mcpServer, {
        userData: {
          keyId: `oauth:${oauth.clientId}`,
          userId: oauth.userId,
          blogId: userInfo.blog.id,
          user: userInfo.user,
          blog: userInfo.blog,
        },
        apiKey: null,
        oauthToken: oauth.token,
        oauthScope: oauth.scope,
        metricsService,
        route: 'mcp-remote',
        config: {
          MCP_BASE_URL: config.MCP_BASE_URL,
          BACKEND_BASE_URL: config.BACKEND_BASE_URL,
          BACKEND_PUBLIC_URL: config.BACKEND_PUBLIC_URL,
          FRONTEND_URL: config.FRONTEND_URL,
          MCP_SHARED_SECRET: config.MCP_SHARED_SECRET,
        },
      });

      // Transport 생성
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await mcpServer.connect(transport);

      const startTime = Date.now();
      await transport.handleRequest(req, res);

      const duration = Date.now() - startTime;
      metricsService.recordRequest('success', undefined, 'mcp-remote');
      metricsService.recordRequestDuration(duration, undefined, 'mcp-remote');

      logger.debug(
        {
          method: req.method,
          userId: oauth.userId.substring(0, 8),
          duration: `${duration}ms`,
        },
        '✅ OAuth MCP request processed',
      );
    } catch (error: any) {
      metricsService.recordRequest('error', undefined, 'mcp-remote');
      logger.error(
        { error: error.message, method: req.method },
        '❌ OAuth MCP request failed',
      );

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
          },
          id: null,
        });
      }
    }
  };

  const isTransportGetRequest = (req: Request): boolean => {
    const acceptHeader = (req.headers.accept || '').toLowerCase();
    return (
      acceptHeader.includes('text/event-stream') ||
      typeof req.headers.authorization === 'string' ||
      typeof req.headers['mcp-session-id'] === 'string' ||
      typeof req.headers['mcp-protocol-version'] === 'string'
    );
  };

  /**
   * POST /mcp-remote - OAuth 인증된 MCP 요청 처리
   *
   * /mcp와 동일한 MCP 처리 로직이지만 OAuth 토큰으로 인증
   */
  mcpRemoteRouter.post('/', async (req: Request, res: Response) => {
    await handleOAuthMcpRequest(req, res);
  });

  /**
   * GET /mcp-remote - Server Discovery (OAuth 버전)
   */
  mcpRemoteRouter.get('/', async (req, res) => {
    if (isTransportGetRequest(req)) {
      await handleOAuthMcpRequest(req, res);
      return;
    }

    const serverUrl = config.MCP_BASE_URL || `http://localhost:${config.MCP_PROXY_PORT}`;

    res.json({
      name: 'codebase-blog-mcp',
      version: '8.0.0',
      description: 'Codebase.blog Auto-posting MCP Server (OAuth)',
      capabilities: {
        tools: true,
        prompts: false,
        resources: false,
        logging: false,
      },
      endpoints: {
        jsonrpc: '/mcp-remote',
      },
      authentication: ['oauth2'],
      oauth: {
        authorization_server: serverUrl,
        protected_resource: `${serverUrl}/.well-known/oauth-protected-resource`,
      },
      tools: getDiscoveryTools(),
    });
  });

  /**
   * DELETE /mcp-remote - 세션 종료
   */
  mcpRemoteRouter.delete('/', async (req, res) => {
    await handleOAuthMcpRequest(req, res);
  });

  return {
    wellKnownRouter,
    oauthRouter,
    mcpRemoteRouter,
    storage,
  };
}

export { OAuthStorage };
