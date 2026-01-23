/**
 * Pino 로거 설정
 *
 * 프로덕션 환경을 위한 구조화된 로깅 시스템
 * - 비동기 로깅으로 성능 영향 최소화
 * - 환경별 로그 레벨 자동 설정
 * - 민감한 정보 자동 필터링
 */

import pino from 'pino';
import os from 'os';
import { config } from '../config/env.validation.js';

// 민감한 정보를 필터링할 필드 목록
const REDACTED_FIELDS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'api_key',
  'apiKey',
  'access_token',
  'refresh_token',
  'client_secret',
];

// 로거 설정
const loggerOptions: pino.LoggerOptions = {
  name: 'mcp-proxy-server',
  level: config.LOG_LEVEL || 'info',

  // 타임스탬프 형식 설정
  timestamp: pino.stdTimeFunctions.isoTime,

  // 요청 ID 추가
  mixin: () => ({
    pid: process.pid,
    hostname: os.hostname(),
  }),

  // 민감한 정보 필터링
  redact: {
    paths: REDACTED_FIELDS.flatMap(field => [
      field,
      `*.${field}`,
      `*.*.${field}`,
      `req.headers.${field}`,
      `res.headers.${field}`,
      `error.${field}`,
    ]),
    remove: true,
  },

  // 직렬화 설정
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req: any) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      remoteAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
      headers: res.getHeaders?.(),
    }),
  },

  // 에러 직렬화 시 스택 트레이스 포함
  errorKey: 'error',
};

// 개발 환경에서는 pretty print 사용
const transport = config.LOG_PRETTY === true && config.NODE_ENV === 'development'
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
        messageFormat: '{msg} [{req.id}]',
      },
    })
  : undefined;

// 로거 인스턴스 생성
export const logger = transport
  ? pino(loggerOptions, transport)
  : pino(loggerOptions);

// 로거 레벨별 헬퍼 함수
export const logInfo = (message: string, data?: any) => {
  logger.info(data, message);
};

export const logError = (message: string, error?: any) => {
  logger.error({ error }, message);
};

export const logWarn = (message: string, data?: any) => {
  logger.warn(data, message);
};

export const logDebug = (message: string, data?: any) => {
  logger.debug(data, message);
};

// HTTP 요청 로거 미들웨어
export const httpLogger = (req: any, res: any, next: any) => {
  // 요청 시작 시간 기록
  const start = Date.now();

  // 요청 ID 생성 (없는 경우)
  if (!req.id) {
    req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 폴링/헬스체크 엔드포인트는 debug 레벨로 로깅 (로그 verbosity 감소)
  const isPollingEndpoint = req.url.includes('/status') || 
                            (req.method === 'GET' && req.url === '/mcp');
  const logLevel = isPollingEndpoint ? 'debug' : 'info';

  // 요청 로깅
  logger[logLevel]({
    req,
    type: 'REQUEST',
  }, `Incoming ${req.method} ${req.url}`);

  // 응답 완료 시 로깅
  const originalSend = res.send;
  res.send = function(data: any) {
    res.send = originalSend;
    const duration = Date.now() - start;

    logger[logLevel]({
      req,
      res,
      duration,
      type: 'RESPONSE',
    }, `${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);

    return res.send(data);
  };

  next();
};

// 프로세스 레벨 에러 핸들링
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
});

export default logger;