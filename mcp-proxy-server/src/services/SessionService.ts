import Redis from 'ioredis';
import crypto from 'crypto';
import axios from 'axios';

/**
 * MCP 세션 데이터 인터페이스
 * Redis에 저장될 세션 정보 구조
 */
interface McpSession {
  sessionId: string;
  userId?: string;
  blogId?: string;
  clientId?: string;

  // OAuth 토큰 (Proxy Server에서만 관리)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;

  // 메타데이터
  createdAt: number;
  lastAccessedAt: number;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * MCP 세션 관리 서비스
 * 독립적인 Proxy Server에서 토큰과 세션을 관리
 */
export class SessionService {
  private redis: Redis;
  private readonly SESSION_PREFIX = 'mcp:session:';
  private readonly PKCE_PREFIX = 'mcp:pkce:';  // PKCE verifier 전용 prefix
  private readonly SESSION_TTL = parseInt(process.env.SESSION_TTL || '86400');
  private readonly PKCE_TTL = 600; // PKCE verifier는 10분간만 유효

  constructor() {
    // Redis 연결
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis 연결됨');
    });

    this.redis.on('error', (err) => {
      console.error('[REDIS] Connection error:', err.message || 'Unknown');
    });
  }

  /**
   * 새로운 세션 생성
   */
  async createSession(userAgent?: string, ipAddress?: string): Promise<string> {
    // 32바이트 랜덤 세션 ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    const session: McpSession = {
      sessionId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      userAgent,
      ipAddress,
    };

    // Redis에 저장 (TTL 설정)
    await this.redis.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      'EX',
      this.SESSION_TTL
    );

    console.log(`📝 세션 생성: ${sessionId.substring(0, 8)}...`);
    return sessionId;
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<McpSession | null> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const session: McpSession = JSON.parse(data);

    // 접근 시간 업데이트
    session.lastAccessedAt = Date.now();

    // TTL 연장
    await this.redis.set(
      key,
      JSON.stringify(session),
      'EX',
      this.SESSION_TTL
    );

    return session;
  }

  /**
   * PKCE verifier 저장 (별도 키로 안전하게 관리)
   */
  async savePkceVerifier(sessionId: string, codeVerifier: string): Promise<void> {
    const key = `${this.PKCE_PREFIX}${sessionId}`;
    await this.redis.set(key, codeVerifier, 'EX', this.PKCE_TTL);
    console.log(`🔐 PKCE verifier 저장: 세션 ${sessionId.substring(0, 8)}...`);
  }

  /**
   * PKCE verifier 조회 (삭제하지 않음)
   */
  async getPkceVerifier(sessionId: string): Promise<string | null> {
    const key = `${this.PKCE_PREFIX}${sessionId}`;
    const verifier = await this.redis.get(key);

    if (verifier) {
      console.log(`🔓 PKCE verifier 조회: 세션 ${sessionId.substring(0, 8)}...`);
    }

    return verifier;
  }

  /**
   * PKCE verifier 삭제
   */
  async deletePkceVerifier(sessionId: string): Promise<void> {
    const key = `${this.PKCE_PREFIX}${sessionId}`;
    await this.redis.del(key);
    console.log(`🗑️ PKCE verifier 삭제: 세션 ${sessionId.substring(0, 8)}...`);
  }

  /**
   * 세션 업데이트 (토큰 등 추가)
   */
  async updateSession(sessionId: string, updates: Partial<McpSession>): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }

    // 세션 업데이트
    const updatedSession: McpSession = {
      ...session,
      ...updates,
      lastAccessedAt: Date.now(),
    };

    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.set(
      key,
      JSON.stringify(updatedSession),
      'EX',
      this.SESSION_TTL
    );

    console.log(`📝 세션 업데이트: ${sessionId.substring(0, 8)}...`);
  }

  /**
   * OAuth 토큰 저장
   */
  async saveTokens(
    sessionId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
    userId?: string,
    blogId?: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error('세션이 존재하지 않습니다');
    }

    // 토큰 정보 업데이트
    session.accessToken = accessToken;
    if (refreshToken) {
      session.refreshToken = refreshToken;
    }
    if (expiresIn) {
      // expires_in 디버깅 로그
      console.log(`[TOKEN] expires_in received: ${expiresIn} seconds (${expiresIn / 3600} hours)`);
      // 5분 여유 두고 만료 시간 설정
      session.tokenExpiresAt = Date.now() + ((expiresIn - 300) * 1000);
      const expiresAt = new Date(session.tokenExpiresAt);
      console.log(`[TOKEN] Token will expire at: ${expiresAt.toLocaleString()}`);
    }
    if (userId) {
      session.userId = userId;
    }
    if (blogId) {
      session.blogId = blogId;
    }

    // Redis에 업데이트
    await this.redis.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      'EX',
      this.SESSION_TTL
    );

    console.log(`💾 토큰 저장: 세션 ${sessionId.substring(0, 8)}...`);
  }

  /**
   * 유효한 액세스 토큰 가져오기 (자동 갱신)
   */
  async getAccessToken(sessionId: string): Promise<string | null> {
    const session = await this.getSession(sessionId);

    if (!session || !session.accessToken) {
      return null;
    }

    // 토큰이 아직 유효한 경우
    if (session.tokenExpiresAt && session.tokenExpiresAt > Date.now()) {
      return session.accessToken;
    }

    // 토큰 만료 - 리프레시 시도
    if (session.refreshToken) {
      console.log(`🔄 토큰 자동 갱신 시도: ${sessionId.substring(0, 8)}...`);

      try {
        const response = await axios.post(
          `${process.env.BACKEND_BASE_URL}/api/v1/oauth/token`,
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: session.refreshToken,
            client_id: process.env.OAUTH_CLIENT_ID!,
            client_secret: process.env.OAUTH_CLIENT_SECRET!,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        const { access_token, refresh_token, expires_in } = response.data;

        // 새 토큰 저장
        await this.saveTokens(
          sessionId,
          access_token,
          refresh_token || session.refreshToken,
          expires_in,
          session.userId,
          session.blogId
        );

        console.log(`✅ 토큰 갱신 성공: ${sessionId.substring(0, 8)}...`);
        return access_token;

      } catch (error: any) {
        console.error('[TOKEN_REFRESH] Failed:', error.message || 'Unknown');

        // 갱신 실패 시 세션 삭제
        await this.deleteSession(sessionId);
        return null;
      }
    }

    // 리프레시 토큰도 없으면 재인증 필요
    // 리프레시 토큰 없음 - 재인증 필요
    return null;
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.del(key);
    console.log(`🗑️ 세션 삭제: ${sessionId.substring(0, 8)}...`);
  }

  /**
   * 세션 유효성 검증
   */
  async validateSession(
    sessionId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<boolean> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return false;
    }

    // 엄격 모드 활성화 시 추가 검증
    if (process.env.SESSION_STRICT_MODE === 'true') {
      // User-Agent 검증
      if (session.userAgent && userAgent && session.userAgent !== userAgent) {
        // User-Agent 불일치 감지
        return false;
      }

      // IP 주소 검증
      if (session.ipAddress && ipAddress && session.ipAddress !== ipAddress) {
        // IP 주소 변경 감지
        return false;
      }
    }

    return true;
  }

  /**
   * 세션 통계
   */
  async getStats(): Promise<{ totalSessions: number; activeSessions: number }> {
    const keys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
    const totalSessions = keys.length;

    let activeSessions = 0;
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const session: McpSession = JSON.parse(data);
        if (session.lastAccessedAt > oneHourAgo) {
          activeSessions++;
        }
      }
    }

    return { totalSessions, activeSessions };
  }

  /**
   * PKCE 관련 키 정리 (만료된 키 삭제)
   */
  async cleanupPkceKeys(): Promise<void> {
    const keys = await this.redis.keys(`${this.PKCE_PREFIX}*`);
    if (keys.length > 0) {
      // 만료된 PKCE 키 정리
      // TTL이 있으므로 자동 삭제되지만, 수동 정리도 가능
    }
  }

  /**
   * 종료 시 Redis 연결 해제
   */
  async close(): Promise<void> {
    await this.cleanupPkceKeys();
    await this.redis.quit();
  }
}