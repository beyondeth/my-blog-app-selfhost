import Redis from 'ioredis';
import crypto from 'crypto';
import axios from 'axios';
import {
  withRedisMetrics,
  updateRedisConnectionStatus,
} from '../metrics/collectors/redis.metrics.js';

/**
 * MCP 세션 데이터 인터페이스
 * Redis에 저장될 세션 정보 구조
 */
interface McpSession {
  sessionId: string;
  userId?: string;
  blogId?: string;
  clientId?: string;
  clientSecret?: string;  // 암호화된 client secret (Confidential Client용)

  // OAuth 토큰 (암호화되어 저장됨)
  accessToken?: string;  // 암호화된 토큰
  refreshToken?: string;  // 암호화된 토큰
  tokenExpiresAt?: number;

  // 사용자 preferences (MCP Remote Server에서 사용)
  preferences?: {
    defaultWritingStyle?: string;
    [key: string]: any;
  };

  // 메타데이터
  createdAt: number;
  lastAccessedAt: number;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * 세션 통계 인터페이스
 */
interface SessionStats {
  totalSessions: number;
  activeSessions: number;
}

/**
 * MCP 세션 관리 서비스
 *
 * 보안 개선사항:
 * - 토큰 AES-256-GCM 암호화 저장
 * - Redis SCAN 명령어 사용 (O(1) 복잡도)
 * - 세션별 통계 Redis 카운터 사용
 * - 타입 안정성 강화
 */
export class SessionService {
  private redis: Redis;
  private readonly SESSION_PREFIX = 'mcp:session:';
  private readonly PKCE_PREFIX = 'mcp:pkce:';
  private readonly STATS_TOTAL_KEY = 'mcp:stats:total';
  private readonly STATS_ACTIVE_KEY = 'mcp:stats:active';
  private readonly SESSION_TTL = parseInt(process.env.SESSION_TTL || '86400'); // 기본값 24시간 (JWT 토큰 만료와 동일)
  private readonly PKCE_TTL = 600; // PKCE verifier는 10분간만 유효

  // 토큰 암호화 키 (32바이트 = 256비트)
  private encryptionKey: Buffer;

  constructor() {
    // Redis 연결
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      // 연결 풀 설정 추가
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis 연결됨');
      updateRedisConnectionStatus(true);
    });

    this.redis.on('error', (err) => {
      console.error('[REDIS] Connection error:', err.message || 'Unknown');
      updateRedisConnectionStatus(false);
    });

    this.redis.on('close', () => {
      console.log('⚠️  Redis 연결 종료됨');
      updateRedisConnectionStatus(false);
    });

    // 암호화 키 초기화 및 검증
    this.encryptionKey = this.initializeEncryptionKey();
  }

  /**
   * 암호화 키 초기화
   * 환경 변수에서 32바이트 키 로드 및 검증
   */
  private initializeEncryptionKey(): Buffer {
    const keyHex = process.env.SESSION_ENCRYPTION_KEY;

    if (!keyHex) {
      throw new Error(
        'SESSION_ENCRYPTION_KEY is required. Generate with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
      );
    }

    const key = Buffer.from(keyHex, 'hex');

    if (key.length !== 32) {
      throw new Error(
        `SESSION_ENCRYPTION_KEY must be 32 bytes (64 hex characters). Current length: ${key.length} bytes`
      );
    }

    console.log('🔐 토큰 암호화 키 초기화 완료 (AES-256-GCM)');
    return key;
  }

  /**
   * 토큰 암호화 (AES-256-GCM)
   *
   * @param token 평문 토큰
   * @returns Base64 인코딩된 암호화 토큰 (IV + AuthTag + Encrypted)
   */
  private encryptToken(token: string): string {
    // 16바이트 초기화 벡터 생성
    const iv = crypto.randomBytes(16);

    // AES-256-GCM 암호화
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final()
    ]);

    // 인증 태그 추출 (GCM 모드)
    const authTag = cipher.getAuthTag();

    // IV + AuthTag + Encrypted 결합하여 Base64 인코딩
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * 토큰 복호화 (AES-256-GCM)
   *
   * @param encryptedToken Base64 인코딩된 암호화 토큰
   * @returns 평문 토큰
   */
  private decryptToken(encryptedToken: string): string {
    try {
      // Base64 디코딩
      const combined = Buffer.from(encryptedToken, 'base64');

      // IV, AuthTag, Encrypted 분리
      const iv = combined.subarray(0, 16);
      const authTag = combined.subarray(16, 32);
      const encrypted = combined.subarray(32);

      // AES-256-GCM 복호화
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error: any) {
      console.error('[DECRYPT] 토큰 복호화 실패:', error.message);
      throw new Error('Failed to decrypt token. Token may be corrupted.');
    }
  }

  /**
   * 새로운 세션 생성
   */
  async createSession(userAgent?: string, ipAddress?: string): Promise<string> {
    // 32바이트 랜덤 세션 ID (예측 불가능)
    const sessionId = crypto.randomBytes(32).toString('hex');

    const session: McpSession = {
      sessionId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      userAgent,
      ipAddress,
    };

    // Redis에 저장 (TTL 설정) - 메트릭 수집
    await withRedisMetrics('set', async () => {
      await this.redis.set(
        `${this.SESSION_PREFIX}${sessionId}`,
        JSON.stringify(session),
        'EX',
        this.SESSION_TTL
      );
    });

    // 통계 카운터 증가 - 메트릭 수집
    await withRedisMetrics('incr', async () => {
      await this.redis.incr(this.STATS_TOTAL_KEY);
      await this.redis.incr(this.STATS_ACTIVE_KEY);
    });

    console.log(`📝 세션 생성: ${sessionId.substring(0, 8)}...`);
    return sessionId;
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<McpSession | null> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;

    // Redis GET 작업 - 메트릭 수집
    const data = await withRedisMetrics('get', async () => {
      return await this.redis.get(key);
    });

    if (!data) {
      return null;
    }

    const session: McpSession = JSON.parse(data);

    // 접근 시간 업데이트
    session.lastAccessedAt = Date.now();

    // TTL 연장 - 메트릭 수집
    await withRedisMetrics('set', async () => {
      await this.redis.set(
        key,
        JSON.stringify(session),
        'EX',
        this.SESSION_TTL
      );
    });

    return session;
  }

  /**
   * PKCE verifier 저장 (별도 키로 안전하게 관리)
   */
  async savePkceVerifier(sessionId: string, codeVerifier: string): Promise<void> {
    const key = `${this.PKCE_PREFIX}${sessionId}`;

    // Redis SET 작업 - 메트릭 수집
    await withRedisMetrics('set', async () => {
      await this.redis.set(key, codeVerifier, 'EX', this.PKCE_TTL);
    });

    console.log(`🔐 PKCE verifier 저장: 세션 ${sessionId.substring(0, 8)}...`);
  }

  /**
   * PKCE verifier 조회 및 삭제 (일회용)
   */
  async getPkceVerifier(sessionId: string): Promise<string | null> {
    const key = `${this.PKCE_PREFIX}${sessionId}`;

    // Redis GET 작업 - 메트릭 수집
    const verifier = await withRedisMetrics('get', async () => {
      return await this.redis.get(key);
    });

    if (verifier) {
      console.log(`🔓 PKCE verifier 조회: 세션 ${sessionId.substring(0, 8)}...`);

      // 일회용이므로 즉시 삭제 - 메트릭 수집
      await withRedisMetrics('del', async () => {
        await this.redis.del(key);
      });
    }

    return verifier;
  }

  /**
   * PKCE verifier 삭제
   */
  async deletePkceVerifier(sessionId: string): Promise<void> {
    const key = `${this.PKCE_PREFIX}${sessionId}`;

    // Redis DEL 작업 - 메트릭 수집
    await withRedisMetrics('del', async () => {
      await this.redis.del(key);
    });

    console.log(`🗑️ PKCE verifier 삭제: 세션 ${sessionId.substring(0, 8)}...`);
  }

  /**
   * OAuth 클라이언트 인증 정보 저장 (Dynamic Client Registration)
   *
   * RFC 7591 Dynamic Client Registration으로 받은 client_id와 client_secret을 세션에 저장
   * Public Client의 경우 client_secret은 선택사항
   *
   * @param sessionId 세션 ID
   * @param credentials 클라이언트 인증 정보
   */
  async saveClientCredentials(
    sessionId: string,
    credentials: { clientId: string; clientSecret?: string }
  ): Promise<void> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }

    // client_secret 암호화 (존재하는 경우)
    const encryptedClientSecret = credentials.clientSecret
      ? this.encryptToken(credentials.clientSecret)
      : undefined;

    // 세션 업데이트
    const updatedSession: McpSession = {
      ...session,
      clientId: credentials.clientId,
      clientSecret: encryptedClientSecret,
      lastAccessedAt: Date.now(),
    };

    const key = `${this.SESSION_PREFIX}${sessionId}`;

    // Redis SET 작업 - 메트릭 수집
    await withRedisMetrics('set', async () => {
      await this.redis.set(
        key,
        JSON.stringify(updatedSession),
        'EX',
        this.SESSION_TTL
      );
    });

    console.log(`🔐 클라이언트 인증 정보 저장: 세션 ${sessionId.substring(0, 8)}... (client_id: ${credentials.clientId})`);
  }

  /**
   * OAuth 클라이언트 인증 정보 조회
   *
   * 토큰 교환 및 리프레시 시 사용할 클라이언트 인증 정보 반환
   * client_secret은 자동으로 복호화됨
   *
   * @param sessionId 세션 ID
   * @returns 클라이언트 인증 정보 (평문) 또는 null
   */
  async getClientCredentials(
    sessionId: string
  ): Promise<{ clientId: string; clientSecret?: string } | null> {
    const session = await this.getSession(sessionId);

    if (!session || !session.clientId) {
      return null;
    }

    // client_secret 복호화 (존재하는 경우)
    const clientSecret = session.clientSecret
      ? this.decryptToken(session.clientSecret)
      : undefined;

    return {
      clientId: session.clientId,
      clientSecret,
    };
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

    // Redis SET 작업 - 메트릭 수집
    await withRedisMetrics('set', async () => {
      await this.redis.set(
        key,
        JSON.stringify(updatedSession),
        'EX',
        this.SESSION_TTL
      );
    });

    console.log(`📝 세션 업데이트: ${sessionId.substring(0, 8)}...`);
  }

  /**
   * OAuth 토큰 저장 (암호화)
   *
   * 보안 개선:
   * - 토큰 AES-256-GCM 암호화
   *
   * 주의: MCP Transport 세션 ID는 변경 불가하므로 세션 ID 재생성 로직을 제거했습니다.
   * 로컬 개발 환경에서는 이미 32바이트 랜덤 세션 ID를 사용하므로 세션 고정 공격 위험이 낮습니다.
   */
  async saveTokens(
    sessionId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
    userId?: string,
    blogId?: string
  ): Promise<string> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error('세션이 존재하지 않습니다');
    }

    // MCP Transport 세션 ID는 변경 불가하므로 기존 세션 ID 유지
    const newSessionId = sessionId;  // 재생성하지 않음
    console.log(`💾 기존 세션 ID 유지: ${sessionId.substring(0, 8)}`);

    // 토큰 암호화
    const encryptedAccessToken = this.encryptToken(accessToken);
    const encryptedRefreshToken = refreshToken ? this.encryptToken(refreshToken) : undefined;

    // 토큰 정보 업데이트
    const newSession: McpSession = {
      ...session,
      sessionId: newSessionId,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: expiresIn ? Date.now() + ((expiresIn - 300) * 1000) : undefined,
      userId,
      blogId,
      lastAccessedAt: Date.now(),
    };

    if (expiresIn) {
      console.log(`[TOKEN] expires_in received: ${expiresIn} seconds (${(expiresIn / 3600).toFixed(1)} hours)`);
      const expiresAt = new Date(newSession.tokenExpiresAt!);
      console.log(`[TOKEN] Token will expire at: ${expiresAt.toLocaleString()}`);
    }

    // 세션 업데이트 (세션 ID는 변경하지 않음) - 메트릭 수집
    await withRedisMetrics('set', async () => {
      await this.redis.set(
        `${this.SESSION_PREFIX}${newSessionId}`,
        JSON.stringify(newSession),
        'EX',
        this.SESSION_TTL
      );
    });

    console.log(`💾 토큰 저장 (암호화): 세션 ${newSessionId.substring(0, 8)}...`);

    // 세션 ID 반환 (변경되지 않음)
    return newSessionId;
  }

  /**
   * 유효한 액세스 토큰 가져오기 (자동 갱신)
   */
  async getAccessToken(sessionId: string): Promise<string | null> {
    const session = await this.getSession(sessionId);

    if (!session || !session.accessToken) {
      return null;
    }

    // 토큰 복호화
    const decryptedAccessToken = this.decryptToken(session.accessToken);

    // 토큰이 아직 유효한 경우
    if (session.tokenExpiresAt && session.tokenExpiresAt > Date.now()) {
      return decryptedAccessToken;
    }

    // 토큰 만료 - 리프레시 시도
    if (session.refreshToken) {
      console.log(`🔄 토큰 자동 갱신 시도: ${sessionId.substring(0, 8)}...`);

      try {
        const decryptedRefreshToken = this.decryptToken(session.refreshToken);

        // 동적으로 등록된 클라이언트 정보 조회
        const clientCredentials = await this.getClientCredentials(sessionId);

        if (!clientCredentials) {
          console.error('[TOKEN_REFRESH] 클라이언트 정보가 세션에 없습니다. 재인증이 필요합니다.');
          await this.deleteSession(sessionId);
          return null;
        }

        // Token endpoint body 구성 (Public Client vs Confidential Client)
        const tokenBody: Record<string, string> = {
          grant_type: 'refresh_token',
          refresh_token: decryptedRefreshToken,
          client_id: clientCredentials.clientId,
        };

        // Confidential Client의 경우 client_secret 추가
        if (clientCredentials.clientSecret) {
          tokenBody.client_secret = clientCredentials.clientSecret;
        }

        const response = await axios.post(
          `${process.env.BACKEND_BASE_URL}/api/v1/oauth/token`,
          new URLSearchParams(tokenBody),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,  // 10초 타임아웃
          }
        );

        const { access_token, refresh_token, expires_in } = response.data;

        // 새 토큰 저장 (세션 ID는 변경되지 않음)
        const newSessionId = await this.saveTokens(
          sessionId,
          access_token,
          refresh_token || decryptedRefreshToken,
          expires_in,
          session.userId,
          session.blogId
        );

        console.log(`✅ 토큰 갱신 성공: ${sessionId.substring(0, 8)} → ${newSessionId.substring(0, 8)}`);

        // 새로 복호화된 액세스 토큰 반환
        return access_token;

      } catch (error: any) {
        console.error('[TOKEN_REFRESH] Failed:', error.message || 'Unknown');

        // 갱신 실패 시 세션 삭제
        await this.deleteSession(sessionId);
        return null;
      }
    }

    // 리프레시 토큰 없음 - 재인증 필요
    return null;
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;

    // Redis DEL 작업 - 메트릭 수집
    const deleted = await withRedisMetrics('del', async () => {
      return await this.redis.del(key);
    });

    // 통계 카운터 감소 - 메트릭 수집
    if (deleted > 0) {
      await withRedisMetrics('decr', async () => {
        await this.redis.decr(this.STATS_ACTIVE_KEY);
      });
    }

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
        console.warn(`⚠️ User-Agent 불일치: ${sessionId.substring(0, 8)}`);
        return false;
      }

      // IP 주소 검증
      if (session.ipAddress && ipAddress && session.ipAddress !== ipAddress) {
        console.warn(`⚠️ IP 주소 변경 감지: ${sessionId.substring(0, 8)}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 세션 통계 조회 (SCAN 사용)
   *
   * 성능 개선:
   * - Redis keys() → scan() (O(N) → O(1) per iteration)
   * - Redis 카운터 사용
   */
  async getStats(): Promise<SessionStats> {
    // Redis 카운터에서 통계 조회 (O(1)) - 메트릭 수집
    const totalSessions = await withRedisMetrics('get', async () => {
      return parseInt(await this.redis.get(this.STATS_TOTAL_KEY) || '0');
    });

    const activeSessions = await withRedisMetrics('get', async () => {
      return parseInt(await this.redis.get(this.STATS_ACTIVE_KEY) || '0');
    });

    return { totalSessions, activeSessions };
  }

  /**
   * PKCE 관련 키 정리 (SCAN 사용)
   */
  async cleanupPkceKeys(): Promise<void> {
    let cursor = '0';
    let deletedCount = 0;

    do {
      // SCAN으로 키 조회 (페이지네이션) - 메트릭 수집
      const [newCursor, keys] = await withRedisMetrics('scan', async () => {
        return await this.redis.scan(
          cursor,
          'MATCH',
          `${this.PKCE_PREFIX}*`,
          'COUNT',
          100
        );
      });

      cursor = newCursor;

      // TTL이 설정되어 있으므로 자동 삭제됨
      // 수동 정리는 불필요하지만, 명시적으로 삭제하려면:
      if (keys.length > 0) {
        for (const key of keys) {
          // TTL 확인 - 메트릭 수집
          const ttl = await withRedisMetrics('ttl', async () => {
            return await this.redis.ttl(key);
          });

          if (ttl === -1) {
            // TTL이 없는 키는 삭제 - 메트릭 수집
            await withRedisMetrics('del', async () => {
              await this.redis.del(key);
            });
            deletedCount++;
          }
        }
      }
    } while (cursor !== '0');

    if (deletedCount > 0) {
      console.log(`🧹 PKCE 키 정리: ${deletedCount}개 삭제`);
    }
  }

  /**
   * 종료 시 Redis 연결 해제
   */
  async close(): Promise<void> {
    await this.cleanupPkceKeys();
    await this.redis.quit();
    console.log('✅ Redis 연결 종료');
  }
}
