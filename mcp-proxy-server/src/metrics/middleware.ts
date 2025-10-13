/**
 * HTTP Metrics Middleware
 *
 * 모든 HTTP 요청/응답에 대한 메트릭 자동 수집
 * - 요청 수 카운팅
 * - 응답 시간 측정
 * - 요청/응답 크기 추적
 * - 상태 코드별 분류
 */

import { Request, Response, NextFunction } from 'express';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
} from './prometheus.js';

/**
 * HTTP 메트릭 미들웨어
 *
 * Express 미들웨어로 등록하여 모든 요청에 대해 자동으로 메트릭 수집
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 요청 시작 시간 기록 (고정밀 타이머 사용)
  const startTime = process.hrtime();

  // 경로 정규화 (동적 파라미터를 일반화)
  // 예: /api/posts/123 → /api/posts/:id
  const path = normalizePath(req.path);

  // 요청 크기 측정 (Content-Length 헤더 또는 바디 크기)
  const requestSize = parseInt(req.get('content-length') || '0', 10);
  if (requestSize > 0) {
    httpRequestSize.observe({ method: req.method, path }, requestSize);
  }

  // 원래 res.send 함수 저장
  const originalSend = res.send;

  // res.send 함수를 오버라이드하여 응답 시 메트릭 수집
  res.send = function (data: any): Response {
    // 응답 완료 시간 계산
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9; // 초 단위로 변환

    // 상태 코드 추출
    const statusCode = res.statusCode.toString();

    // 메트릭 기록
    httpRequestsTotal.inc({
      method: req.method,
      path,
      status_code: statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        path,
        status_code: statusCode,
      },
      duration
    );

    // 응답 크기 측정
    let responseSize = 0;
    if (data) {
      if (Buffer.isBuffer(data)) {
        responseSize = data.length;
      } else if (typeof data === 'string') {
        responseSize = Buffer.byteLength(data, 'utf8');
      } else if (typeof data === 'object') {
        responseSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
      }
    }

    if (responseSize > 0) {
      httpResponseSize.observe(
        {
          method: req.method,
          path,
          status_code: statusCode,
        },
        responseSize
      );
    }

    // 원래 send 함수 호출
    return originalSend.call(this, data);
  };

  next();
}

/**
 * 경로 정규화
 *
 * 동적 파라미터를 일반화하여 메트릭의 카디널리티를 줄임
 * 예: /api/posts/123 → /api/posts/:id
 *      /api/users/abc-def → /api/users/:id
 */
function normalizePath(path: string): string {
  // 메트릭 엔드포인트는 그대로 반환
  if (path === '/metrics' || path === '/health') {
    return path;
  }

  // UUID 패턴 정규화 (예: 550e8400-e29b-41d4-a716-446655440000)
  path = path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:id'
  );

  // 숫자만 있는 경로 파라미터 정규화 (예: /api/posts/123)
  path = path.replace(/\/\d+/g, '/:id');

  // 영문자+숫자 조합 ID 정규화 (예: /api/sessions/abc123def)
  path = path.replace(/\/[a-z0-9]{8,}/gi, '/:id');

  // 세션 ID와 같은 긴 hex 문자열 정규화
  path = path.replace(/\/[a-f0-9]{32,}/gi, '/:id');

  return path;
}

/**
 * 메트릭 엔드포인트 제외 미들웨어
 *
 * /metrics 엔드포인트 자체는 메트릭 수집에서 제외하여
 * 불필요한 노이즈를 방지
 */
export function skipMetricsForPath(path: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === path) {
      return next();
    }
    metricsMiddleware(req, res, next);
  };
}
