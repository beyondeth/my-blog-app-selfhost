import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.validation.js';
import { oauthMiddleware, getUserInfo, type OAuthStorage } from '../../oauth/index.js';
import { createOpenAiServer } from './OpenAiServerFactory.js';
import { OpenAiStyleStateStore } from './OpenAiStyleStateStore.js';
import type { MetricsService } from '../../services/MetricsService.js';
import type { ValidatedToken } from '../../oauth/types.js';
import type Redis from 'ioredis';

/**
 * OpenAI(ChatGPT) 전용 MCP 라우터.
 * - 인증은 기존 OAuth 인프라(oauthMiddleware/getUserInfo)를 그대로 재사용
 * - 전송 계층은 Streamable HTTP GET/POST 단일 엔드포인트만 사용한다.
 * - 기존 /mcp, /mcp-remote 라우트와 분리 유지
 */
export function createOpenAiAppRouter(
  storage: OAuthStorage,
  metricsService: MetricsService,
  redisCore: Redis
): Router {
  const router = Router();
  const styleStateStore = new OpenAiStyleStateStore(redisCore);

  function getRequestServerUrl(req: Request): string {
    const forwardedProto = ((req.headers['x-forwarded-proto'] as string) || '')
      .split(',')[0]
      ?.trim();
    const forwardedHost = ((req.headers['x-forwarded-host'] as string) || '')
      .split(',')[0]
      ?.trim();
    const requestHost = forwardedHost || req.headers.host || '';
    if (requestHost) {
      return `${forwardedProto || req.protocol || 'http'}://${requestHost}`;
    }
    return config.MCP_BASE_URL || `http://localhost:${config.MCP_PROXY_PORT}`;
  }

  function getAuthMetadata(serverUrl: string) {
    return {
      issuer: serverUrl,
      authorization_endpoint: `${serverUrl}/oauth/authorize`,
      token_endpoint: `${serverUrl}/oauth/token`,
      registration_endpoint: `${serverUrl}/oauth/register`,
      revocation_endpoint: `${serverUrl}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      scopes_supported: ['mcp:tools', 'mcp:read', 'mcp:write'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  async function buildOpenAiContext(req: Request, res: Response) {
    await oauthMiddleware(storage, req, res, () => {});

    if (res.headersSent) {
      return null;
    }

    const oauth = (req as any).oauth as ValidatedToken;
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
      return null;
    }

    return {
      context: {
        userData: {
          keyId: `oauth:${oauth.clientId}`,
          userId: oauth.userId,
          blogId: userInfo.blog.id,
          user: userInfo.user,
          blog: userInfo.blog,
        },
        apiKey: null,
        oauthToken: oauth.token,
        metricsService,
        route: 'mcp-openai' as const,
        config: {
          MCP_BASE_URL: config.MCP_BASE_URL,
          BACKEND_BASE_URL: config.BACKEND_BASE_URL,
          BACKEND_PUBLIC_URL: config.BACKEND_PUBLIC_URL,
          FRONTEND_URL: config.FRONTEND_URL,
          MCP_SHARED_SECRET: config.MCP_SHARED_SECRET,
        },
      },
    };
  }

  async function handleStreamableRequest(req: Request, res: Response) {
    const hydrated = await buildOpenAiContext(req, res);
    if (!hydrated) {
      return;
    }

    try {
      const mcpServer = await createOpenAiServer(hydrated.context as any, styleStateStore);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await mcpServer.connect(transport);

      const startTime = Date.now();
      await transport.handleRequest(req, res);
      const duration = Date.now() - startTime;

      metricsService.recordRequest('success', undefined, 'mcp-openai');
      metricsService.recordRequestDuration(duration, undefined, 'mcp-openai');
    } catch (error: any) {
      metricsService.recordRequest('error', undefined, 'mcp-openai');
      logger.error(
        { error: error.message, route: '/mcp-openai' },
        '❌ OpenAI MCP request failed'
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
  }

  // 클라이언트 호환성:
  // 일부 클라이언트가 base URL을 /mcp-openai로 잡은 뒤 하위 .well-known을 조회한다.
  router.get('/.well-known/oauth-authorization-server', (req, res) => {
    res.json(getAuthMetadata(getRequestServerUrl(req)));
  });
  router.get('/.well-known/openid-configuration', (req, res) => {
    res.json(getAuthMetadata(getRequestServerUrl(req)));
  });

  // OpenAI App 전용 MCP 진입점:
  // Streamable HTTP GET/POST 단일 엔드포인트로만 처리한다.
  router.get('/', async (req: Request, res: Response) => {
    await handleStreamableRequest(req, res);
  });

  router.post('/', async (req: Request, res: Response) => {
    await handleStreamableRequest(req, res);
  });

  router.delete('/', (_req, res) => {
    logger.debug('🔌 DELETE /mcp-openai');
    res.status(204).send();
  });

  return router;
}
