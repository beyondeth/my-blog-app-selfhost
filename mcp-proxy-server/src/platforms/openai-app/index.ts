import { Router, Request, Response, NextFunction } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.validation.js';
import { oauthMiddleware, getUserInfo, type OAuthStorage } from '../../oauth/index.js';
import { createOpenAiServer } from './OpenAiServerFactory.js';
import { getOpenAiDiscoveryTools } from './ToolRegistrar.js';
import type { MetricsService } from '../../services/MetricsService.js';
import type { ValidatedToken } from '../../oauth/types.js';

export function createOpenAiAppRouter(
  storage: OAuthStorage,
  metricsService: MetricsService
): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    await oauthMiddleware(storage, req, res, () => {});

    if (res.headersSent) {
      return;
    }

    const oauth = (req as any).oauth as ValidatedToken;
    const userInfo = await getUserInfo(oauth.userId);

    if (!userInfo) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Forbidden: User not found or no blog configured',
        },
        id: null,
      });
    }

    try {
      const mcpServer = await createOpenAiServer({
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
        route: 'mcp-openai',
        config: {
          MCP_BASE_URL: config.MCP_BASE_URL,
          BACKEND_BASE_URL: config.BACKEND_BASE_URL,
          BACKEND_PUBLIC_URL: config.BACKEND_PUBLIC_URL,
          FRONTEND_URL: config.FRONTEND_URL,
          MCP_SHARED_SECRET: config.MCP_SHARED_SECRET,
        },
      });

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
  });

  router.get('/', (req, res) => {
    const serverUrl = config.MCP_BASE_URL || `http://localhost:${config.MCP_PROXY_PORT}`;
    res.json({
      name: 'codebase-blog-openai-mcp',
      version: '1.0.0',
      description: 'Codebase.blog ChatGPT App MCP Server',
      capabilities: {
        tools: true,
        prompts: false,
        resources: false,
        logging: false,
      },
      endpoints: {
        jsonrpc: '/mcp-openai',
      },
      authentication: ['oauth2'],
      oauth: {
        authorization_server: serverUrl,
        protected_resource: `${serverUrl}/.well-known/oauth-protected-resource`,
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
