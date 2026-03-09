import type { MetricsService } from '../services/MetricsService.js';

/**
 * 도구 컨텍스트 (API Key 또는 OAuth 인증 결과)
 */
export interface ToolContext {
  userData: {
    keyId: string;
    userId: string;
    blogId: string;
    user: { id: string; username: string; email: string };
    blog: { id: string; name: string; slug: string; isPublic?: boolean };
  };
  apiKey: string | null; // API Key 인증 시 사용 (Backend 인증용)
  oauthToken?: string; // OAuth 인증 시 사용 (커스텀 커넥터용)
  oauthScope?: string; // OAuth 인증 시 발급된 scope 원문
  metricsService: MetricsService; // 메트릭 서비스 (도구 호출 추적용)
  config: {
    MCP_BASE_URL: string;
    BACKEND_BASE_URL: string;
    BACKEND_PUBLIC_URL: string;
    FRONTEND_URL: string;
    MCP_SHARED_SECRET?: string;
  };
  route?: string;
}
