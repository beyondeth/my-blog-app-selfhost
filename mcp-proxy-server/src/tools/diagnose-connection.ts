/**
 * diagnose_connection 도구
 *
 * Backend API 연결 상태를 진단합니다.
 * - Backend API 헬스체크
 * - OAuth2 엔드포인트 확인
 * - 세션 상태 확인
 */

import axios from 'axios';
import { SessionService } from '../services/SessionService.js';

export interface DiagnoseConnectionToolParams {
  sessionId?: string; // 선택사항: 세션 ID가 있으면 세션 상태도 확인
}

export interface DiagnoseConnectionToolContext {
  sessionService: SessionService;
  config: {
    BACKEND_BASE_URL: string;
  };
}

/**
 * diagnose_connection 도구 핸들러
 */
export async function diagnoseConnectionHandler(
  params: DiagnoseConnectionToolParams,
  context: DiagnoseConnectionToolContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { sessionService, config } = context;
  const { sessionId } = params;

  const diagnostics: string[] = [
    '🔍 **Backend API 연결 진단**',
    '',
  ];

  // 1. Backend API 헬스체크
  try {
    const response = await axios.get(`${config.BACKEND_BASE_URL}/api/v1/mcp/health`, {
      timeout: 5000,
    });

    diagnostics.push(`✅ **Backend API:** 정상 작동 중`);
    diagnostics.push(`   - Status: ${response.data.status}`);
    diagnostics.push(`   - URL: ${config.BACKEND_BASE_URL}`);
  } catch (error: any) {
    diagnostics.push(`❌ **Backend API:** 연결 실패`);
    diagnostics.push(`   - Error: ${error.message}`);
    diagnostics.push(`   - URL: ${config.BACKEND_BASE_URL}`);
  }

  diagnostics.push('');

  // 2. OAuth2 엔드포인트 확인
  try {
    // Authorization endpoint는 GET으로 확인 (실제 인증은 안 함)
    const response = await axios.get(`${config.BACKEND_BASE_URL}/oauth/authorize`, {
      timeout: 5000,
      validateStatus: () => true, // 모든 상태 코드 허용
    });

    if (response.status === 302 || response.status === 400) {
      // 302: 리다이렉트 (정상)
      // 400: 파라미터 없음 (정상, 엔드포인트는 존재)
      diagnostics.push(`✅ **OAuth2 Authorization:** 사용 가능`);
    } else {
      diagnostics.push(`⚠️ **OAuth2 Authorization:** 예상치 못한 응답 (${response.status})`);
    }
  } catch (error: any) {
    diagnostics.push(`❌ **OAuth2 Authorization:** 연결 실패`);
    diagnostics.push(`   - Error: ${error.message}`);
  }

  diagnostics.push('');

  // 3. 세션 상태 확인 (sessionId가 제공된 경우)
  if (sessionId) {
    const session = await sessionService.getSession(sessionId);

    if (!session) {
      diagnostics.push(`❌ **Session:** 존재하지 않음 (ID: ${sessionId.substring(0, 8)}...)`);
    } else {
      diagnostics.push(`✅ **Session:** 활성 상태`);
      diagnostics.push(`   - Session ID: ${sessionId.substring(0, 8)}...`);
      diagnostics.push(`   - Created: ${new Date(session.createdAt).toLocaleString()}`);
      diagnostics.push(`   - Last Accessed: ${new Date(session.lastAccessedAt).toLocaleString()}`);

      // Access token 확인
      const accessToken = await sessionService.getAccessToken(sessionId);
      if (accessToken) {
        diagnostics.push(`   - Access Token: ✅ 유효`);
      } else {
        diagnostics.push(`   - Access Token: ❌ 만료 또는 없음`);
      }

      // Preferences 확인
      if (session.preferences) {
        diagnostics.push(`   - Preferences: ${JSON.stringify(session.preferences)}`);
      }
    }
  } else {
    diagnostics.push(`ℹ️ **Session:** sessionId를 제공하면 세션 상태도 확인됩니다.`);
  }

  diagnostics.push('');
  diagnostics.push('---');
  diagnostics.push('');
  diagnostics.push('✅ 모든 항목이 정상이면 MCP 서버가 올바르게 작동 중입니다.');
  diagnostics.push('❌ 문제가 있으면 환경변수와 Backend API 상태를 확인해주세요.');

  return {
    content: [
      {
        type: 'text',
        text: diagnostics.join('\n'),
      },
    ],
  };
}

/**
 * MCP 도구 스키마
 */
export const diagnoseConnectionTool = {
  schema: {
    method: 'tools/call',
    params: {
      name: 'diagnose_connection',
      arguments: {
        sessionId: 'string (optional)',
      },
    },
  },
  handler: diagnoseConnectionHandler,
};
