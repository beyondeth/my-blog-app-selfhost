import Redis from 'ioredis';
import crypto from 'crypto';
import { request } from 'undici';

/**
 * MCP 세션 데이터 인터페이스
 * Redis에 저장될 세션 정보 구조
 */
interface McpSession {
  sessionId: string;
  userId?: string;
  blogId?: string;
  clientId?: string;

  // OAuth 토큰
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
 * MCP Blog Server에 통합된 OAuth2 세션 관리
 */
export class SessionService {
  private redis: Redis;
  private readonly SESSION_PREFIX = 'mcp:session:';
  private readonly SESSION_TTL = parseInt(process.env['SESSION_TTL'] || '86400');

  constructor() {
    // Redis 연결
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      password: process.env['REDIS_PASSWORD'],
      db: parseInt(process.env['REDIS_DB'] || '0'),
    });

    this.redis.on('connect', () => {
      console.error('✅ Redis 연결됨');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis 오류:', err);
    });
  }

  /**
   * 새로운 세션 생성
   */
  async createSession(userAgent: string = '', ipAddress: string = ''): Promise<string> {
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

    console.error(`📝 세션 생성: ${sessionId.substring(0, 8)}...`);
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
      // 5분 여유 두고 만료 시간 설정
      session.tokenExpiresAt = Date.now() + ((expiresIn - 300) * 1000);
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

    console.error(`💾 토큰 저장: 세션 ${sessionId.substring(0, 8)}...`);
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
      console.error(`🔄 토큰 자동 갱신 시도: ${sessionId.substring(0, 8)}...`);

      try {
        const { body } = await request(
          `${process.env['API_URL'] || 'http://localhost:3000/api/v1'}/oauth/token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: session.refreshToken,
              client_id: process.env['OAUTH_CLIENT_ID']!,
              client_secret: process.env['OAUTH_CLIENT_SECRET']!,
            }).toString(),
          }
        );

        const response = await body.json() as any;
        const { access_token, refresh_token, expires_in } = response;

        // 새 토큰 저장
        await this.saveTokens(
          sessionId,
          access_token,
          refresh_token || session.refreshToken,
          expires_in,
          session.userId,
          session.blogId
        );

        console.error(`✅ 토큰 갱신 성공: ${sessionId.substring(0, 8)}...`);
        return access_token;

      } catch (error: any) {
        console.error(`❌ 토큰 갱신 실패: ${error.message}`);

        // 갱신 실패 시 세션 삭제
        await this.deleteSession(sessionId);
        return null;
      }
    }

    // 리프레시 토큰도 없으면 재인증 필요
    console.error(`⚠️ 리프레시 토큰 없음: ${sessionId.substring(0, 8)}...`);
    return null;
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.del(key);
    console.error(`🗑️ 세션 삭제: ${sessionId.substring(0, 8)}...`);
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
    if (process.env['SESSION_STRICT_MODE'] === 'true') {
      // User-Agent 검증
      if (session.userAgent && userAgent && session.userAgent !== userAgent) {
        console.error(`⚠️ User-Agent 불일치: ${sessionId.substring(0, 8)}...`);
        return false;
      }

      // IP 주소 검증
      if (session.ipAddress && ipAddress && session.ipAddress !== ipAddress) {
        console.error(`⚠️ IP 주소 변경: ${sessionId.substring(0, 8)}...`);
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
   * 종료 시 Redis 연결 해제
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}