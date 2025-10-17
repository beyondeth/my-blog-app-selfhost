/**
 * MCP 내부 유틸리티 라우트
 *
 * MCP 표준 도구는 src/tools/ 디렉토리에 구현되어 있습니다.
 * 이 파일은 내부 관리용 헬퍼 엔드포인트만 포함합니다.
 */

import { Router } from 'express';
import axios from 'axios';
import { SessionService } from '../services/SessionService.js';
import { config } from '../config/env.validation.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { HealthCheckResponse } from '../types/index.js';

export function createMcpRoutes(sessionService: SessionService): Router {
  const router = Router();

  /**
   * 웹 세션 검증 엔드포인트 (내부용)
   * POST /api/v1/mcp/validate-session
   *
   * Backend API로 프록시하여 MCP 세션과 웹 세션 연결 검증
   */
  router.post('/validate-session', asyncHandler(async (req, res) => {
    const { sessionId, userId } = req.body;

    if (!sessionId) {
      return res.json({
        success: false,
        valid: false,
        message: '세션 ID가 필요합니다',
      });
    }

    try {
      const response = await axios.post(
        `${config.BACKEND_API_URL}/mcp/validate-session`,
        { sessionId, userId },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-MCP-Internal': 'true',
          },
        }
      );

      console.log(`🔍 MCP 세션 검증: ${sessionId.substring(0, 8)}... - ${response.data.valid ? '유효' : '무효'}`);

      return res.json({
        success: true,
        valid: response.data.valid,
        userId: response.data.userId,
        message: response.data.message,
      });
    } catch (error: any) {
      console.error('❌ 세션 검증 실패:', error.response?.data || error.message);
      return res.json({
        success: false,
        valid: false,
        message: '세션 검증 중 오류가 발생했습니다',
      });
    }
  }));

  /**
   * 헬스 체크 엔드포인트
   * POST /api/v1/mcp/health
   */
  router.post('/health', asyncHandler(async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;

    let sessionInfo = null;
    if (sessionId) {
      const session = await sessionService.getSession(sessionId);
      if (session) {
        sessionInfo = {
          valid: true,
          hasToken: !!session.accessToken,
          tokenExpiresAt: session.tokenExpiresAt ? new Date(session.tokenExpiresAt) : null,
        };
      }
    }

    const response: HealthCheckResponse = {
      status: 'healthy',
      service: 'MCP Proxy Server',
      timestamp: new Date().toISOString(),
      session: sessionInfo,
      backend: {
        url: config.BACKEND_API_URL,
        connected: true,  // 실제로는 Backend 연결 체크 필요
      },
      can_create_posts: sessionInfo?.hasToken || false,
    };

    res.json(response);
  }));

  return router;
}