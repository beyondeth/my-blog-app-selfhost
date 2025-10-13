/**
 * MCP 서비스 계층 통합 인터페이스
 *
 * DockashellServer 패턴을 참고하여 모든 서비스를 중앙에서 관리
 * 도구 핸들러에서 필요한 서비스에 쉽게 접근 가능
 */

import { SessionService } from '../services/SessionService.js';

/**
 * MCP 도구 핸들러에서 사용되는 서비스들
 */
export interface McpServices {
  sessionService: SessionService;
  config: McpConfig;
}

/**
 * MCP 설정 인터페이스
 */
export interface McpConfig {
  BACKEND_BASE_URL: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_REDIRECT_URI: string;
}

/**
 * 도구 핸들러 컨텍스트
 * 세션별 격리된 컨텍스트와 서비스 접근
 */
export interface ToolContext extends McpServices {
  currentSessionId: string;
}

/**
 * 도구 핸들러 함수 타입
 */
export type ToolHandler<TArgs = any, TResult = any> = (
  args: TArgs,
  context: ToolContext
) => Promise<TResult>;