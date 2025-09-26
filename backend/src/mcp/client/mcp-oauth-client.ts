import * as crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * MCP OAuth2 클라이언트
 * MCP 서버가 블로그 백엔드와 OAuth2 인증을 수행할 때 사용하는 헬퍼 클래스
 *
 * 사용 예시:
 * ```typescript
 * const mcpClient = new McpOAuthClient({
 *   baseUrl: 'https://blog-api.example.com',
 *   clientId: 'mcp_1234567890abcdef',
 *   clientSecret: 'secret_xyz789...',
 *   redirectUri: 'http://localhost:8080/callback',
 * });
 *
 * // 1. 인증 URL 생성
 * const { authUrl, state, codeVerifier } = mcpClient.getAuthorizationUrl();
 *
 * // 2. 사용자를 authUrl로 리다이렉트
 *
 * // 3. 콜백에서 코드 받아서 토큰 교환
 * const tokens = await mcpClient.exchangeCodeForToken(code, state, codeVerifier);
 *
 * // 4. 포스트 생성
 * const post = await mcpClient.createPost(tokens.access_token, postData);
 * ```
 */
export class McpOAuthClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scope = 'mcp:post:create';

  constructor(config: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 마지막 슬래시 제거
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  /**
   * PKCE code verifier 생성
   * 43-128자의 랜덤 문자열
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * PKCE code challenge 생성
   * code verifier의 SHA256 해시
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * State 파라미터 생성 (CSRF 방지)
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * OAuth2 인증 URL 생성
   * 사용자를 이 URL로 리다이렉트하여 권한 부여 받음
   */
  getAuthorizationUrl(blogId?: string): {
    authUrl: string;
    state: string;
    codeVerifier: string;
  } {
    const state = this.generateState();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // 블로그 ID가 제공되면 파라미터에 추가 (서버에서 사전 선택)
    if (blogId) {
      params.append('blog_id', blogId);
    }

    const authUrl = `${this.baseUrl}/oauth/authorize?${params.toString()}`;

    return {
      authUrl,
      state,
      codeVerifier,
    };
  }

  /**
   * 인증 코드를 액세스 토큰으로 교환
   */
  async exchangeCodeForToken(
    code: string,
    state: string,
    codeVerifier: string,
    expectedState?: string,
  ): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    refresh_token?: string;
  }> {
    // State 검증 (CSRF 방지)
    if (expectedState && state !== expectedState) {
      throw new Error('State 파라미터가 일치하지 않습니다 (CSRF 공격 가능성)');
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`토큰 교환 실패: ${error.error_description || error.error}`);
    }

    return await response.json();
  }

  /**
   * 리프레시 토큰으로 새 액세스 토큰 발급
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  }> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`토큰 갱신 실패: ${error.error_description || error.error}`);
    }

    return await response.json();
  }

  /**
   * 토큰 정보 조회
   */
  async getTokenInfo(accessToken: string): Promise<{
    user_id: string;
    blog_id: string;
    client_id: string;
    scopes: string[];
  }> {
    const response = await fetch(`${this.baseUrl}/oauth/tokeninfo?access_token=${accessToken}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('토큰 정보 조회 실패');
    }

    return await response.json();
  }

  /**
   * MCP를 통해 포스트 생성
   */
  async createPost(
    accessToken: string,
    postData: {
      title: string;
      content: string;
      excerpt?: string;
      slug?: string;
      tags?: string[];
      category?: string;
      isPublished?: boolean;
      metadata?: Record<string, any>;
    },
  ): Promise<{
    id: string;
    slug: string;
    title: string;
    url: string;
  }> {
    const response = await fetch(`${this.baseUrl}/mcp/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`포스트 생성 실패: ${error.message || '알 수 없는 오류'}`);
    }

    return await response.json();
  }

  /**
   * MCP 서버 상태 확인
   */
  async checkHealth(accessToken: string): Promise<{
    status: string;
    authenticated: boolean;
    user_id: string;
    blog_id: string;
    client_id: string;
    scopes: string[];
    can_create_posts: boolean;
  }> {
    const response = await fetch(`${this.baseUrl}/mcp/health`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('상태 확인 실패');
    }

    return await response.json();
  }

  /**
   * 토큰 취소
   */
  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/oauth/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: accessToken,
        token_type_hint: 'access_token',
      }),
    });

    if (!response.ok) {
      throw new Error('토큰 취소 실패');
    }
  }

  /**
   * 토큰 저장소 인터페이스
   * 토큰을 안전하게 저장하고 관리하기 위한 헬퍼
   */
  static createTokenStorage() {
    let tokens: {
      access_token: string;
      refresh_token?: string;
      expires_at: Date;
    } | null = null;

    return {
      /**
       * 토큰 저장
       */
      saveTokens(tokenResponse: {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      }) {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

        tokens = {
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
          expires_at: expiresAt,
        };
      },

      /**
       * 액세스 토큰 가져오기
       */
      getAccessToken(): string | null {
        if (!tokens) return null;

        // 만료 확인
        if (new Date() >= tokens.expires_at) {
          return null; // 만료됨
        }

        return tokens.access_token;
      },

      /**
       * 리프레시 토큰 가져오기
       */
      getRefreshToken(): string | null {
        return tokens?.refresh_token || null;
      },

      /**
       * 토큰 만료 여부 확인
       */
      isExpired(): boolean {
        if (!tokens) return true;
        return new Date() >= tokens.expires_at;
      },

      /**
       * 토큰 삭제
       */
      clearTokens() {
        tokens = null;
      },
    };
  }
}

/**
 * MCP OAuth2 플로우 예시
 */
export class McpOAuthFlow {
  /**
   * 완전한 OAuth2 플로우 예시
   */
  static async performOAuth2Flow(
    config: {
      baseUrl: string;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    },
    blogId?: string,
  ) {
    // 1. 클라이언트 생성
    const client = new McpOAuthClient(config);
    const storage = McpOAuthClient.createTokenStorage();

    // 2. 인증 URL 생성
    const { authUrl, state, codeVerifier } = client.getAuthorizationUrl(blogId);

    console.log('다음 URL로 이동하여 인증을 완료하세요:');
    console.log(authUrl);
    console.log('');
    console.log('State:', state);
    console.log('Code Verifier:', codeVerifier);

    // 3. 사용자가 인증 완료 후 받은 코드로 토큰 교환
    // const code = 'AUTHORIZATION_CODE_FROM_CALLBACK';
    // const tokens = await client.exchangeCodeForToken(code, state, codeVerifier);
    // storage.saveTokens(tokens);

    // 4. 토큰을 사용하여 포스트 생성
    // const accessToken = storage.getAccessToken();
    // if (accessToken) {
    //   const post = await client.createPost(accessToken, {
    //     title: '테스트 포스트',
    //     content: '# 테스트\n\nMCP OAuth2로 생성된 포스트입니다.',
    //     isPublished: true,
    //   });
    //   console.log('포스트 생성 완료:', post);
    // }

    // 5. 토큰이 만료되면 리프레시
    // if (storage.isExpired()) {
    //   const refreshToken = storage.getRefreshToken();
    //   if (refreshToken) {
    //     const newTokens = await client.refreshAccessToken(refreshToken);
    //     storage.saveTokens(newTokens);
    //   }
    // }
  }
}