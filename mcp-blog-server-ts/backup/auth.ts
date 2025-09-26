import crypto from 'crypto';
import { spawn } from 'child_process';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 블로그 정보 인터페이스
 */
export interface BlogInfo {
  id: string;
  name: string;
  slug: string;
  userId: string;
}

/**
 * OAuth2 토큰 응답 인터페이스
 */
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * OAuth2 인증 모듈 (MCP Thin Client용)
 *
 * MCP 클라이언트가 백엔드 OAuth2 서버에 인증하여 액세스 토큰을 획득하는 모듈
 * 복잡한 로직은 백엔드 MCP 프록시에 위임하고, 이 모듈은 인증 플로우만 담당
 *
 * 주요 기능:
 * - OAuth2 Authorization Code Flow with PKCE
 * - 브라우저 기반 사용자 인증 (자동으로 브라우저 열기)
 * - 액세스 토큰 획득 및 관리
 * - 자동 토큰 갱신
 *
 * 제한사항:
 * - 비즈니스 로직 없음 (백엔드 프록시에서 처리)
 * - 토큰 획득과 갱신만 담당
 */
export class OAuth2Auth {
  public baseUrl: string;
  public apiUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: Date;
  public blogInfo?: BlogInfo;
  public userId?: string;
  public blogId?: string;

  // PKCE 파라미터
  private codeVerifier?: string;
  private codeChallenge?: string;
  private state?: string;

  constructor() {
    // 환경 변수에서 OAuth2 설정 로드
    this.apiUrl = process.env['BLOG_API_URL'] || 'http://localhost:3000/api/v1';
    this.baseUrl = this.apiUrl.replace(/\/api\/v1$/, '');

    // OAuth2 클라이언트 정보
    this.clientId = process.env['OAUTH_CLIENT_ID'] || 'mcp-blog-server';
    this.clientSecret = process.env['OAUTH_CLIENT_SECRET'] || 'mcp-secret-key-2024';
    this.redirectUri = process.env['OAUTH_REDIRECT_URI'] || 'http://localhost:7777/callback';

    // 기존 토큰이 있으면 로드 (파일 또는 환경 변수에서)
    this.loadSavedTokens();
  }

  /**
   * PKCE 코드 베리파이어 생성
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * PKCE 코드 챌린지 생성
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * 상태 파라미터 생성 (CSRF 방지)
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * OAuth2 인증 URL 생성
   */
  private generateAuthorizationUrl(): string {
    // PKCE 파라미터 생성
    this.codeVerifier = this.generateCodeVerifier();
    this.codeChallenge = this.generateCodeChallenge(this.codeVerifier);
    this.state = this.generateState();

    // URL 파라미터 구성
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'mcp:post:create',
      state: this.state,
      code_challenge: this.codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${this.baseUrl}/api/v1/oauth/authorize?${params.toString()}`;
  }

  /**
   * 로컬 HTTP 서버 시작하여 OAuth 콜백 받기
   */
  private async startCallbackServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const reqUrl = url.parse(req.url || '', true);

        if (reqUrl.pathname === '/callback') {
          const code = reqUrl.query['code'] as string;
          const state = reqUrl.query['state'] as string;
          const error = reqUrl.query['error'] as string;

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center;">
                  <h2 style="color: #e53e3e;">❌ 인증 실패</h2>
                  <p>오류: ${error}</p>
                  <p style="color: #718096;">이 창을 닫고 다시 시도해주세요.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (code && state === this.state) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center;">
                  <h2 style="color: #38a169;">✅ 인증 성공!</h2>
                  <p>MCP 서버가 블로그에 연결되었습니다.</p>
                  <p style="color: #718096;">이 창을 닫아도 됩니다.</p>
                  <script>setTimeout(() => window.close(), 3000);</script>
                </body>
              </html>
            `);
            server.close();
            resolve(code);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center;">
                  <h2 style="color: #e53e3e;">❌ 잘못된 요청</h2>
                  <p>상태 값이 일치하지 않습니다.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error('State mismatch'));
          }
        }
      });

      const port = parseInt(new URL(this.redirectUri).port) || 7777;
      server.listen(port, () => {
        console.log(`🌐 OAuth 콜백 서버가 포트 ${port}에서 대기 중...`);
      });

      // 타임아웃 설정 (5분)
      setTimeout(() => {
        server.close();
        reject(new Error('OAuth callback timeout'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * 브라우저 열기 (보안 개선)
   */
  private async openBrowser(url: string): Promise<void> {
    const platform = process.platform;

    return new Promise((resolve) => {
      let child;

      // shell: true 없이 직접 실행하여 보안 개선
      if (platform === 'darwin') {
        // macOS
        child = spawn('open', [url]);
      } else if (platform === 'win32') {
        // Windows - cmd.exe를 통해 실행 (start 명령은 내부 명령이므로)
        child = spawn('cmd.exe', ['/c', 'start', '""', url]);
      } else {
        // Linux/Unix
        child = spawn('xdg-open', [url]);
      }

      child.on('error', () => {
        console.warn('브라우저 열기 실패, 수동으로 URL을 열어주세요:', url);
        // 에러가 나도 프로세스는 계속 진행
        resolve();
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.warn('브라우저 열기 실패 (code: ' + code + '), 수동으로 URL을 열어주세요:', url);
          // 브라우저 열기 실패해도 계속 진행
          resolve();
        }
      });
    });
  }

  /**
   * 인증 코드를 액세스 토큰으로 교환
   */
  private async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const response = await fetch(`${this.apiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: this.codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenData = await response.json() as TokenResponse;

    // 토큰 저장
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;
    if (tokenData.expires_in) {
      this.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    }

    // 토큰 파일에 저장 (선택적)
    this.saveTokens();

    return tokenData;
  }

  /**
   * 액세스 토큰으로 사용자 정보 가져오기
   */
  private async fetchUserInfo(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${this.apiUrl}/oauth/userinfo`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json() as any;
    this.userId = data.userId;
    this.blogId = data.blogId;
    this.blogInfo = data.blog;
  }

  /**
   * OAuth2 인증 수행
   *
   * 브라우저를 열어 사용자가 로그인하고 권한을 승인하도록 합니다.
   */
  public async authenticate(): Promise<boolean> {
    try {
      // 1. 저장된 토큰이 있고 유효한지 확인
      if (this.accessToken && this.isTokenValid()) {
        console.log('✅ 기존 OAuth2 토큰 사용');
        await this.fetchUserInfo();
        return true;
      }

      // 2. 리프레시 토큰이 있으면 갱신 시도
      if (this.refreshToken) {
        try {
          await this.refreshAccessToken();
          await this.fetchUserInfo();
          return true;
        } catch (error) {
          console.log('⚠️ 토큰 갱신 실패, 재인증 필요');
        }
      }

      console.log('🔐 OAuth2 인증 시작...');

      // 3. 인증 URL 생성
      const authUrl = this.generateAuthorizationUrl();
      console.log('\n📋 브라우저에서 다음 URL이 열립니다:');
      console.log(authUrl);

      // 4. 콜백 서버 시작
      const codePromise = this.startCallbackServer();

      // 5. 브라우저 열기
      console.log('\n🌐 브라우저를 여는 중...');
      await this.openBrowser(authUrl);
      console.log('브라우저에서 로그인하고 권한을 승인해주세요.');

      // 6. 인증 코드 대기
      const code = await codePromise;
      console.log('✅ 인증 코드 수신');

      // 7. 토큰 교환
      console.log('🔄 액세스 토큰 요청 중...');
      await this.exchangeCodeForToken(code);
      console.log('✅ 액세스 토큰 획득');

      // 8. 사용자 정보 가져오기
      await this.fetchUserInfo();
      console.log(`✅ 블로그 연결 완료: ${this.blogInfo?.name} (${this.blogInfo?.slug})`);

      return true;
    } catch (error) {
      console.error('❌ OAuth2 인증 실패:', error);
      return false;
    }
  }

  /**
   * 리프레시 토큰으로 액세스 토큰 갱신
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.apiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const tokenData = await response.json() as TokenResponse;

    this.accessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      this.refreshToken = tokenData.refresh_token;
    }
    if (tokenData.expires_in) {
      this.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    }

    this.saveTokens();
  }

  /**
   * 토큰 유효성 확인
   */
  private isTokenValid(): boolean {
    if (!this.tokenExpiresAt) {
      return true; // 만료 시간이 없으면 유효한 것으로 간주
    }
    return new Date() < this.tokenExpiresAt;
  }

  /**
   * 토큰을 파일에 저장
   * ~/.mcp/tokens.json 파일에 토큰 정보를 안전하게 저장
   */
  private saveTokens(): void {
    try {
      // 홈 디렉토리의 .mcp 폴더 경로
      const mcpDir = path.join(os.homedir(), '.mcp');
      const tokenFile = path.join(mcpDir, 'tokens.json');

      // 디렉토리가 없으면 생성
      if (!fs.existsSync(mcpDir)) {
        fs.mkdirSync(mcpDir, { recursive: true, mode: 0o700 }); // 소유자만 읽기/쓰기
      }

      // 토큰 데이터 준비
      const tokenData = {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expires_at: this.tokenExpiresAt ? this.tokenExpiresAt.toISOString() : null,
        blog_id: this.blogId,
        blog_info: this.blogInfo,
        user_id: this.userId,
        saved_at: new Date().toISOString(),
      };

      // 파일에 저장 (소유자만 읽기/쓰기)
      fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2), {
        mode: 0o600,
      });

      console.log('✅ 토큰이 파일에 저장되었습니다:', tokenFile);

      // 환경 변수에도 저장 (하위 호환성)
      if (this.accessToken) {
        process.env['MCP_OAUTH_ACCESS_TOKEN'] = this.accessToken;
      }
      if (this.refreshToken) {
        process.env['MCP_OAUTH_REFRESH_TOKEN'] = this.refreshToken;
      }
    } catch (error) {
      console.error('토큰 저장 실패:', error);
    }
  }

  /**
   * 저장된 토큰 로드
   * ~/.mcp/tokens.json 파일에서 토큰 정보를 로드
   */
  private loadSavedTokens(): void {
    try {
      // 파일 경로
      const tokenFile = path.join(os.homedir(), '.mcp', 'tokens.json');

      // 파일이 존재하는지 확인
      if (fs.existsSync(tokenFile)) {
        // 파일 읽기
        const fileContent = fs.readFileSync(tokenFile, 'utf-8');
        const tokenData = JSON.parse(fileContent);

        // 토큰 데이터 로드
        this.accessToken = tokenData.access_token;
        this.refreshToken = tokenData.refresh_token;
        if (tokenData.expires_at) {
          this.tokenExpiresAt = new Date(tokenData.expires_at);
        }
        this.blogId = tokenData.blog_id;
        this.blogInfo = tokenData.blog_info;
        this.userId = tokenData.user_id;

        console.log('✅ 저장된 토큰을 로드했습니다');

        // 환경 변수에도 설정 (하위 호환성)
        if (this.accessToken) {
          process.env['MCP_OAUTH_ACCESS_TOKEN'] = this.accessToken;
        }
        if (this.refreshToken) {
          process.env['MCP_OAUTH_REFRESH_TOKEN'] = this.refreshToken;
        }
      } else {
        // 파일이 없으면 환경 변수에서 시도 (하위 호환성)
        this.accessToken = process.env['MCP_OAUTH_ACCESS_TOKEN'];
        this.refreshToken = process.env['MCP_OAUTH_REFRESH_TOKEN'];

        if (this.accessToken || this.refreshToken) {
          console.log('ℹ️ 환경 변수에서 토큰을 로드했습니다');
        }
      }
    } catch (error) {
      console.error('토큰 로드 실패:', error);
      // 오류 시 환경 변수에서 시도
      this.accessToken = process.env['MCP_OAUTH_ACCESS_TOKEN'];
      this.refreshToken = process.env['MCP_OAUTH_REFRESH_TOKEN'];
    }
  }

  /**
   * 액세스 토큰 반환
   */
  public getAccessToken(): string | undefined {
    return this.accessToken;
  }

  /**
   * Authorization 헤더 값 생성
   */
  public getAuthorizationHeader(): string {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }
    return `Bearer ${this.accessToken}`;
  }

  /**
   * 토큰 취소 (로그아웃)
   */
  public async revoke(): Promise<void> {
    if (!this.accessToken) {
      return;
    }

    try {
      await fetch(`${this.apiUrl}/oauth/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          token: this.accessToken,
          token_type_hint: 'access_token',
        }),
      });

      // 토큰 삭제
      this.accessToken = undefined;
      this.refreshToken = undefined;
      this.tokenExpiresAt = undefined;
      delete process.env['MCP_OAUTH_ACCESS_TOKEN'];
      delete process.env['MCP_OAUTH_REFRESH_TOKEN'];

      console.log('✅ OAuth2 토큰이 취소되었습니다');
    } catch (error) {
      console.error('토큰 취소 실패:', error);
    }
  }
}