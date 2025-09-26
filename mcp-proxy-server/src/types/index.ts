/**
 * 공통 타입 정의
 *
 * 프로젝트 전체에서 사용되는 타입들을 중앙 집중식으로 관리
 */

import { Request } from 'express';

/**
 * 세션이 포함된 Request 타입
 */
export interface AuthenticatedRequest extends Request {
  sessionId?: string;
  userId?: string;
  blogId?: string;
}

/**
 * API 응답 타입
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
}

/**
 * OAuth 토큰 응답
 */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}


/**
 * MCP 포스트 생성 요청
 */
export interface CreatePostRequest {
  title: string;
  content: string;
  tags?: string[];
  qualityScore?: number;
}

/**
 * 세션 상태
 */
export interface SessionStatus {
  valid: boolean;
  hasToken: boolean;
  tokenExpiresAt?: Date | null;
}

/**
 * 프록시 요청
 */
export interface ProxyRequest {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

/**
 * 헬스 체크 응답
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  session?: SessionStatus | null;
  backend?: {
    url: string;
    connected: boolean;
  };
  can_create_posts?: boolean;
}