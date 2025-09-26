import { spawn } from 'child_process';
import * as http from 'http';
import { SessionService } from '../services/SessionService.js';

/**
 * MCP 세션 기반 인증 클라이언트
 *
 * 서버 기반 세션을 사용하여 OAuth2 인증을 처리하는 간소화된 클라이언트
 * 토큰 관리는 모두 서버에서 처리하고, 클라이언트는 세션 ID만 보유
 *
 * 주요 변경사항:
 * - 토큰을 클라이언트에 저장하지 않음
 * - 세션 ID만 메모리에 보관
 * - 모든 API 호출은 서버 프록시를 통해 처리
 * - 토큰 갱신은 서버가 자동으로 처리
 */
export class SessionBasedAuth {
  public baseUrl: string;
  public apiUrl: string;
  public mcpSessionUrl: string;

  // 세션 정보 (토큰은 저장하지 않음)
  private sessionId?: string;
  private redirectUri: string;
  private sessionService?: SessionService;

  // 인증 결과 정보
  public userId?: string;
  public blogId?: string;
  public blogName?: string;
  public blogSlug?: string;
  public blogInfo?: {
    id: string;
    name: string;
    slug: string;
  };

  constructor(sessionService?: SessionService, sessionId?: string) {
    // 환경 변수에서 설정 로드
    // 통합된 MCP Blog Server는 포트 3002에서 실행 (MCP Proxy Server 기능 통합)
    const serverUrl = process.env['MCP_SERVER_URL'] || 'http://localhost:3002';
    this.mcpSessionUrl = `${serverUrl}/api/v1/mcp/sessions`;

    // Backend API URL (통합된 서버의 프록시를 통해 접근)
    this.apiUrl = process.env['API_URL'] || 'http://localhost:3000/api/v1';
    this.baseUrl = this.apiUrl.replace(/\/api\/v1$/, '');
    this.redirectUri = process.env['OAUTH_REDIRECT_URI'] || 'http://localhost:7777/callback';

    // Redis 세션 서비스와 세션 ID 설정
    this.sessionService = sessionService;
    this.sessionId = sessionId;

    // 세션 ID가 제공되면 Redis에서 세션 복원 시도
    if (this.sessionService && this.sessionId) {
      this.restoreFromRedis();
    }
  }

  /**
   * OAuth2 인증 수행 (브라우저 기반)
   * 서버에서 세션을 생성하고 OAuth 플로우를 시작
   */
  public async authenticate(): Promise<boolean> {
    console.log('🔐 MCP 세션 기반 OAuth2 인증 시작...\n');

    try {
      // 1. 서버에 세션 초기화 요청
      const initResponse = await this.initSession();
      if (!initResponse.sessionId || !initResponse.authorizationUrl) {
        console.error('❌ 세션 초기화 실패');
        return false;
      }

      this.sessionId = initResponse.sessionId;
      console.log(`✅ 세션 생성됨: ${this.sessionId.substring(0, 8)}...`);
      console.log(`🔗 인증 URL: ${initResponse.authorizationUrl}\n`);

      // 2. 로컬 콜백 서버 시작
      const authCode = await this.startCallbackServer(initResponse.authorizationUrl);
      if (!authCode) {
        console.error('❌ 인증 코드 획득 실패');
        return false;
      }

      // 3. 서버에 인증 코드 전달하여 토큰 교환
      const callbackSuccess = await this.sendCallbackToServer(authCode);
      if (!callbackSuccess) {
        console.error('❌ 토큰 교환 실패');
        return false;
      }

      // 4. 세션 상태 확인
      const status = await this.getSessionStatus();
      if (!status.valid || !status.hasToken) {
        console.error('❌ 세션 유효성 검증 실패');
        return false;
      }

      // 5. 블로그 정보 가져오기 (OAuth userinfo 엔드포인트 사용)
      try {
        const userInfo = await this.proxyRequest('GET', '/oauth/userinfo');
        if (userInfo && userInfo.blog) {
          const blog = userInfo.blog; // OAuth에서 제공하는 블로그 정보
          this.blogInfo = {
            id: blog.id,
            name: blog.name,
            slug: blog.slug,
          };
          this.blogId = blog.id;
          this.blogName = blog.name;
          this.blogSlug = blog.slug;
          this.userId = userInfo.user?.id || blog.userId;

          // Redis에 블로그 정보 저장
          await this.saveToRedis();
        }
      } catch (error) {
        console.error('⚠️ 블로그 정보 가져오기 실패:', error);
      }

      console.log('✅ MCP 세션 인증 성공!');
      console.log(`   세션 ID: ${this.sessionId?.substring(0, 8)}...`);
      console.log(`   토큰 만료: ${status.tokenExpiresAt}`);
      if (this.blogInfo) {
        console.log(`   블로그: ${this.blogInfo.name} (${this.blogInfo.slug})`);
      }
      console.log();

      return true;

    } catch (error) {
      console.error('❌ 인증 중 오류:', error);
      return false;
    }
  }

  /**
   * 서버에 세션 초기화 요청
   */
  private async initSession(): Promise<{ sessionId: string; authorizationUrl: string }> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        redirectUri: this.redirectUri,
      });

      const options = {
        hostname: new URL(this.mcpSessionUrl).hostname,
        port: new URL(this.mcpSessionUrl).port || 8080,
        path: '/api/v1/mcp/sessions/init',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(responseData));
          } else {
            reject(new Error(`세션 초기화 실패: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * 로컬 콜백 서버 시작 및 브라우저 열기
   */
  private async startCallbackServer(authorizationUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url || '', `http://${req.headers.host}`);

        if (parsedUrl.pathname === '/callback') {
          const code = parsedUrl.searchParams.get('code');
          // const state = parsedUrl.searchParams.get('state'); // 현재 사용하지 않음

          if (code) {
            // 성공 페이지 표시
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>인증 성공</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  }
                  .container {
                    text-align: center;
                    padding: 40px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                  }
                  h1 { color: #4CAF50; }
                  p { color: #666; margin-top: 20px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>✅ 인증 성공!</h1>
                  <p>MCP 세션이 성공적으로 생성되었습니다.<br>이 창을 닫아도 됩니다.</p>
                </div>
              </body>
              </html>
            `);

            server.close();
            resolve(code);
          } else {
            // 에러 처리
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>❌ 인증 실패</h1><p>인증 코드를 받지 못했습니다.</p>');
            server.close();
            resolve(null);
          }
        }
      });

      server.listen(7777, () => {
        console.log('📡 콜백 서버가 http://localhost:7777 에서 대기 중...\n');

        // 브라우저 열기
        this.openBrowser(authorizationUrl);
      });

      // 타임아웃 설정 (5분)
      setTimeout(() => {
        server.close();
        resolve(null);
      }, 5 * 60 * 1000);
    });
  }

  /**
   * 브라우저 열기
   */
  private openBrowser(url: string): void {
    const platform = process.platform;
    let cmd: string;
    let args: string[];

    if (platform === 'darwin') {
      cmd = 'open';
      args = [url];
    } else if (platform === 'win32') {
      cmd = 'cmd';
      args = ['/c', 'start', url];
    } else {
      cmd = 'xdg-open';
      args = [url];
    }

    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
    console.log('🌐 브라우저에서 인증 페이지를 열었습니다.');
    console.log('   로그인 후 승인 버튼을 클릭해주세요.\n');
  }

  /**
   * 서버에 인증 코드 전달
   */
  private async sendCallbackToServer(code: string): Promise<boolean> {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        code,
        sessionId: this.sessionId,
      });

      const options = {
        hostname: new URL(this.mcpSessionUrl).hostname,
        port: new URL(this.mcpSessionUrl).port || 8080,
        path: '/api/v1/mcp/sessions/callback',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const result = JSON.parse(responseData);
            resolve(result.success === true);
          } else {
            console.error(`콜백 처리 실패: ${res.statusCode} - ${responseData}`);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('콜백 요청 오류:', error);
        resolve(false);
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 세션 상태 확인
   */
  private async getSessionStatus(): Promise<{
    valid: boolean;
    hasToken: boolean;
    tokenExpiresAt?: string;
  }> {
    return new Promise((resolve) => {
      const options = {
        hostname: new URL(this.mcpSessionUrl).hostname,
        port: new URL(this.mcpSessionUrl).port || 8080,
        path: `/api/v1/mcp/sessions/${this.sessionId}/status`,
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(responseData));
          } else {
            resolve({ valid: false, hasToken: false });
          }
        });
      });

      req.on('error', () => {
        resolve({ valid: false, hasToken: false });
      });

      req.end();
    });
  }

  /**
   * API 프록시를 통한 요청
   * 모든 API 호출은 서버 프록시를 통해 처리 (토큰 자동 관리)
   */
  public async proxyRequest(
    method: string,
    path: string,
    body?: any,
  ): Promise<any> {
    if (!this.sessionId) {
      throw new Error('세션이 초기화되지 않았습니다. 먼저 authenticate()를 호출하세요.');
    }

    return new Promise((resolve, reject) => {
      // MCP 포스트 생성 요청 - 원본 마크다운을 그대로 전송
      // Base64 인코딩을 제거하여 백엔드에서 직접 마크다운 처리
      const data = JSON.stringify({
        method,
        path,
        body,
      });

      // UTF-8 바이트 길이를 정확히 계산
      const contentLength = Buffer.byteLength(data, 'utf8');

      const options = {
        hostname: new URL(this.mcpSessionUrl).hostname,
        port: new URL(this.mcpSessionUrl).port || 8080,
        path: '/api/v1/mcp/sessions/proxy',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': contentLength,
          'x-mcp-session-id': this.sessionId,
        },
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              resolve(JSON.parse(responseData));
            } catch {
              resolve(responseData);
            }
          } else {
            reject(new Error(`API 요청 실패: ${res.statusCode} - ${responseData}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data, 'utf8');  // UTF-8 인코딩 명시
      req.end();
    });
  }

  /**
   * 인증 헤더 생성 (호환성을 위해 유지)
   * 실제로는 서버가 토큰을 관리하므로 세션 ID만 반환
   */
  public getAuthorizationHeader(): string {
    return `Session ${this.sessionId || 'none'}`;
  }

  /**
   * 세션 종료 (로그아웃)
   */
  public async logout(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    return new Promise((resolve) => {
      const options = {
        hostname: new URL(this.mcpSessionUrl).hostname,
        port: new URL(this.mcpSessionUrl).port || 8080,
        path: `/api/v1/mcp/sessions/${this.sessionId}`,
        method: 'DELETE',
      };

      const req = http.request(options, (res) => {
        res.on('data', () => {}); // 응답 소비
        res.on('end', () => {
          this.sessionId = undefined;
          console.log('✅ 세션이 종료되었습니다.');
          resolve();
        });
      });

      req.on('error', () => {
        // 에러 무시하고 로컬 세션 정리
        this.sessionId = undefined;
        resolve();
      });

      req.end();
    });
  }

  /**
   * 세션 유효성 확인
   * 세션 ID와 블로그 정보 모두 확인하여 완전한 인증 상태인지 검증
   */
  public isAuthenticated(): boolean {
    // 세션 ID가 있고 블로그 정보도 있어야 완전한 인증 상태
    const hasSession = !!this.sessionId;
    const hasBlogInfo = !!(this.blogInfo?.id && this.blogInfo?.slug);

    if (hasSession && !hasBlogInfo) {
      console.error('⚠️ 세션은 있지만 블로그 정보가 없습니다. 재인증이 필요합니다.');
    }

    return hasSession && hasBlogInfo;
  }

  /**
   * 세션만 있는지 확인 (불완전한 상태 체크용)
   */
  public hasSession(): boolean {
    return !!this.sessionId;
  }

  /**
   * Redis에서 세션 정보 복원
   * 서버 인스턴스가 새로 생성될 때마다 호출되어 기존 세션 유지
   */
  private async restoreFromRedis(): Promise<void> {
    if (!this.sessionService || !this.sessionId) {
      return;
    }

    try {
      // Redis에서 세션 정보 조회
      const sessionData = await this.sessionService.getSession(this.sessionId);

      if (sessionData && (sessionData as any).blogInfo) {
        // 블로그 정보 복원
        const blogInfo = (sessionData as any).blogInfo;
        this.blogInfo = blogInfo;
        this.blogId = blogInfo.id;
        this.blogName = blogInfo.name;
        this.blogSlug = blogInfo.slug;
        this.userId = sessionData.userId;

        console.log(`✅ Redis에서 세션 복원 완료: ${this.sessionId!.substring(0, 8)}...`);
        console.log(`   블로그: ${blogInfo.name} (${blogInfo.slug})`);
      }
    } catch (error) {
      console.error('⚠️ Redis 세션 복원 실패:', error);
      // 복원 실패해도 세션 ID는 유지 (프록시 요청 시도 가능)
    }
  }

  /**
   * 현재 세션 ID 반환 (HTTP 헤더에서 사용)
   */
  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * 블로그 정보를 Redis에 저장
   * authenticate 성공 후 호출되어 다음 요청에서 사용할 수 있도록 함
   */
  private async saveToRedis(): Promise<void> {
    if (!this.sessionService || !this.sessionId || !this.blogInfo) {
      return;
    }

    try {
      // 기존 세션 가져오기
      const session = await this.sessionService.getSession(this.sessionId);
      if (session) {
        // 세션 데이터에 블로그 정보 추가
        (session as any).blogInfo = this.blogInfo;
        session.userId = this.userId;

        // Redis에 업데이트된 세션 저장
        const redis = (this.sessionService as any).redis;
        const SESSION_PREFIX = (this.sessionService as any).SESSION_PREFIX || 'mcp:session:';
        const SESSION_TTL = (this.sessionService as any).SESSION_TTL || 86400;

        await redis.set(
          `${SESSION_PREFIX}${this.sessionId}`,
          JSON.stringify(session),
          'EX',
          SESSION_TTL
        );
        console.log(`✅ Redis에 세션 정보 저장 완료`);
      }
    } catch (error) {
      console.error('⚠️ Redis 세션 저장 실패:', error);
    }
  }
}