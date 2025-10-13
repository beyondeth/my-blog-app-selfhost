/**
 * 세션 관련 라우트
 *
 * OAuth 인증, 세션 관리 등 인증 관련 엔드포인트
 */

import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { SessionService } from '../services/SessionService.js';
import { config } from '../config/env.validation.js';
import { asyncHandler, AppError, ErrorCodes } from '../middleware/error-handler.js';
import { ApiResponse, TokenResponse, SessionStatus } from '../types/index.js';
import { authEmitter } from '../events/auth-events.js';

export function createSessionRoutes(sessionService: SessionService): Router {
  const router = Router();

  /**
   * 세션 초기화 및 OAuth 플로우 시작
   * POST /api/v1/mcp/sessions/init
   */
  router.post('/init', asyncHandler(async (req, res) => {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    // 세션 생성
    const sessionId = await sessionService.createSession(userAgent, ipAddress);

    // PKCE 파라미터 생성
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // PKCE verifier를 별도 Redis 키로 안전하게 저장
    await sessionService.savePkceVerifier(sessionId, codeVerifier);

    // OAuth URL 생성
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.OAUTH_CLIENT_ID,
      redirect_uri: config.OAUTH_REDIRECT_URI,
      scope: 'mcp:post:create',
      state: sessionId,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authorizationUrl = `${config.BACKEND_BASE_URL}/api/v1/oauth/authorize?${params}`;

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId,
        authorizationUrl,
      },
    };

    res.json(response);
    console.log(`✅ 세션 초기화: ${sessionId.substring(0, 8)}...`);
  }));

  /**
   * OAuth 콜백 처리
   * POST /api/v1/mcp/sessions/callback
   */
  router.post('/callback', asyncHandler(async (req, res) => {
    const { code, sessionId } = req.body;

    if (!code || !sessionId) {
      throw new AppError(400, ErrorCodes.MISSING_PARAMS, '필수 파라미터 누락');
    }

    // 세션 확인
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new AppError(401, ErrorCodes.SESSION_NOT_FOUND, '유효하지 않은 세션');
    }

    // PKCE verifier를 별도 Redis 키에서 가져오기
    const codeVerifier = await sessionService.getPkceVerifier(sessionId);

    if (!codeVerifier) {
      throw new AppError(400, ErrorCodes.AUTH_INVALID, 'PKCE verifier를 찾을 수 없습니다');
    }

    // 토큰 교환
    const tokenUrl = `${config.BACKEND_BASE_URL}/api/v1/oauth/token`;
    const tokenParams = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.OAUTH_REDIRECT_URI,
      client_id: config.OAUTH_CLIENT_ID,
      client_secret: config.OAUTH_CLIENT_SECRET,
      code_verifier: codeVerifier,
    };

    console.log('🔄 토큰 교환 요청:', {
      url: tokenUrl,
      params: { ...tokenParams, client_secret: '[HIDDEN]' },
    });

    const tokenResponse = await axios.post<TokenResponse>(
      tokenUrl,
      new URLSearchParams(tokenParams as any),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // 토큰 저장
    await sessionService.saveTokens(
      sessionId,
      access_token,
      refresh_token,
      expires_in
    );

    // ✨ 인증 완료 이벤트 발생 (폴링 제거, 즉시 알림)
    authEmitter.emit('auth_complete', sessionId);
    console.log(`🎉 인증 완료 이벤트 발생: ${sessionId.substring(0, 8)}...`);

    const response: ApiResponse = {
      success: true,
      message: 'OAuth 인증 완료',
    };

    res.json(response);
    console.log(`✅ OAuth 콜백 처리: ${sessionId.substring(0, 8)}...`);
  }));

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