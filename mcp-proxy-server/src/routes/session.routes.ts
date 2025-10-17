/**
 * 세션 관련 라우트
 *
 * MCP 표준 준수: Claude Code가 OAuth 플로우를 주도합니다.
 * - 401 Unauthorized → WWW-Authenticate 헤더
 * - Discovery 엔드포인트 조회
 * - Dynamic Client Registration
 * - OAuth Authorization 플로우
 */

import { Router } from 'express';
import { SessionService } from '../services/SessionService.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { ApiResponse, SessionStatus } from '../types/index.js';

export function createSessionRoutes(sessionService: SessionService): Router {
  const router = Router();

  /**
   * 세션 상태 확인
   * GET /api/v1/mcp/sessions/:sessionId/status
   */
  router.get('/:sessionId/status', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await sessionService.getSession(sessionId);

    const status: SessionStatus = session ? {
      valid: true,
      hasToken: !!session.accessToken,
      tokenExpiresAt: session.tokenExpiresAt ? new Date(session.tokenExpiresAt) : null,
    } : {
      valid: false,
      hasToken: false,
    };

    const response: ApiResponse<SessionStatus> = {
      success: true,
      data: status,
    };

    res.json(response);
  }));

  /**
   * 세션 삭제 (로그아웃)
   * DELETE /api/v1/mcp/sessions/:sessionId
   */
  router.delete('/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    await sessionService.deleteSession(sessionId);
    res.sendStatus(204);
    console.log(`✅ 세션 삭제: ${sessionId.substring(0, 8)}...`);
  }));

  /**
   * 세션 통계
   * GET /api/v1/mcp/sessions/stats
   */
  router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await sessionService.getStats();

    const response: ApiResponse = {
      success: true,
      data: stats,
    };

    res.json(response);
  }));

  return router;
}