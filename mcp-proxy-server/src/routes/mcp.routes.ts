/**
 * MCP 관련 라우트
 *
 * MCP Client가 호출하는 전용 엔드포인트들
 */

import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { SessionService } from '../services/SessionService';
import { qualityEnhancer } from '../lib/quality-enhancer';
import { config } from '../config/env.validation';
import { asyncHandler, AppError, ErrorCodes } from '../middleware/error-handler';
import { ApiResponse, CreatePostRequest, HealthCheckResponse } from '../types';

export function createMcpRoutes(sessionService: SessionService): Router {
  const router = Router();

  /**
   * 웹 세션 검증 엔드포인트
   * POST /api/v1/mcp/validate-session
   *
   * MCP 세션 ID를 받아서 웹 세션(Redis)과 비교하여 유효성 검증
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
      // Backend의 Redis를 통해 웹 세션 확인
      // MCP 세션이 웹에서 로그인한 사용자와 연결되어 있는지 검증
      const response = await axios.post(
        `${config.BACKEND_API_URL}/mcp/validate-session`,
        { sessionId, userId },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-MCP-Internal': 'true', // 내부 호출 식별용
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
   * MCP 인증 엔드포인트
   * POST /api/v1/mcp/authenticate
   */
  router.post('/authenticate', asyncHandler(async (req, res) => {
    const sessionId = req.headers['x-mcp-session-id'] as string;

    // 세션이 이미 있고 유효한 경우
    console.log(`🔍 인증 요청 받음: sessionId=${sessionId?.substring(0, 8)}...`);
    if (sessionId) {
      const session = await sessionService.getSession(sessionId);
      console.log(`📝 세션 조회 결과: ${session ? 'found' : 'not found'}, hasToken=${!!session?.accessToken}`);
      if (session && session.accessToken) {
        // 토큰 유효성 확인을 위해 Backend API 호출
        console.log(`🔐 토큰 검증 시작: /auth/me 호출`);
        try {
          const response = await axios.get(
            `${config.BACKEND_API_URL}/auth/me`,
            {
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
              },
            }
          );

          // 웹 세션과의 동기화 확인
          // MCP 세션이 웹 로그인 상태와 일치하는지 검증
          const validationResponse = await axios.post(
            `${config.BACKEND_API_URL}/mcp/validate-session`,
            {
              sessionId,
              userId: response.data.id,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-MCP-Internal': 'true',
              },
            }
          );

          if (!validationResponse.data.valid) {
            console.log(`⚠️ MCP 세션이 웹 세션과 동기화되지 않음, 재인증 필요`);
            await sessionService.deleteSession(sessionId);
            // 재인증 필요 - 아래 새로운 인증 시작 로직으로 진행
          } else {
            console.log(`✅ 세션 유효 및 동기화 확인: ${sessionId.substring(0, 8)}...`);

            const apiResponse: ApiResponse = {
              success: true,
              data: {
                sessionId,
                authenticated: true,
                user: response.data,
              },
              message: '인증 상태가 확인되었습니다',
            };

            return res.json(apiResponse);
          }
        } catch (error: any) {
          // 토큰이 유효하지 않으면 세션 삭제 후 재인증 필요
          console.log(`❌ 토큰 유효성 검증 실패`);
          console.log(`  - Status: ${error.response?.status}`);
          console.log(`  - Message: ${error.response?.data?.message || error.message}`);
          console.log(`  - URL: ${error.config?.url}`);
          console.log(`  세션 삭제 후 재인증 필요`);
          await sessionService.deleteSession(sessionId);
        }
      }
    }

    // 새로운 인증 시작
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;
    const newSessionId = await sessionService.createSession(userAgent, ipAddress);

    // PKCE 파라미터 생성
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // PKCE verifier를 별도 Redis 키로 안전하게 저장
    await sessionService.savePkceVerifier(newSessionId, codeVerifier);

    // OAuth URL 생성
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.OAUTH_CLIENT_ID,
      redirect_uri: config.OAUTH_REDIRECT_URI,
      scope: 'mcp:post:create',
      state: newSessionId,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authorizationUrl = `${config.BACKEND_BASE_URL}/api/v1/oauth/authorize?${params}`;

    const response: ApiResponse = {
      success: true,
      data: {
        sessionId: newSessionId,
        authenticated: false,
        authorizationUrl,
      },
      message: '브라우저에서 인증을 진행해주세요',
    };

    res.json(response);
    console.log(`🔐 MCP 인증 요청: 세션 ${newSessionId.substring(0, 8)}...`);
  }));

  /**
   * 마크다운 품질 개선 엔드포인트
   * POST /api/v1/mcp/enhance-markdown
   */
  router.post('/enhance-markdown', asyncHandler(async (req, res) => {
    const { markdown, options } = req.body;

    if (!markdown) {
      throw new AppError(400, ErrorCodes.MISSING_PARAMS, '마크다운 콘텐츠가 필요합니다');
    }

    // 품질 개선 수행
    const enhanced = qualityEnhancer.enhance(markdown, options);
    const metrics = qualityEnhancer.analyzeQuality(enhanced);

    const response: ApiResponse = {
      success: true,
      data: {
        content: enhanced,
        metrics: {
          totalScore: metrics.score,
          hasNaturalFlow: metrics.hasNaturalFlow,
          hasPersonalTouch: metrics.hasPersonalTouch,
          hasConversationalTone: metrics.hasConversationalTone,
          codeBlockRatio: metrics.codeBlockRatio
        }
      }
    };

    res.json(response);
  }));

  /**
   * 포스트 생성 엔드포인트
   * POST /api/v1/mcp/create-post
   */
  router.post('/create-post', asyncHandler(async (req, res) => {
    const sessionId = req.headers['x-mcp-session-id'] as string;
    // Body 로그 제거 - 불필요한 정보 노출 방지
    const { title, content, tags, qualityScore }: CreatePostRequest = req.body;

    if (!sessionId) {
      throw new AppError(401, ErrorCodes.AUTH_REQUIRED, '세션 ID가 필요합니다');
    }

    // 필수 파라미터 검증
    if (!title || !content) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, '제목과 내용은 필수입니다');
    }

    // 세션 유효성 검증
    const isValid = await sessionService.validateSession(
      sessionId,
      req.headers['user-agent'],
      req.ip
    );

    if (!isValid) {
      throw new AppError(401, ErrorCodes.SESSION_INVALID, '유효하지 않은 세션입니다');
    }

    // 액세스 토큰 가져오기 (자동 갱신)
    const accessToken = await sessionService.getAccessToken(sessionId);

    if (!accessToken) {
      throw new AppError(401, ErrorCodes.AUTH_REQUIRED, '인증 토큰이 없습니다');
    }

    // 포스트 데이터 준비
    const postData = {
      title,
      content_markdown: content,
      tags: tags || [],
      qualityScore: qualityScore !== undefined ? qualityScore : undefined,
    };

    // 최소한의 로그만 기록

    // Backend API로 포스트 생성 요청
    const response = await axios.post(
      `${config.BACKEND_API_URL}/mcp/posts`,
      postData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[CREATE_POST] OK');

    // MCP 응답 최적화: 최소 필수 정보만 반환
    const apiResponse: ApiResponse = {
      success: true,
      data: {
        post: {
          title: response.data.title,
          slug: response.data.slug,
          id: response.data.id,
          blog: response.data.blog,  // 프론트엔드 캐시 무효화를 위해 blog 정보 포함
        },
      },
      message: `포스트가 성공적으로 생성되었습니다: ${response.data.slug}`,
    };

    res.json(apiResponse);
  }));

  /**
   * 헬스 체크 엔드포인트
   * POST /api/v1/mcp/health
   */
  router.post('/health', asyncHandler(async (req, res) => {
    const sessionId = req.headers['x-mcp-session-id'] as string;

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