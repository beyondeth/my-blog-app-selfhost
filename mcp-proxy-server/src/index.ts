/**
 * MCP Proxy Server - Dual Auth (API Key + OAuth 2.1)
 *
 * 인증 경로:
 * - /mcp: API Key Bearer 인증 (stateless)
 * - /mcp-remote: OAuth 2.1 Bearer 인증 (Skills/MCPorter, Claude, 기타 OAuth 클라이언트)
 * - /mcp-openai: OAuth 2.1 + ChatGPT App 전용 MCP
 */

import express from 'express';
import crypto from 'crypto';
import Redis from 'ioredis';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger, httpLogger } from './utils/logger.js';
import { config } from './config/env.validation.js';
import { registerAllTools } from './tools/index.js';
import { getDiscoveryTools } from './tools/catalog.js';
import { RedisCacheService } from './services/RedisCacheService.js';
import { MetricsService } from './services/MetricsService.js';
import { createOAuthRouter } from './oauth/index.js';
import { createOpenAiAppRouter } from './platforms/openai-app/index.js';
import axios from 'axios';

// Express 앱 초기화
const app = express();
const port = config.MCP_PROXY_PORT;

// Prometheus 메트릭 서비스 초기화 (먼저 생성)
const metricsService = new MetricsService();

// Redis Core: OAuth/session storage (noeviction).
const redisCore = new Redis({
  host: config.REDIS_CORE_HOST,
  port: config.REDIS_CORE_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// Redis Cache: API key caching (evictable).
const redisCache = new RedisCacheService(
  {
    host: config.REDIS_CACHE_HOST,
    port: config.REDIS_CACHE_PORT,
    password: config.REDIS_PASSWORD,
    ttl: config.API_KEY_CACHE_TTL,
  },
  metricsService
);

// OAuth 라우터 초기화 (Core Redis 사용)
const { wellKnownRouter, oauthRouter, mcpRemoteRouter, storage } = createOAuthRouter(
  redisCore,
  metricsService
);

// Redis 연결 상태 모니터링 (10초마다)
setInterval(() => {
  const isCoreConnected = redisCore.status === 'ready';
  const isCacheConnected = redisCache.getConnectionStatus();
  metricsService.updateRedisConnection(isCoreConnected && isCacheConnected);
}, 10000);

// StreamableHTTPServerTransport가 raw stream을 직접 읽는 MCP 엔드포인트
// ⚠️ 새 MCP 엔드포인트 추가 시 반드시 이 목록에도 추가할 것
const skipBodyParsing = ['/mcp', '/mcp-remote', '/mcp-openai'];
app.use((req, res, next) => {
  if (skipBodyParsing.includes(req.path)) {
    // MCP 경로는 body parsing 건너뛰기 (StreamableHTTPServerTransport가 직접 처리)
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use((req, res, next) => {
  if (skipBodyParsing.includes(req.path)) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

// HTTP 로깅 (개발 환경에서만)
if (config.NODE_ENV === 'development' || config.LOG_LEVEL === 'debug') {
  app.use(httpLogger);
}

// 정적 파일 서빙 (Local Image Generation -> URL 변환용)
// generated 폴더의 이미지를 http://localhost:3002/generated/... 로 접근 가능하게 함
import path from 'path';
app.use('/generated', express.static(path.join(process.cwd(), 'public/generated')));

// CORS 설정
// MCP/OAuth 엔드포인트는 Bearer 토큰으로 보호되므로 모든 origin 허용
// Claude 커스텀 커넥터 등 다양한 클라이언트 지원을 위해 필요
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = config.CORS_ORIGINS.split(',').map(o => o.trim());

  // Bearer 토큰으로 보호되는 MCP/OAuth 엔드포인트는 모든 origin 허용
  // ⚠️ 새 MCP 엔드포인트 추가 시 반드시 이 목록에도 추가할 것
  const mcpPaths = ['/mcp', '/mcp-remote', '/mcp-openai', '/oauth', '/.well-known'];
  const isMcpEndpoint = mcpPaths.some(p => req.path.startsWith(p));

  // Origin 검증
  let isAllowed = false;

  if (origin) {
    // MCP 엔드포인트는 모든 origin 허용
    if (isMcpEndpoint) {
      isAllowed = true;
    } else {
      // 다른 엔드포인트는 whitelist 검증
      for (const allowed of allowedOrigins) {
        const pattern = allowed.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);

        if (regex.test(origin)) {
          isAllowed = true;
          break;
        }
      }
    }

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(isAllowed ? 204 : 403);
  }

  // 프로덕션에서 허용되지 않은 Origin 차단 (MCP 엔드포인트 제외)
  if (origin && !isAllowed && config.NODE_ENV === 'production') {
    logger.warn({ origin, path: req.path }, '⚠️ CORS: Blocked origin');
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  next();
});

/**
 * API Key 검증 (Redis 캐싱 + Backend 호출)
 *
 * 캐시 히트: 1-3ms (99% 단축)
 * 캐시 미스: 85-165ms (Backend bcrypt 검증)
 *
 * @param apiKey Bearer 토큰에서 추출한 API Key (blog_sk_{hint}_{secret})
 * @returns 검증 성공 시 사용자 정보, 실패 시 null
 */
async function validateApiKey(apiKey: string): Promise<{
  keyId: string;
  userId: string;
  blogId: string;
  user: { id: string; username: string; email: string };
  blog: { id: string; name: string; slug: string };
} | null> {
  const startTime = Date.now();

  try {
    // 1. API Key hint 추출 (blog_sk_{hint}_{secret})
    const parts = apiKey.split('_');
    if (parts.length !== 4) {
      logger.warn('⚠️ Invalid API key format');
      metricsService.recordError('invalid_format', 400);
      return null;
    }
    const keyHint = parts[2]; // hint (8자)

    // 2. Redis 캐시 확인 (1-3ms)
    const cached = await redisCache.getApiKeyValidation(keyHint);
    if (cached) {
      const duration = Date.now() - startTime;
      metricsService.recordCacheHit();
      metricsService.recordValidationDuration(duration, true);
      return cached;
    }

    // 3. 캐시 미스 - Backend 검증 (85-165ms)
    metricsService.recordCacheMiss();

    const headers: Record<string, string> = {};
    if (config.MCP_SHARED_SECRET) {
      headers['X-Internal-Secret'] = config.MCP_SHARED_SECRET;
    }

    const response = await axios.post(
      `${config.BACKEND_BASE_URL}/api/v1/mcp/validate-key`,
      { apiKey },
      {
        timeout: 5000,
        headers,
      }
    );

    const duration = Date.now() - startTime;

    if (response.data?.valid) {
      const userData = response.data.data;

      // 4. 검증 성공 - Redis 캐싱 (TTL: 5분)
      await redisCache.setApiKeyValidation(keyHint, userData);

      metricsService.recordValidationDuration(duration, false);
      return userData;
    }

    metricsService.recordError('validation_failed', 401);
    return null;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.warn({ error: error.message }, '⚠️ API Key validation failed');
    metricsService.recordValidationDuration(duration, false);
    metricsService.recordError('backend_error', 500);
    return null;
  }
}

/**
 * MCP 서버 생성 (요청마다 새로 생성 - Context7 스타일)
 *
 * @param userData API Key 검증 결과 + 원본 API Key
 * @returns MCP 서버 인스턴스
 */
async function createMcpServer(userData: {
  keyId: string;
  userId: string;
  blogId: string;
  user: any;
  blog: any;
  apiKey: string; // 원본 API Key 추가
}): Promise<McpServer> {
  const server = new McpServer(
    {
      name: 'codebase-blog-mcp',
      version: '8.0.0',  // API Key 버전
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  // 도구 등록 (API Key + MetricsService 함께 전달)
  await registerAllTools(server, {
    userData,
    apiKey: userData.apiKey, // API Key 추가 (create_post에서 사용)
    metricsService, // 메트릭 서비스 추가 (도구 호출 추적용)
    route: 'mcp',
    config: {
      MCP_BASE_URL: config.MCP_BASE_URL,
      BACKEND_BASE_URL: config.BACKEND_BASE_URL,
      BACKEND_PUBLIC_URL: config.BACKEND_PUBLIC_URL,
      FRONTEND_URL: config.FRONTEND_URL,
      MCP_SHARED_SECRET: config.MCP_SHARED_SECRET,
    },
  });

  return server;
}

// ===== OAuth 라우터 마운트 (공유 OAuth 경로) =====

// RFC 9728, 8414 메타데이터 엔드포인트
app.use('/.well-known', wellKnownRouter);

// OAuth 인증 엔드포인트 (DCR, authorize, token, revoke) — 모든 OAuth 클라이언트 공유
app.use('/oauth', oauthRouter);

// OAuth 인증된 MCP 엔드포인트 (Skills/MCPorter, Claude, 기타 OAuth 클라이언트 공유)
app.use('/mcp-remote', mcpRemoteRouter);

// OpenAI ChatGPT App 전용 MCP 엔드포인트
if (config.OPENAI_APP_ENABLED) {
  app.use('/mcp-openai', createOpenAiAppRouter(storage, metricsService, redisCore));
  logger.info('🤖 OpenAI ChatGPT App endpoint enabled at /mcp-openai');
}

// 내부 연동용 OAuth 토큰 무효화 엔드포인트 (Backend logout → MCP OAuth revoke)
// - 외부 공개용이 아니므로 X-Internal-Secret이 일치할 때만 허용한다.
app.post('/internal/oauth/revoke-user', async (req, res) => {
  try {
    const providedSecret = req.headers['x-internal-secret'];
    const expectedSecret = config.MCP_SHARED_SECRET;

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const userId = req.body?.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: 'userId is required' });
    }

    await storage.revokeAllUserTokens(userId);
    logger.info({ userId: userId.substring(0, 8) }, '✅ Internal OAuth revoke completed');
    return res.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error?.message }, '❌ Internal OAuth revoke failed');
    return res.status(500).json({ message: 'Internal error' });
  }
});

// ===== 기존 라우트 (API Key 인증) =====

/**
 * 헬스 체크
 */
app.get('/health', (req, res) => {
  const serverUrl = config.MCP_BASE_URL || `http://localhost:${config.MCP_PROXY_PORT}`;
  res.json({
    status: 'healthy',
    service: 'MCP Proxy Server',
    version: '8.0.0',
    pattern: 'Stateless API Key + OAuth 2.1',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    redis: redisCache.getConnectionStatus() ? 'connected' : 'disconnected',
    endpoints: {
      apiKey: '/mcp',
      oauth: '/mcp-remote',
      ...(config.OPENAI_APP_ENABLED ? { openai: '/mcp-openai' } : {}),
      metadata: {
        resource: `${serverUrl}/.well-known/oauth-protected-resource`,
        authServer: `${serverUrl}/.well-known/oauth-authorization-server`,
      },
    },
  });
});

/**
 * Prometheus 메트릭 (Grafana 수집용)
 */
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to get metrics');
    res.status(500).send('Failed to get metrics');
  }
});

/**
 * 메트릭 통계 (디버그용)
 */
app.get('/metrics/stats', async (req, res) => {
  try {
    const stats = await metricsService.getStats();
    const redisStats = await redisCache.getStats();

    res.json({
      metrics: stats,
      redis: redisStats,
    });
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to get stats');
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * POST /mcp - MCP 요청 처리 (API Key 인증)
 *
 * 흐름:
 * 1. Authorization 헤더에서 API Key 추출
 * 2. Backend /mcp/validate-key 호출
 * 3. MCP 서버 생성 (요청마다)
 * 4. Transport 생성 및 연결
 * 5. 요청 처리
 * 6. 자동 cleanup (GC)
 */
app.post('/mcp', async (req, res) => {
  try {
    // 1. Authorization 헤더 검증
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('⚠️ Missing Bearer token');

      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Unauthorized: Bearer token required (format: Bearer blog_sk_...)',
        },
        id: null,
      });
    }

    const apiKey = authHeader.substring(7);  // "Bearer " 제거

    // 2. API Key 검증 (Backend 호출)
    const userData = await validateApiKey(apiKey);

    if (!userData) {
      logger.warn('⚠️ Invalid API key');

      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Unauthorized: Invalid or expired API key',
        },
        id: null,
      });
    }

    logger.debug({
      userId: userData.userId.substring(0, 8),
      blogSlug: userData.blog.slug,
    }, '✅ API Key validated');

    // 3. MCP 서버 생성 (요청마다 새로 생성 - Context7 스타일)
    // userData에 원본 API Key 추가
    const mcpServer = await createMcpServer({
      ...userData,
      apiKey, // 원본 API Key 전달
    });

    // 4. Transport 생성 (Context7와 동일한 옵션)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,  // Context7와 동일
    });

    // 5. MCP 서버와 Transport 연결
    await mcpServer.connect(transport);

    // 6. 요청 처리 전 시간 기록 (메트릭 수집용)
    const startTime = Date.now();

    // 7. 요청 처리 (⚠️ req.body 전달하지 않음 - Transport가 raw stream 읽음)
    await transport.handleRequest(req, res);

    // 8. 메트릭 기록
    const duration = Date.now() - startTime;
    metricsService.recordRequest('success', undefined, 'mcp');
    metricsService.recordRequestDuration(duration, undefined, 'mcp');

    // 9. 자동 cleanup (함수 종료 시 GC가 처리)
    logger.debug({
      userId: userData.userId.substring(0, 8),
      duration: `${duration}ms`,
    }, '✅ Request processed');

  } catch (error: any) {
    // 메트릭 기록 (에러)
    metricsService.recordRequest('error', undefined, 'mcp');

    logger.error({
      error: error.message,
      stack: error.stack,
    }, '❌ MCP request failed');

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

/**
 * GET /mcp - Server Discovery
 *
 * MCP 서버 정보와 capabilities를 반환합니다.
 * 클라이언트는 이 정보를 통해 서버와의 통신 방식을 결정합니다.
 */
app.get('/mcp', (req, res) => {
  // MCP 서버 Discovery 응답
  res.json({
    name: 'codebase-blog-mcp',
    version: '8.0.0',
    description: 'Codebase.blog Auto-posting MCP Server',
    capabilities: {
      tools: true,
      prompts: false,
      resources: false,
      logging: false
    },
    endpoints: {
      jsonrpc: '/mcp'
    },
    authentication: ['bearer'],
    tools: getDiscoveryTools(),
  });
});

/**
 * DELETE /mcp - 세션 종료
 *
 * Stateless 구조라서 특별히 정리할 것이 없지만,
 * MCP 프로토콜 호환성을 위해 204 응답
 */
app.delete('/mcp', (req, res) => {
  logger.debug('🔌 DELETE /mcp (no-op in stateless mode)');
  res.status(204).send();
});

// 404 핸들러
app.use((req, res) => {
  logger.warn({ path: req.path, method: req.method }, '⚠️ 404 Not Found');
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`,
  });
});

// 에러 핸들러
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
  }, '❌ Unhandled error');

  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: config.NODE_ENV === 'development' ? err.message : 'An error occurred',
    });
  }
});

// 서버 시작
const server = app.listen(port, '0.0.0.0', () => {
  logger.info({
    port,
    host: '0.0.0.0',
    environment: config.NODE_ENV,
    pattern: 'Dual Route: /mcp (API Key) + /mcp-remote (OAuth 2.1)',
    ...(config.OPENAI_APP_ENABLED ? { openaiRoute: '/mcp-openai' } : {}),
    auth: 'Bearer token (blog_sk_... or OAuth access token)',
    backendUrl: config.BACKEND_BASE_URL,
  }, '🚀 MCP Proxy Server started');
});

// 서버 에러 핸들링
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.fatal({ port }, `❌ Port ${port} already in use`);
  } else if (error.code === 'EACCES') {
    logger.fatal({ port }, `❌ Permission denied for port ${port}`);
  } else {
    logger.fatal({ error: error.message }, '❌ Server start failed');
  }
  process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, '📴 Shutting down...');

  // Redis 연결 종료 (캐시 + OAuth 공유 인스턴스)
  await redisCache.disconnect();
  await redisCore.quit();

  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });

  // 5초 타임아웃
  setTimeout(() => {
    logger.warn('⚠️ Forced shutdown after 5s timeout');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
