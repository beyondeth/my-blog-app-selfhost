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
import { SessionService } from './services/SessionService';
import { config } from './config/env.validation';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { createSessionRoutes } from './routes/session.routes';
import { createMcpRoutes } from './routes/mcp.routes';
import { createProxyRoutes } from './routes/proxy.routes';
import { logger, httpLogger } from './utils/logger';

// Express 앱 초기화
const app = express();
const port = config.PORT;

// 세션 서비스 초기화
const sessionService = new SessionService();

// 미들웨어 - 큰 마크다운 파일을 위해 10MB 제한으로 증가
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS 설정
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = config.CORS_ORIGINS?.split(',') || ['http://localhost:*'];

  if (origin && (allowedOrigins.includes('*') || allowedOrigins.some(ao => origin.match(ao.replace(/\*/g, '.*'))))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcp-session-id');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// HTTP 요청 로깅 - 개발 환경 또는 info 레벨 이상에서만 활성화
if (config.NODE_ENV === 'development' || config.LOG_LEVEL === 'info' || config.LOG_LEVEL === 'debug') {
  app.use(httpLogger);
}

// 헬스 체크 (루트 레벨)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MCP Proxy Server',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// 라우터 등록
app.use('/api/v1/mcp/sessions', createSessionRoutes(sessionService));
app.use('/api/v1/mcp/sessions', createProxyRoutes(sessionService));  // proxy 엔드포인트를 sessions 경로에 포함
app.use('/api/v1/mcp', createMcpRoutes(sessionService));

// 404 핸들러
app.use(notFoundHandler);

// 중앙 집중식 에러 핸들러
app.use(errorHandler);

// 서버 시작
const server = app.listen(port, () => {
  logger.info({
    port,
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

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, '📴 종료 시그널 받음, 서버 종료 중...');

  server.close(() => {
    logger.info('✅ HTTP 서버 종료됨');
  });

  await sessionService.close();
  logger.info('✅ Redis 연결 종료됨');

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 프로세스 레벨 에러는 logger에서 처리됨 (utils/logger.ts)

export default app;