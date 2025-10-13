/**
 * 중앙 집중식 에러 처리 미들웨어
 *
 * 모든 에러를 표준화된 형식으로 처리하고
 * 민감한 정보가 클라이언트에 노출되지 않도록 보호
 */

import { Request, Response, NextFunction } from 'express';
import { AxiosError } from 'axios';
import { config } from '../config/env.validation.js';
import { errorsTotal } from '../metrics/prometheus.js';

// 에러 응답 타입 정의
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

// 커스텀 에러 클래스
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// 에러 코드 상수
export const ErrorCodes = {
  // 인증 관련
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_INVALID: 'SESSION_INVALID',
  TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',

  // 검증 관련
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_PARAMS: 'MISSING_PARAMS',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // 서버 관련
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DOWNSTREAM_ERROR: 'DOWNSTREAM_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/**
 * 에러를 안전한 형태로 변환
 * 프로덕션에서는 민감한 정보 제거
 */
function sanitizeError(error: any, isDevelopment: boolean): ErrorResponse {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(7);

  // AppError인 경우
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: isDevelopment ? error.details : undefined,
        timestamp,
        requestId,
      },
    };
  }

  // Axios 에러인 경우 (Backend API 호출 실패)
  if (error.isAxiosError || error instanceof AxiosError) {
    const axiosError = error as AxiosError;

    // Backend API에서 반환한 에러 구조 유지
    if (axiosError.response?.data) {
      return {
        success: false,
        error: {
          code: ErrorCodes.DOWNSTREAM_ERROR,
          message: 'Backend API 호출 실패',
          details: isDevelopment ? axiosError.response.data : undefined,
          timestamp,
          requestId,
        },
      };
    }

    // 네트워크 에러
    if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: {
          code: ErrorCodes.SERVICE_UNAVAILABLE,
          message: 'Backend 서비스에 연결할 수 없습니다',
          details: isDevelopment ? axiosError.message : undefined,
          timestamp,
          requestId,
        },
      };
    }
  }

  // 기타 에러
  return {
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: isDevelopment ? error.message : '서버 내부 오류가 발생했습니다',
      details: isDevelopment ? {
        stack: error.stack,
        name: error.name,
      } : undefined,
      timestamp,
      requestId,
    },
  };
}

/**
 * 에러 처리 미들웨어
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 개발 환경 여부
  const isDevelopment = config.NODE_ENV === 'development';

  // 에러 로깅 간소화
  // POST 생성 실패 시 간단한 로그만 출력
  if (req.path === '/create-post' || req.path === '/api/v1/mcp/create-post') {
    console.error('[CREATE_POST] FAILED:', error.message || 'Unknown error');
  } else {
    console.error(`[ERROR] ${req.method} ${req.path}:`, error.message || 'Unknown error');
  }

  // 상태 코드 결정
  let statusCode = 500;
  if (error instanceof AppError) {
    statusCode = error.statusCode;
  } else if (error.isAxiosError && error.response) {
    statusCode = error.response.status;
  } else if (error.status) {
    statusCode = error.status;
  }

  // 안전한 에러 응답 생성
  const errorResponse = sanitizeError(error, isDevelopment);

  // 에러 메트릭 기록
  const errorCode = errorResponse.error.code;
  const statusCodeStr = statusCode.toString();
  errorsTotal.inc({
    error_code: errorCode,
    status_code: statusCodeStr,
  });

  // 응답 전송
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 핸들러
 */
export function notFoundHandler(req: Request, res: Response) {
  const error = new AppError(
    404,
    'ENDPOINT_NOT_FOUND',
    `엔드포인트를 찾을 수 없습니다: ${req.method} ${req.path}`
  );

  // 에러 메트릭 기록
  errorsTotal.inc({
    error_code: 'ENDPOINT_NOT_FOUND',
    status_code: '404',
  });

  res.status(404).json(sanitizeError(error, config.NODE_ENV === 'development'));
}

/**
 * 비동기 핸들러 래퍼
 * Promise rejection을 자동으로 catch
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}