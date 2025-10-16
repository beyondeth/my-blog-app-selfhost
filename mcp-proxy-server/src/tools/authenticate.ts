/**
 * authenticate 도구
 *
 * OAuth2 PKCE 인증 플로우를 시작합니다.
 * 1. MCP 세션 확인/초기화
 * 2. PKCE code verifier 생성 및 저장
 * 3. Authorization URL 생성 및 CLI에 표시
 * 4. 즉시 응답 반환 (폴링하지 않음)
 *
 * 비폴링 방식 + 세션 기반 인증:
 * - Authorization URL을 CLI에 바로 표시 (사용자가 즉시 볼 수 있음)
 * - 사용자가 승인하면 세션에 토큰 저장 (OAuth callback에서 처리)
 * - 다음 도구 호출 시 세션 기반 인증으로 자동 통과
 * - LLM은 즉시 다음 도구를 호출할 수 있음 (블로킹 없음)
 *
 * CLI 출력 최적화:
 * - URL을 응답 메시지에 포함하여 즉시 표시
 * - 간결하고 명확한 메시지
 */

import crypto from 'crypto';
import axios from 'axios';
import { SessionService } from '../services/SessionService.js';
import { authEmitter } from '../events/auth-events.js';
import { logger } from '../utils/logger.js';

/**
 * Access Token 유효성 검증 함수
 * Backend API를 호출하여 토큰이 실제로 유효한지 확인
 *
 * @param token - 검증할 Access Token
 * @param backendUrl - Backend API URL
 * @returns 토큰이 유효하면 true, 그렇지 않으면 false
 */
async function verifyAccessToken(token: string, backendUrl: string): Promise<boolean> {
  try {
    // Backend의 토큰 검증 엔드포인트 호출
    // 현재 Backend에 /api/v1/auth/verify 엔드포인트가 없으므로
    // 간단한 인증된 엔드포인트(/api/v1/auth/profile)로 토큰 검증
    const response = await axios.get(`${backendUrl}/api/v1/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000, // 5초 타임아웃
      validateStatus: (status) => status < 500, // 5xx 에러만 예외로 처리
    });

    // 200 OK면 토큰 유효
    if (response.status === 200) {
      logger.debug({
        tokenPrefix: token.substring(0, 10),
        status: response.status
      }, '✅ Access token verified successfully');
      return true;
    }

    // 401 Unauthorized면 토큰 만료
    if (response.status === 401) {
      logger.warn({
        tokenPrefix: token.substring(0, 10),
        status: response.status
      }, '⚠️ Access token expired (401)');
      return false;
    }

    // 기타 에러 (403, 404 등)
    logger.warn({
      tokenPrefix: token.substring(0, 10),
      status: response.status
    }, '⚠️ Access token verification failed');
    return false;
  } catch (error: any) {
    // 네트워크 오류 또는 타임아웃
    logger.error({
      error: error.message
    }, '❌ Failed to verify access token');
    return false; // 검증 실패 시 안전하게 false 반환
  }
}

/**
 * SessionService에 세션이 없으면 최소한의 세션 데이터를 생성
 * (MCP Transport sessionId와 Redis 세션 동기화)
 */
async function ensureSessionExists(sessionService: SessionService, sessionId: string): Promise<void> {
  const existing = await sessionService.getSession(sessionId);
  if (existing) {
    return; // 이미 존재함
  }

  // Redis에 직접 세션 생성 (SessionService의 createSession과 동일한 구조)
  const session = {
    sessionId,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };

  // @ts-ignore - SessionService의 private redis 접근 (임시 해결책)
  const redis = (sessionService as any).redis;
  const SESSION_PREFIX = 'mcp:session:';
  const SESSION_TTL = parseInt(process.env.SESSION_TTL || '86400'); // 환경 변수 사용, 기본값 24시간

  await redis.set(
    `${SESSION_PREFIX}${sessionId}`,
    JSON.stringify(session),
    'EX',
    SESSION_TTL
  );

  console.log(`📝 MCP 세션 초기화: ${sessionId.substring(0, 8)}...`);
}

export interface AuthenticateToolParams {
  // 파라미터 없음 - 누구나 인증 시작 가능
}

export interface AuthenticateToolContext {
  sessionService: SessionService;
  config: {
    MCP_BASE_URL: string;          // MCP Proxy 공개 URL (브라우저 접근)
    BACKEND_BASE_URL: string;       // Backend 내부 URL (토큰 검증)
    BACKEND_PUBLIC_URL: string;     // Backend 공개 URL (브라우저 OAuth 인증)
    OAUTH_CLIENT_ID: string;
    OAUTH_REDIRECT_URI: string;
  };
  currentSessionId?: string; // MCP 세션 ID (자동 전달됨)
}

/**
 * PKCE code verifier 생성
 * RFC 7636 - 43-128자의 base64url 인코딩된 랜덤 문자열
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * PKCE code challenge 생성
 * code verifier의 SHA256 해시를 base64url 인코딩
 */
function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * authenticate 도구 핸들러
 *
 * OAuth 플로우 (비폴링 + 세션 기반 인증):
 * 1. 세션 생성 및 PKCE 파라미터 준비
 * 2. Authorization URL 생성
 * 3. 즉시 응답 반환 (URL 포함) → CLI에 바로 표시
 * 4. 사용자가 승인하면 OAuth callback에서 토큰 저장
 * 5. LLM이 다음 도구 호출 시 세션 기반 인증으로 자동 통과
 *
 * 장점:
 * - 사용자가 URL을 즉시 볼 수 있음 (블로킹 없음)
 * - 세션 기반 인증으로 토큰 자동 전달
 * - LLM이 블로킹 없이 다음 단계 진행 가능
 */
export async function authenticateHandler(
  _params: AuthenticateToolParams,
  context: AuthenticateToolContext
): Promise<{
  content: Array<{ type: string; text: string }>;
  _meta?: {
    oauth?: {
      authorizationUrl: string;
      sessionId: string;
    };
  };
}> {
  const { sessionService, config, currentSessionId } = context;

  // 0. MCP 세션 ID 확인 (Transport에서 자동 전달됨)
  if (!currentSessionId) {
    throw new Error('세션 ID를 찾을 수 없습니다. MCP 연결을 확인해주세요.');
  }

  const sessionId = currentSessionId;

  // 진행 상황 로깅 시작
  console.log('🔐 OAuth 인증 상태 확인 중...');

  // 1. Redis 세션 초기화 (MCP Transport sessionId를 Redis와 동기화)
  await ensureSessionExists(sessionService, sessionId);

  // 2. 이미 인증된 세션인지 확인 및 토큰 유효성 검증
  const session = await sessionService.getSession(sessionId);
  if (session?.accessToken) {
    console.log(`🔍 기존 세션 발견, 토큰 유효성 검증 중... (세션: ${sessionId.substring(0, 8)})`);

    // 토큰 유효성 실제 검증 (Backend API 호출)
    const isTokenValid = await verifyAccessToken(session.accessToken, config.BACKEND_BASE_URL);

    if (isTokenValid) {
      // 토큰이 유효한 경우에만 재사용
      console.log(`✅ 토큰 유효성 검증 완료! 세션 재사용 중... (세션: ${sessionId.substring(0, 8)})`);
      console.log('⏭️  폴링 스킵: 이미 인증 완료된 세션이므로 폴링하지 않습니다.');
      return {
        content: [{
          type: 'text',
          text: `✅ 기존 인증 세션 발견!\n🔄 세션 재사용 중...\n🆔 세션 ID: ${sessionId.substring(0, 8)}...\n✨ 인증 완료! 이제 자동으로 포스팅이 진행됩니다.`,
        }]
      };
    } else {
      // 토큰 만료 → 세션 정리 후 새 인증 진행
      console.log(`⚠️ 토큰 만료 감지! 세션 정리 후 새 인증 시작... (세션: ${sessionId.substring(0, 8)})`);
      await sessionService.deleteSession(sessionId);
      // 이후 코드 계속 실행 (새 인증 플로우)
    }
  }

  // 새 인증 시작 알림 (서버 로그)
  console.log('🌐 새로운 OAuth 인증을 시작합니다...');

  // 3. PKCE code verifier 생성 및 저장
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  await sessionService.savePkceVerifier(sessionId, codeVerifier);

  // 4. Authorization URL 생성
  // MCP 스펙: resource 파라미터 필수 (RFC 8707 - Resource Indicators for OAuth 2.0)
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: config.OAUTH_CLIENT_ID,
    redirect_uri: config.OAUTH_REDIRECT_URI,
    scope: 'mcp:post:create',
    state: sessionId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    resource: config.MCP_BASE_URL, // ✅ MCP 스펙 준수: Resource indicator
  });

  // 브라우저가 직접 Backend OAuth 페이지에 접근 (BACKEND_PUBLIC_URL 사용)
  // Backend가 프론트엔드 OAuth 페이지로 리다이렉트 → 사용자 승인 → MCP Proxy callback
  // 개발: http://localhost:3000/api/v1/oauth/authorize
  // 프로덕션: https://api.codebase.blog/api/v1/oauth/authorize
  const authorizationUrl = `${config.BACKEND_PUBLIC_URL}/api/v1/oauth/authorize?${authParams.toString()}`;

  // 5. 브라우저 자동 실행은 Claude Code SDK가 담당 (MCP OAuth 2.0 표준)
  // Docker 컨테이너 내부에서는 호스트 브라우저를 열 수 없으므로
  // Authorization URL만 반환하고 SDK가 브라우저 실행을 처리하도록 함
  console.log('🔓 OAuth Authorization URL 생성 완료');
  console.log(`📝 세션 ID: ${sessionId.substring(0, 8)}...`);

  /*
  // ❌ Docker 컨테이너에서는 작동하지 않음 - 주석 처리
  const { spawn } = await import('child_process');
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

  try {
    const browserProcess = spawn(command, [authorizationUrl], {
      detached: true,
      stdio: 'ignore'
    });

    browserProcess.on('error', (err: any) => {
      console.error('❌ 브라우저 프로세스 실행 실패:', err.message);
      console.log(`🔗 수동 URL: ${authorizationUrl}`);
    });

    browserProcess.unref();
    console.log(`✅ 브라우저 실행 시작: ${sessionId.substring(0, 8)}...`);
  } catch (error: any) {
    console.error('❌ 브라우저 자동 실행 실패 (동기):', error.message);
    console.log(`🔗 수동 URL: ${authorizationUrl}`);
  }
  */

  /*
  // ❌ MCP OAuth 2.0 표준 방식 - SDK 자동 브라우저 실행이 작동하지 않음 (주석 처리)
  // Claude Code SDK가 Authorization URL을 받아서 브라우저를 자동으로 실행해야 하지만 작동하지 않음
  console.log(`✅ OAuth 인증 준비 완료 (세션: ${sessionId.substring(0, 8)})`);
  console.log(`🔗 Authorization URL: ${authorizationUrl}`);

  return {
    content: [{
      type: 'text',
      text: `🔐 OAuth2 인증이 필요합니다.\n\n📝 세션 ID: ${sessionId.substring(0, 8)}...\n\n브라우저가 자동으로 열리면 승인 버튼을 눌러주세요.\n\n승인 후 자동으로 create_post 도구를 사용할 수 있습니다.`
    }],
    _meta: {
      oauth: {
        authorizationUrl: authorizationUrl,
        sessionId: sessionId
      }
    }
  };
  */

  // 6. 서버 로그에 URL 크게 출력 (사용자가 로그에서 확인 가능)
  console.log('\n' + '='.repeat(80));
  console.log('🔐 OAuth 인증 필요!');
  console.log('='.repeat(80));
  console.log('📋 세션 ID:', sessionId.substring(0, 8));
  console.log('🔗 Authorization URL:');
  console.log(authorizationUrl);
  console.log('='.repeat(80));
  console.log('✨ URL이 생성되었습니다. 아래 링크를 클릭하여 승인을 완료해주세요.\n');

  // 6.5. stdout으로 URL 즉시 출력 (Claude Code CLI가 볼 수 있음)
  process.stdout.write(`\n${'='.repeat(80)}\n`);
  process.stdout.write(`🔐 OAuth 인증 필요!\n`);
  process.stdout.write(`🔗 URL: ${authorizationUrl}\n`);
  process.stdout.write(`${'='.repeat(80)}\n\n`);

  // 6.6. 브라우저 실행 시도 (Docker에서 실패해도 OK, 로컬에서는 자동 실행)
  try {
    const { spawn } = await import('child_process');
    const platform = process.platform;
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

    const browserProcess = spawn(command, [authorizationUrl], {
      detached: true,
      stdio: 'ignore'
    });

    // error 이벤트 처리 (명령어 없음 등) - Docker 환경 대응
    browserProcess.on('error', (err) => {
      console.log(`⚠️ 브라우저 자동 실행 실패: ${err.message}`);
    });

    browserProcess.unref();
    console.log(`🌐 브라우저 자동 실행 시도 중... (${platform})`);
  } catch (error: any) {
    console.log(`⚠️ 브라우저 자동 실행 실패: ${error.message}`);
  }

  // 7. 즉시 응답 반환 (세션 기반 인증)
  // MCP 프로토콜 제약: Promise를 return하면 응답 전체가 blocking됨
  // 따라서 URL을 즉시 반환하고, 세션 기반으로 인증 처리
  return {
    content: [{
      type: 'text',
      text: `🔐 인증 URL: ${authorizationUrl}

승인 후 다시 자동포스팅 명령 실행`
    }]
  };
}

/**
 * MCP 도구 스키마
 */
export const authenticateTool = {
  schema: {
    method: 'tools/call',
    params: {
      name: 'authenticate',
      arguments: {},
    },
  },
  handler: authenticateHandler,
};
