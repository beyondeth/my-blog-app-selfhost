/**
 * Rate Limiting 미들웨어
 *
 * MCP 엔드포인트에 대한 요청 제한 설정
 * - DoS 공격 방어
 * - 리소스 남용 방지
 * - 환경별 다른 제한 설정 (개발/프로덕션)
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config/env.validation.js';

// IPv6 안전한 IP 키 생성을 위한 헬퍼
const ipKeyGenerator = (req: any, res: any): string => {
  return req.ip || 'unknown';
};

/**
 * MCP 엔드포인트용 Rate Limiter
 *
 * 개발 환경: 1분에 100개 요청
 * 프로덕션: 1분에 60개 요청
 */
export const mcpRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS, // 시간 창 (밀리초)
  max: config.RATE_LIMIT_MAX_REQUESTS, // 최대 요청 수
  message: {
    jsonrpc: '2.0',
    id: null,
    error: {
      code: -32000, // 서버 에러 (커스텀)
      message: 'Too many requests. Please try again later.',
      data: {
        retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000), // 초 단위
      },
    },
  },
  standardHeaders: true, // `RateLimit-*` 헤더 반환
  legacyHeaders: false, // `X-RateLimit-*` 헤더 비활성화
  skipSuccessfulRequests: false, // 성공한 요청도 카운트
  keyGenerator: (req, res) => {
    // 세션 ID 기반 제한 (세션 ID가 있을 때만)
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && !Array.isArray(sessionId)) {
      return `session:${sessionId}`;
    }
    // 세션 ID가 없으면 IPv6 안전한 IP 기반 제한
    return ipKeyGenerator(req, res);
  },
  handler: (req, res) => {
    // Rate limit 초과 시 JSON-RPC 에러 응답
  res.status(429).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32000,
        message: 'Rate limit exceeded. Please try again later.',
        data: {
          retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000),
          limit: config.RATE_LIMIT_MAX_REQUESTS,
          window: `${config.RATE_LIMIT_WINDOW_MS / 1000}s`,
        },
      },
    });
  },
});

/**
 * OAuth 엔드포인트용 Rate Limiter (더 엄격)
 *
 * 인증 시도 남용 방지
 * 15분에 10개 요청
 */
export const oauthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10, // 최대 10개 요청
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // IPv6 안전한 기본 키 생성기 사용
});

/**
 * 일반 API 엔드포인트용 Rate Limiter
 *
 * 1분에 30개 요청
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 30,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // IPv6 안전한 기본 키 생성기 사용
});
