/**
 * MCP Proxy Server 진입점
 *
 * 프로덕션 레벨로 개선된 구조:
 * - 환경 변수 검증
 * - 에러 처리 미들웨어
 * - 라우터 분리
 * - PKCE 보안 개선
 * - Pino 로거 시스템
 */

import express from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ES Module에서 __dirname 사용하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { SessionService } from './services/SessionService.js';
import { TransportManager, sessionContext } from './services/TransportManager.js';  // Transport 패턴
import { config } from './config/env.validation.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createSessionRoutes } from './routes/session.routes.js';
import { createMcpRoutes } from './routes/mcp.routes.js';
import { createProxyRoutes } from './routes/proxy.routes.js';
import { createOAuthRoutes } from './routes/oauth.routes.js';
import { logger, httpLogger } from './utils/logger.js';
import { mcpRateLimiter } from './middleware/rate-limit.js';
import { securityHeaders, apiSecurityHeaders } from './middleware/security.js';
import {
  createJsonRpcError,
  JsonRpcErrorCode,
  McpErrorCode,
  getErrorMessage,
} from './types/mcp-errors.js';

// Prometheus Metrics
import { initializeMetrics, getMetrics } from './metrics/prometheus.js';
import { metricsMiddleware } from './metrics/middleware.js';

// MCP SDK imports - Transport는 TransportManager에서 관리

// Express 앱 초기화
const app = express();
const port = config.MCP_PROXY_PORT;

// 세션 서비스 초기화
const sessionService = new SessionService();

// Express app.locals에 SessionService 등록 (OAuth 라우트에서 접근 가능하도록)
app.locals.sessionService = sessionService;

// Session-Scoped Transport 패턴
// MCP Proxy는 OAuth 서버이지 클라이언트가 아닙니다.
// Claude Code가 MCP 클라이언트로서 동적 클라이언트 등록을 수행합니다.
const transportManager = new TransportManager({
  sessionService,
  config: {
    MCP_BASE_URL: config.MCP_BASE_URL,
    BACKEND_BASE_URL: config.BACKEND_BASE_URL,
    BACKEND_PUBLIC_URL: config.BACKEND_PUBLIC_URL,
  },
});

// 도구 등록 (서버 시작 시 한 번만)
await transportManager.registerTools();

logger.info({
  pattern: 'Session-Scoped Transport',
  info: '단일 MCP 서버 + 세션별 Transport 재사용'
}, '✅ Transport Manager initialized with Session-Scoped Transport pattern');

// Prometheus 메트릭 초기화
initializeMetrics();

// ====================================================================================

// 보안 헤더 미들웨어 (가장 먼저 적용)
app.use(securityHeaders);
app.use(apiSecurityHeaders);

// 미들웨어 - 큰 마크다운 파일을 위해 10MB 제한으로 증가
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS 설정 (보안 강화)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = config.CORS_ORIGINS.split(',').map(o => o.trim());

  // Origin 검증
  let isAllowed = false;

  if (origin) {
    for (const allowed of allowedOrigins) {
      // 와일드카드 패턴 지원 (localhost:* 등)
      const pattern = allowed.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(origin)) {
        isAllowed = true;
        break;
      }
    }

    // Origin 허용 시에만 CORS 헤더 설정
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }

  // 공통 CORS 헤더
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');

  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.sendStatus(isAllowed ? 204 : 403);
  }

  // Origin이 허용되지 않은 경우 (프로덕션에서만 차단)
  if (origin && !isAllowed && config.NODE_ENV === 'production') {
    logger.warn({ origin, allowed: allowedOrigins }, '⚠️ CORS: Blocked origin');
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  next();
});

// Prometheus 메트릭 수집 미들웨어
// 모든 HTTP 요청에 대해 자동으로 메트릭 수집
app.use(metricsMiddleware);

// HTTP 요청 로깅 - 개발 환경 또는 info 레벨 이상에서만 활성화
if (config.NODE_ENV === 'development' || config.LOG_LEVEL === 'info' || config.LOG_LEVEL === 'debug') {
  app.use(httpLogger);
}

// 정적 파일 제공 (OAuth 콜백 HTML 등)
app.use(express.static(path.join(__dirname, '../public')));

// 서버 시작 시간 기록
const serverStartTime = Date.now();

// 헬스 체크 (루트 레벨) - Session-Scoped Transport
app.get('/health', (req, res) => {
  const uptime = Date.now() - serverStartTime;

  res.json({
    status: 'healthy',
    service: 'MCP Proxy Server',
    version: '5.1.0',  // Session-Scoped Transport version
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    pattern: 'Session-Scoped Transport',
    uptime: {
      milliseconds: uptime,
      seconds: Math.floor(uptime / 1000),
      minutes: Math.floor(uptime / 60000),
      hours: Math.floor(uptime / 3600000),
    },
    mcpServer: {
      ready: transportManager.isReady(),
      toolsRegistered: transportManager.isReady(),
    },
    limits: {
      rateLimit: {
        windowMs: config.RATE_LIMIT_WINDOW_MS,
        maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
      },
    },
    redis: 'connected', // sessionService에서 실제 연결 상태 확인 가능
  });
});

// Prometheus 메트릭 엔드포인트
// Prometheus가 주기적으로 scrape하여 메트릭 수집
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const metrics = await getMetrics();
    res.send(metrics);
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to generate metrics');
    res.status(500).send('Failed to generate metrics');
  }
});

logger.info('📊 Prometheus metrics endpoint: GET /metrics');

// 라우터 등록
app.use(createOAuthRoutes());  // OAuth 콜백 웹페이지 (GET /oauth/callback) + Discovery 엔드포인트
app.use('/mcp/sessions', createSessionRoutes(sessionService));  // MCP 표준 경로
app.use('/mcp/sessions', createProxyRoutes(sessionService));  // proxy 엔드포인트를 sessions 경로에 포함
app.use('/mcp', createMcpRoutes(sessionService));  // MCP 표준 경로

// ====================================================================================
// OAuth 프록시 (백엔드로 전달)
// Claude Code가 OAuth 인증을 시도할 때 프록시 서버(3002)를 거쳐 백엔드(3000)로 요청 전달
// ====================================================================================

import axios from 'axios';

/**
 * GET /api/v1/oauth/authorize - MCP OAuth 승인 페이지 리다이렉트
 *
 * 브라우저가 이 엔드포인트에 접근하면 Frontend React 페이지로 리다이렉트
 * - Frontend React 페이지: http://localhost:3001/oauth/authorize
 * - 사용자 인증 컨텍스트 및 블로그 선택 UI 제공
 * - 승인 시 POST /api/v1/oauth/authorize로 전달 (Backend API)
 */
app.get('/api/v1/oauth/authorize', (req, res) => {
  logger.debug({
    query: req.query,
    hasCookie: !!req.cookies?.access_token,
  }, '🔐 OAuth authorize 페이지 → Frontend React 리다이렉트');

  // Frontend React 페이지로 리다이렉트 (쿼리 파라미터 보존)
  const frontendUrl = config.FRONTEND_URL || 'http://localhost:3001';
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const redirectUrl = `${frontendUrl}/oauth/authorize${queryString ? `?${queryString}` : ''}`;

  res.redirect(redirectUrl);
});

/**
 * 나머지 OAuth API - Backend로 프록시
 * - POST /api/v1/oauth/authorize (승인/거부 처리)
 * - GET /api/v1/oauth/authorize-data (인증 데이터)
 * - POST /api/v1/oauth/token (토큰 교환)
 * - POST /api/v1/oauth/introspect (토큰 검증)
 * - POST /api/v1/oauth/revoke (토큰 취소)
 * - POST /api/v1/oauth/register (Dynamic Client Registration)
 */
app.use('/api/v1/oauth', async (req, res) => {
  try {
    const backendUrl = `${config.BACKEND_BASE_URL}/api/v1/oauth${req.path}`;

    logger.debug({
      method: req.method,
      path: req.path,
      backendUrl,
    }, '🔄 OAuth 프록시: 백엔드로 요청 전달');

    // 백엔드로 프록시 요청
    const response = await axios({
      method: req.method,
      url: backendUrl,
      params: req.query,
      data: req.body,
      headers: {
        ...req.headers,
        host: undefined,  // host 헤더는 제거 (백엔드 호스트로 자동 설정됨)
      },
      validateStatus: () => true,  // 모든 상태 코드 허용
    });

    // 백엔드 응답을 그대로 전달
    res.status(response.status);
    Object.keys(response.headers).forEach(key => {
      res.setHeader(key, response.headers[key]);
    });
    res.send(response.data);
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ OAuth 프록시 실패');
    res.status(500).json({ error: 'OAuth proxy failed' });
  }
});

logger.info('✅ OAuth endpoints registered:');
logger.info('   - GET  /api/v1/oauth/authorize → Frontend React redirect (OAuth UI)');
logger.info('   - POST /api/v1/oauth/* → Backend API proxy');

// ====================================================================================
// MCP Streamable HTTP 엔드포인트 (Modern - 2025-03-26 spec)
// ====================================================================================

/**
 * GET /mcp - SSE Stream Endpoint (MCP 표준 준수)
 *
 * Server-Sent Events 스트림으로 서버→클라이언트 이벤트 전송
 * - Accept: text/event-stream 헤더 필수
 * - Mcp-Session-Id 헤더로 세션 추적
 * - Transport가 자동으로 handleGetRequest() 호출
 * - Rate limiting applied (세션 또는 IP 기반)
 */
app.get('/mcp', mcpRateLimiter, async (req, res) => {
  try {
    // 1. Mcp-Session-Id 헤더에서 세션 ID 가져오기
    const clientSessionIdHeader = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(clientSessionIdHeader)
      ? clientSessionIdHeader[0]
      : clientSessionIdHeader;

    // 세션 ID 필수 (SSE 스트림은 기존 세션에 연결)
    if (!sessionId) {
      logger.warn('⚠️ SSE stream request without session ID');
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: Mcp-Session-Id header required for SSE stream'
        },
        id: null
      });
    }

    // 2. Accept 헤더 검증 (text/event-stream 필수)
    const acceptHeader = req.headers['accept'];
    if (!acceptHeader?.includes('text/event-stream')) {
      logger.warn({
        sessionId: sessionId.substring(0, 8),
        acceptHeader
      }, '⚠️ SSE stream request without proper Accept header');
      return res.status(406).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Not Acceptable: Client must accept text/event-stream'
        },
        id: null
      });
    }

    logger.debug({
      sessionId: sessionId.substring(0, 8),
      acceptHeader,
      userAgent: req.headers['user-agent']
    }, '📡 SSE stream connection request');

    // 3. 세션별 Transport 가져오기 (없으면 생성, 있으면 재사용)
    const transport = await transportManager.getOrCreateTransport(sessionId);

    // 4. SSE 스트림 처리 (AsyncLocalStorage에 세션 ID 저장)
    // Transport가 자동으로 handleGetRequest() 호출하여 SSE 스트림 시작
    await sessionContext.run({ sessionId }, async () => {
      await transport.handleRequest(req, res);
    });

    logger.info({
      sessionId: sessionId.substring(0, 8)
    }, '✅ SSE stream connected');

  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack
    }, '❌ SSE stream failed');

    // handleRequest 실행 전 에러만 처리 (실행 후 에러는 이미 응답 완료)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error'
        },
        id: null
      });
    }
  }
});

/**
 * POST /mcp - Modern Streamable HTTP Transport (Session-Scoped) - MCP 표준 준수
 *
 * Single endpoint for all MCP requests
 * - Session ID tracked via Mcp-Session-Id header
 * - JSON-RPC 2.0 protocol
 * - Session-scoped transport (세션별로 재사용)
 * - Rate limiting applied (세션 또는 IP 기반)
 * - OAuth 2.0 인증 필수 (RFC 6750, RFC 9728 준수)
 */
app.post('/mcp', mcpRateLimiter, async (req, res) => {
  try {
    // 1. Mcp-Session-Id 헤더에서 세션 ID 가져오기 (없으면 생성)
    // MCP 공식 스펙 2025-03-26: Mcp-Session-Id (X- 접두사 없음)
    const clientSessionIdHeader = req.headers['mcp-session-id'];
    const sessionId = (Array.isArray(clientSessionIdHeader)
      ? clientSessionIdHeader[0]
      : clientSessionIdHeader) || crypto.randomUUID();

    // 2. 응답 헤더에 세션 ID 미리 설정 (handleRequest 호출 전에)
    res.setHeader('Mcp-Session-Id', sessionId);

    // 3. OAuth 2.0 인증 체크 (RFC 6750, RFC 9728 준수)
    const method = req.body?.method;
    const toolName = req.body?.params?.name;

    // 인증이 필요한 메서드 리스트
    // tools/list, initialize 등은 인증 없이 허용
    const AUTH_REQUIRED_METHODS = [
      'tools/call',  // create_post 등 모든 도구 호출
    ];

    // 인증 예외 도구 리스트
    // RFC 9728 표준: 인증되지 않은 요청 → 401 + WWW-Authenticate → 브라우저 자동 실행
    //
    // ✅ MCP 표준 OAuth 플로우 (자동 브라우저 열기):
    // 1. 첫 번째 도구 호출 (예: get_writing_style_guide) → 401 발생
    // 2. Claude Code가 WWW-Authenticate 헤더 파싱
    // 3. OAuth Discovery 및 Dynamic Client Registration 자동 수행
    // 4. 브라우저 자동 열기 (사용자 승인 요청)
    // 5. Access Token 획득 후 원래 요청 재시도
    //
    // ⚠️ CRITICAL: get_writing_style_guide를 AUTH_EXEMPT에 추가하면 안됩니다!
    // - get_writing_style_guide가 인증 없이 성공하면
    // - 사용자가 블로그 포스트를 작성한 후
    // - create_post에서 401 에러가 발생합니다
    // - 결과: 글을 다 쓴 후에 인증 에러 (최악의 UX)
    //
    // ✅ 올바른 플로우:
    // - 첫 번째 도구 호출(get_writing_style_guide)에서 401 발생
    // - OAuth 인증 완료 후 세션에 토큰 저장
    // - 이후 모든 도구 호출(create_post 포함)에서 세션 기반 인증 통과
    const AUTH_EXEMPT_TOOLS = [
      'diagnose_connection',  // ✅ 진단 도구만 인증 면제
    ];

    if (AUTH_REQUIRED_METHODS.includes(method) && !AUTH_EXEMPT_TOOLS.includes(toolName)) {
      // 1. 먼저 세션 기반 인증 시도 (MCP SDK가 Authorization 헤더를 보내지 않는 경우 대비)
      const session = await sessionService.getSession(sessionId);

      // 1-a. 세션에 유효한 토큰이 있으면 Authorization 헤더 없이도 통과 (Fallback 인증)
      if (session?.accessToken && (!session.tokenExpiresAt || session.tokenExpiresAt > Date.now())) {
        logger.debug({
          sessionId: sessionId.substring(0, 8),
          method,
          authMethod: 'session-based'
        }, '✅ Session-based authentication (MCP SDK Authorization header fallback)');
        // 인증 통과 - 다음 단계로 진행
      }
      // 1-b. 세션에 토큰이 없으면 Authorization 헤더 체크 (RFC 6750 표준 방식)
      else {
        const authHeader = req.headers.authorization;

        // Authorization 헤더 검증
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          logger.info({
            sessionId: sessionId.substring(0, 8),
            method,
            toolName,
            hasAuthHeader: !!authHeader,
            hasSession: !!session,
            hasSessionToken: !!session?.accessToken
          }, '🔐 Authentication required - triggering OAuth flow');

          // RFC 9728: WWW-Authenticate 헤더로 resource_metadata URL 제공
          // Claude Code MCP SDK가 이 헤더를 읽어 OAuth discovery 플로우 자동 시작
          // ✅ 올바른 엔드포인트: /.well-known/oauth-protected-resource (RFC 9728 표준 경로)
          // ✅ HTTP 401 필수: MCP 표준에 따라 클라이언트가 WWW-Authenticate 헤더 처리
          res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${config.MCP_BASE_URL}/.well-known/oauth-protected-resource"`);

          // HTTP 401 반환 (MCP 표준 요구사항)
          // Claude Code는 이 응답을 받으면:
          // 1. WWW-Authenticate 헤더 파싱
          // 2. /.well-known/oauth-protected-resource 호출
          // 3. Dynamic Client Registration
          // 4. 브라우저 열어서 사용자 승인 요청
          // 5. Access Token 획득 후 원래 요청 재시도
          return res.status(401).json(createJsonRpcError(
            JsonRpcErrorCode.INVALID_REQUEST,
            '🔐 Authentication required. OAuth authorization flow is starting. Please approve in your browser when it opens, then this request will be retried automatically.',
            req.body?.id || null
          ));
        }

        // Bearer 토큰 추출 및 검증 (RFC 6750 표준)
        const token = authHeader.substring(7); // "Bearer " 제거

        // 토큰이 세션 토큰과 일치하는지 확인 (선택적 검증)
        if (session && session.accessToken !== token) {
          logger.warn({
            sessionId: sessionId.substring(0, 8),
            tokenMatch: false
          }, '⚠️ Authorization header token does not match session token');
        }

        logger.debug({
          sessionId: sessionId.substring(0, 8),
          method,
          authMethod: 'authorization-header'
        }, '✅ Authorization header validated');
      }
    }

    // 4. Session-Scoped Transport 패턴
    logger.debug({
      sessionId: sessionId.substring(0, 8),
      pattern: 'Session-Scoped Transport',
      acceptHeader: req.headers['accept'],
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent'],
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      method: req.body?.method
    }, '📦 Processing MCP request');

    // 5. 세션별 Transport 가져오기 (없으면 생성, 있으면 재사용)
    const transport = await transportManager.getOrCreateTransport(sessionId);

    // 6. 요청 처리 (AsyncLocalStorage에 세션 ID 저장하여 도구 핸들러에서 접근 가능하게 함)
    await sessionContext.run({ sessionId }, async () => {
      await transport.handleRequest(req, res, req.body);
    });

    // 주의: handleRequest가 응답을 완료하므로 여기서는 더 이상 응답을 수정하지 않음
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, '❌ MCP request failed');

    // handleRequest 실행 전 에러만 처리 (실행 후 에러는 이미 응답 완료)
    if (!res.headersSent) {
      // 에러 타입별 처리
      let errorCode: JsonRpcErrorCode | McpErrorCode = JsonRpcErrorCode.INTERNAL_ERROR;
      let statusCode = 500;
      let errorMessage = getErrorMessage(JsonRpcErrorCode.INTERNAL_ERROR);

      if (error.message?.includes('Maximum concurrent sessions')) {
        errorCode = McpErrorCode.MAX_SESSIONS_REACHED;
        statusCode = 503;
        errorMessage = getErrorMessage(McpErrorCode.MAX_SESSIONS_REACHED);
      } else if (error.message?.includes('Session not found')) {
        errorCode = McpErrorCode.SESSION_NOT_FOUND;
        statusCode = 404;
        errorMessage = getErrorMessage(McpErrorCode.SESSION_NOT_FOUND);
      } else if (error.message?.includes('timeout')) {
        errorCode = McpErrorCode.TIMEOUT;
        statusCode = 408;
        errorMessage = getErrorMessage(McpErrorCode.TIMEOUT);
      }

      // JSON-RPC 2.0 에러 응답
      res.status(statusCode).json(
        createJsonRpcError(
          errorCode,
          errorMessage,
          req.body?.id || null,
          config.NODE_ENV === 'development' ? { detail: error.message } : undefined
        )
      );
    }
  }
});

/**
 * DELETE /mcp - 세션 종료 (MCP 표준 준수)
 *
 * Claude Code가 연결 종료 시 호출
 * Session-Scoped 패턴: 세션의 Transport를 정리함
 */
app.delete('/mcp', async (req, res) => {
  const clientSessionIdHeader = req.headers['mcp-session-id'];
  const sessionId = Array.isArray(clientSessionIdHeader)
    ? clientSessionIdHeader[0]
    : clientSessionIdHeader;

  if (sessionId) {
    logger.info({
      sessionId: sessionId.substring(0, 8),
      pattern: 'Session-Scoped Transport'
    }, '🔌 Session end notification - cleaning up transport');

    // Transport 정리
    await transportManager.removeTransport(sessionId);
  } else {
    logger.warn('⚠️ Session end without session ID');
  }

  res.status(204).send();
});

logger.info('✅ MCP Streamable HTTP endpoints registered: GET /mcp (SSE), POST /mcp (JSON-RPC), DELETE /mcp (세션 종료) - MCP 표준 준수');

// ====================================================================================

// 404 핸들러
app.use(notFoundHandler);

// 중앙 집중식 에러 핸들러
app.use(errorHandler);

// 서버 시작
const server = app.listen(port, '0.0.0.0', () => {
  logger.info({
    mcpProxyPort: port,
    host: '0.0.0.0',
    environment: config.NODE_ENV,
    redis: `${config.REDIS_HOST}:${config.REDIS_PORT}`,
    architecture: 'MCP Client → Proxy Server → Backend API',
    improvements: [
      '환경 변수 검증 (Zod)',
      '에러 처리 미들웨어',
      'PKCE verifier 별도 저장',
      '라우터 분리 구조',
      'Pino 로거 시스템',
      '요청 ID 추적'
    ]
  }, '🚀 MCP Proxy Server 시작됨');
});

// 서버 에러 핸들링
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.fatal({ port }, `❌ 포트 ${port}가 이미 사용 중입니다`);
  } else if (error.code === 'EACCES') {
    logger.fatal({ port }, `❌ 포트 ${port}에 바인딩할 권한이 없습니다`);
  } else {
    logger.fatal({ error: error.message }, '❌ 서버 시작 실패');
  }
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, '📴 종료 시그널 받음, 서버 종료 중...');

  // 1. HTTP 서버 종료 (신규 요청 거부)
  server.close(() => {
    logger.info('✅ HTTP 서버 종료됨');
  });

  // 2. TransportManager 종료 (Stateless 패턴)
  await transportManager.close();
  logger.info('✅ Transport Manager closed (Stateless pattern)');

  // 3. Redis 연결 종료
  await sessionService.close();
  logger.info('✅ Redis 연결 종료됨');

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 프로세스 레벨 에러는 logger에서 처리됨 (utils/logger.ts)

export default app;