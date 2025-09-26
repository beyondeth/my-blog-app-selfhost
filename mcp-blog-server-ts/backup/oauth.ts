import { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";
import { request } from "undici";
import { SessionService } from "../services/SessionService.js";

/**
 * OAuth2 라우터 - MCP Blog Server에 통합된 OAuth2 인증 처리
 * MCP Proxy Server의 기능을 MCP Blog Server로 통합
 */
export class OAuthRouter {
  private sessionService: SessionService;

  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  /**
   * OAuth2 라우트 핸들러
   */
  async handle(req: IncomingMessage, res: ServerResponse, path: string) {
    // CORS 헤더 설정
    this.setCorsHeaders(res);

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 라우팅
    if (path === '/api/v1/mcp/sessions/init' && req.method === 'POST') {
      await this.handleSessionInit(req, res);
    } else if (path === '/api/v1/mcp/sessions/callback' && req.method === 'POST') {
      await this.handleOAuthCallback(req, res);
    } else if (path === '/api/v1/mcp/sessions/proxy' && req.method === 'POST') {
      await this.handleAPIProxy(req, res);
    } else if (path.startsWith('/api/v1/mcp/sessions/') && path.endsWith('/status') && req.method === 'GET') {
      const sessionId = path.split('/')[5] || '';
      await this.handleSessionStatus(req, res, sessionId);
    } else if (path.startsWith('/api/v1/mcp/sessions/') && req.method === 'DELETE') {
      const sessionId = path.split('/')[5] || '';
      await this.handleSessionDelete(req, res, sessionId);
    } else if (path === '/api/v1/mcp/sessions/stats' && req.method === 'GET') {
      await this.handleSessionStats(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  }

  /**
   * CORS 헤더 설정
   */
  private setCorsHeaders(res: ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcp-session-id');
  }

  /**
   * 요청 본문 파싱
   */
  private async parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * 세션 초기화 및 OAuth 플로우 시작
   */
  private async handleSessionInit(req: IncomingMessage, res: ServerResponse) {
    try {
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.socket.remoteAddress || undefined;

      // 세션 생성
      const sessionId = await this.sessionService.createSession(userAgent || '', ipAddress || '');

      // PKCE 파라미터 생성
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      // 임시로 verifier를 refreshToken 필드에 저장
      await this.sessionService.saveTokens(sessionId, '', codeVerifier, 0);

      // OAuth URL 생성
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env['OAUTH_CLIENT_ID']!,
        redirect_uri: process.env['OAUTH_REDIRECT_URI']!,
        scope: 'mcp:post:create',
        state: sessionId,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const authorizationUrl = `${process.env['API_URL'] || 'http://localhost:3000/api/v1'}/oauth/authorize?${params}`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sessionId,
        authorizationUrl,
      }));

      console.error(`✅ 세션 초기화: ${sessionId.substring(0, 8)}...`);
    } catch (error: any) {
      console.error('❌ 세션 초기화 실패:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '세션 초기화 실패' }));
    }
  }

  /**
   * OAuth 콜백 처리
   */
  private async handleOAuthCallback(req: IncomingMessage, res: ServerResponse) {
    try {
      const { code, sessionId } = await this.parseBody(req);

      if (!code || !sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '필수 파라미터 누락' }));
        return;
      }

      // 세션에서 PKCE verifier 가져오기
      const session = await this.sessionService.getSession(sessionId);
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '유효하지 않은 세션' }));
        return;
      }

      const codeVerifier = session.refreshToken; // 임시 저장된 verifier

      // 토큰 교환
      const tokenUrl = `${process.env['API_URL'] || 'http://localhost:3000/api/v1'}/oauth/token`;
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env['OAUTH_REDIRECT_URI']!,
        client_id: process.env['OAUTH_CLIENT_ID']!,
        client_secret: process.env['OAUTH_CLIENT_SECRET']!,
        code_verifier: codeVerifier || '',
      });

      console.error('🔄 토큰 교환 요청:', {
        url: tokenUrl,
        clientId: process.env['OAUTH_CLIENT_ID'],
      });

      const { body } = await request(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams.toString(),
      });

      const tokenResponse = await body.json() as any;
      const { access_token, refresh_token, expires_in } = tokenResponse;

      // 토큰 저장
      await this.sessionService.saveTokens(
        sessionId,
        access_token,
        refresh_token,
        expires_in
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'OAuth 인증 완료',
      }));

      console.error(`✅ OAuth 콜백 처리: ${sessionId.substring(0, 8)}...`);
    } catch (error: any) {
      console.error('❌ OAuth 콜백 실패:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OAuth 인증 실패' }));
    }
  }

  /**
   * API 프록시 - MCP Client의 API 호출을 Backend로 전달
   */
  private async handleAPIProxy(req: IncomingMessage, res: ServerResponse) {
    try {
      const sessionId = req.headers['x-mcp-session-id'] as string;
      const { method, path, body, headers } = await this.parseBody(req);

      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'x-mcp-session-id 헤더 필요' }));
        return;
      }

      // 세션 유효성 검증
      const isValid = await this.sessionService.validateSession(
        sessionId,
        req.headers['user-agent'],
        req.socket.remoteAddress
      );

      if (!isValid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '유효하지 않은 세션' }));
        return;
      }

      // 액세스 토큰 가져오기 (자동 갱신)
      const accessToken = await this.sessionService.getAccessToken(sessionId);

      if (!accessToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '인증 토큰 없음' }));
        return;
      }

      // Backend API 호출
      const apiUrl = `${process.env['API_URL'] || 'http://localhost:3000/api/v1'}${path}`;

      console.error(`🔄 API 프록시: ${method} ${apiUrl}`);

      const { body: responseBody, statusCode } = await request(apiUrl, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          ...headers,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const responseData = await responseBody.json();

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseData));
    } catch (error: any) {
      console.error('❌ API 프록시 실패:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API 호출 실패' }));
    }
  }

  /**
   * 세션 상태 확인
   */
  private async handleSessionStatus(_req: IncomingMessage, res: ServerResponse, sessionId: string) {
    try {
      const session = await this.sessionService.getSession(sessionId);

      if (!session) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          valid: false,
          hasToken: false,
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        valid: true,
        hasToken: !!session.accessToken,
        tokenExpiresAt: session.tokenExpiresAt ? new Date(session.tokenExpiresAt) : null,
      }));
    } catch (error: any) {
      console.error('❌ 세션 상태 조회 실패:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '세션 상태 조회 실패' }));
    }
  }

  /**
   * 세션 삭제 (로그아웃)
   */
  private async handleSessionDelete(_req: IncomingMessage, res: ServerResponse, sessionId: string) {
    try {
      await this.sessionService.deleteSession(sessionId);
      res.writeHead(204);
      res.end();

      console.error(`✅ 세션 삭제: ${sessionId.substring(0, 8)}...`);
    } catch (error: any) {
      console.error('❌ 세션 삭제 실패:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '세션 삭제 실패' }));
    }
  }

  /**
   * 세션 통계
   */
  private async handleSessionStats(_req: IncomingMessage, res: ServerResponse) {
    try {
      const stats = await this.sessionService.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
    } catch (error: any) {
      console.error('❌ 통계 조회 실패:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '통계 조회 실패' }));
    }
  }
}