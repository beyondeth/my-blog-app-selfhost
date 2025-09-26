/**
 * 프록시 관련 라우트
 *
 * Backend API 호출을 중계하는 프록시 엔드포인트
 */

import { Router } from 'express';
import axios from 'axios';
import { SessionService } from '../services/SessionService';
import { config } from '../config/env.validation';
import { asyncHandler, AppError, ErrorCodes } from '../middleware/error-handler';
import { ProxyRequest, ApiResponse } from '../types';

export function createProxyRoutes(sessionService: SessionService): Router {
  const router = Router();

  /**
   * API 프록시 - 핵심 기능
   * MCP Client는 이 엔드포인트를 통해 Backend API를 호출
   * POST /api/v1/mcp/sessions/proxy
   */
  router.post('/proxy', asyncHandler(async (req, res) => {
    const sessionId = req.headers['x-mcp-session-id'] as string;
    const { method, path, body, headers }: ProxyRequest = req.body;

    if (!sessionId) {
      throw new AppError(400, ErrorCodes.MISSING_PARAMS, 'x-mcp-session-id 헤더 필요');
    }

    // 세션 유효성 검증
    const isValid = await sessionService.validateSession(
      sessionId,
      req.headers['user-agent'],
      req.ip
    );

    if (!isValid) {
      throw new AppError(401, ErrorCodes.SESSION_INVALID, '유효하지 않은 세션');
    }

    // 액세스 토큰 가져오기 (자동 갱신)
    const accessToken = await sessionService.getAccessToken(sessionId);

    if (!accessToken) {
      throw new AppError(401, ErrorCodes.AUTH_REQUIRED, '인증 토큰 없음');
    }

    // Backend API 호출
    const apiUrl = `${config.BACKEND_API_URL}${path}`;

    console.log(`🔄 API 프록시: ${method} ${apiUrl}`);

    const response = await axios({
      method,
      url: apiUrl,
      data: body,
      headers: {
        ...headers,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    res.json(response.data);
  }));

  return router;
}