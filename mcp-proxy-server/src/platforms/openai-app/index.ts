import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.validation.js';
import { oauthMiddleware, getUserInfo, type OAuthStorage } from '../../oauth/index.js';
import { createOpenAiServer } from './OpenAiServerFactory.js';
import { getOpenAiDiscoveryTools } from './ToolRegistrar.js';
import { OPENAI_WIDGET_URI } from './WidgetResource.js';
import type { MetricsService } from '../../services/MetricsService.js';
import type { ValidatedToken } from '../../oauth/types.js';

/**
 * OpenAI(ChatGPT) 전용 MCP 라우터.
 * - 인증은 기존 OAuth 인프라(oauthMiddleware/getUserInfo)를 그대로 재사용
 * - 툴/리소스 어댑팅은 platforms/openai-app 내부에서만 처리
 * - 기존 /mcp, /mcp-remote 라우트와 분리 유지
 */
export function createOpenAiAppRouter(
  storage: OAuthStorage,
  metricsService: MetricsService
): Router {
  const router = Router();
  const sseTransports = new Map<string, SSEServerTransport>();

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
      oauth,
      userInfo,
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

  async function handleStreamablePost(req: Request, res: Response) {
    const hydrated = await buildOpenAiContext(req, res);
    if (!hydrated) {
      return;
    }

    try {
      const mcpServer = await createOpenAiServer(hydrated.context as any);

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

  async function handleSseConnect(req: Request, res: Response) {
    const hydrated = await buildOpenAiContext(req, res);
    if (!hydrated) {
      return;
    }

    try {
      const mcpServer = await createOpenAiServer(hydrated.context as any);

      // Legacy SSE compatibility:
      // ChatGPT/일부 MCP 클라이언트가 text/event-stream을 기대할 때 사용한다.
      // POST /mcp-openai/messages?sessionId=... 로 메시지를 전달한다.
      const transport = new SSEServerTransport('/mcp-openai/messages', res);
      sseTransports.set(transport.sessionId, transport);

      transport.onclose = () => {
        sseTransports.delete(transport.sessionId);
      };
      transport.onerror = (error) => {
        logger.warn(
          {
            route: '/mcp-openai/sse',
            sessionId: transport.sessionId,
            error: error.message,
          },
          '⚠️ OpenAI SSE transport error'
        );
      };

      await mcpServer.connect(transport);
      metricsService.recordRequest('success', undefined, 'mcp-openai');
    } catch (error: any) {
      metricsService.recordRequest('error', undefined, 'mcp-openai');
      logger.error(
        { error: error.message, route: '/mcp-openai/sse' },
        '❌ OpenAI SSE connection failed'
      );
      if (!res.headersSent) {
        res.status(500).json({
          error: 'sse_connection_failed',
          message: 'Failed to establish SSE connection',
        });
      }
    }
  }

  router.post('/', async (req: Request, res: Response) => {
    await handleStreamablePost(req, res);
  });

  router.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query?.sessionId as string | undefined;
    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId query is required' });
    }

    const transport = sseTransports.get(sessionId);
    if (!transport) {
      return res.status(400).json({ message: 'No transport found for sessionId' });
    }

    try {
      const startTime = Date.now();
      await transport.handlePostMessage(req as any, res, (req as any).body);
      const duration = Date.now() - startTime;
      metricsService.recordRequestDuration(duration, undefined, 'mcp-openai');
    } catch (error: any) {
      metricsService.recordRequest('error', undefined, 'mcp-openai');
      logger.error(
        { error: error.message, route: '/mcp-openai/messages', sessionId },
        '❌ OpenAI SSE message handling failed'
      );
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to process SSE message' });
      }
    }
  });

  router.get('/sse', async (req: Request, res: Response) => {
    await handleSseConnect(req, res);
  });

  // 클라이언트 호환성:
  // 일부 클라이언트가 base URL을 /mcp-openai로 잡은 뒤 하위 .well-known을 조회한다.
  router.get('/.well-known/oauth-authorization-server', (req, res) => {
    res.json(getAuthMetadata(getRequestServerUrl(req)));
  });
  router.get('/.well-known/openid-configuration', (req, res) => {
    res.json(getAuthMetadata(getRequestServerUrl(req)));
  });

  router.get('/', async (req, res) => {
    const accept = req.headers.accept || '';
    const userAgent = req.headers['user-agent'] || '';
    // ChatGPT/legacy MCP client compatibility:
    // URL을 /mcp-openai로 등록했는데 SSE를 기대하는 경우 자동 분기.
    if (
      accept.includes('text/event-stream') ||
      (typeof userAgent === 'string' && userAgent.toLowerCase().includes('openai-mcp'))
    ) {
      await handleSseConnect(req, res);
      return;
    }

    // 운영/검증용 discovery 엔드포인트(비인증)
    // MCP 실제 호출은 POST /mcp-openai(JSON-RPC) + OAuth로 수행된다.
    const serverUrl = getRequestServerUrl(req);
    res.json({
      name: 'codebase-blog-openai-mcp',
      version: '1.0.0',
      description: 'Codebase.blog ChatGPT App MCP Server',
      capabilities: {
        tools: true,
        prompts: false,
        resources: true,
        logging: false,
      },
      endpoints: {
        jsonrpc: '/mcp-openai',
        sse: '/mcp-openai/sse',
        messages: '/mcp-openai/messages',
      },
      authentication: ['oauth2'],
      oauth: {
        authorization_server: serverUrl,
        protected_resource: `${serverUrl}/.well-known/oauth-protected-resource`,
      },
      // ChatGPT 위젯 템플릿 URI(툴 descriptor의 resourceUri와 동일해야 함)
      widget: {
        resourceUri: OPENAI_WIDGET_URI,
      },
      tools: getOpenAiDiscoveryTools(),
    });
  });

  router.delete('/', (req, res) => {
    logger.debug('🔌 DELETE /mcp-openai');
    res.status(204).send();
  });
  
  return router;
}
