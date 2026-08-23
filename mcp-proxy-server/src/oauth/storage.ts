/**
 * OAuth 저장소 (Redis 기반)
 *
 * 동적 클라이언트, 인증 코드, 액세스 토큰, 리프레시 토큰 관리
 * - 모든 데이터는 TTL 설정으로 자동 만료
 * - 보안을 위해 토큰은 해시하여 저장
 */

import crypto from 'crypto';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import type {
  StoredClient,
  AuthorizationCode,
  AccessToken,
  RefreshToken,
  OAuthSession,
} from './types.js';

// Redis 키 프리픽스 (OAuth 전용 네임스페이스)
const KEYS = {
  CLIENT: 'oauth:client:',           // 동적 등록 클라이언트
  CLIENT_BY_REDIRECT: 'oauth:redirect:',  // redirect_uri → client_id 매핑 (중복 방지)
  AUTH_CODE: 'oauth:code:',          // 인증 코드
  ACCESS_TOKEN: 'oauth:access:',     // 액세스 토큰
  REFRESH_TOKEN: 'oauth:refresh:',   // 리프레시 토큰
  SESSION: 'oauth:session:',         // 인증 세션 (state)
  GRANT_JTI: 'oauth:grant-jti:',     // 사용된 Backend grant ID (재사용 방지)
  TOKEN_BY_USER: 'oauth:user:',      // 사용자별 토큰 목록
  REFRESH_BY_USER: 'oauth:user:refresh:', // 사용자별 리프레시 토큰 목록
} as const;

// TTL 설정 (초)
const TTL = {
  CLIENT: 60 * 60 * 24 * 90,         // 클라이언트: 90일 (미사용 시 자동 삭제)
  AUTH_CODE: 60 * 10,                // 인증 코드: 10분
  ACCESS_TOKEN: 60 * 60,             // 액세스 토큰: 1시간
  REFRESH_TOKEN: 60 * 60 * 24 * 30,  // 리프레시 토큰: 30일
  SESSION: 60 * 10,                  // 세션: 10분
} as const;

/**
 * OAuth 저장소 클래스
 */
export class OAuthStorage {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // ===== 유틸리티 =====

  /**
   * 토큰 해시 생성 (저장/조회용)
   * - 원본 토큰 대신 해시를 키로 사용하여 보안 강화
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 랜덤 토큰 생성
   */
  generateToken(prefix: string = '', length: number = 32): string {
    const random = crypto.randomBytes(length).toString('base64url');
    return prefix ? `${prefix}_${random}` : random;
  }

  /**
   * 클라이언트 ID 생성 (Claude 호환 형식)
   */
  generateClientId(): string {
    return `mcp_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * 클라이언트 시크릿 생성
   */
  generateClientSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  // ===== 클라이언트 관리 (RFC 7591) =====

  /**
   * redirect_uri로 기존 클라이언트 조회 (중복 등록 방지)
   *
   * 같은 redirect_uri로 이미 등록된 클라이언트가 있으면 반환
   * Claude는 항상 같은 콜백 URL을 사용하므로 중복 방지 가능
   */
  async findClientByRedirectUri(redirectUri: string): Promise<StoredClient | null> {
    const key = `${KEYS.CLIENT_BY_REDIRECT}${this.hashToken(redirectUri)}`;
    const clientId = await this.redis.get(key);

    if (!clientId) {
      return null;
    }

    // 클라이언트 조회 및 TTL 갱신 (사용 중이므로)
    const client = await this.getClient(clientId);
    if (client) {
      await this.refreshClientTTL(clientId);
    }

    return client;
  }

  /**
   * 동적 클라이언트 저장
   */
  async saveClient(client: StoredClient): Promise<void> {
    const key = `${KEYS.CLIENT}${client.clientId}`;
    await this.redis.setex(key, TTL.CLIENT, JSON.stringify(client));

    // redirect_uri → client_id 매핑 저장 (중복 등록 방지용)
    for (const redirectUri of client.redirectUris) {
      const redirectKey = `${KEYS.CLIENT_BY_REDIRECT}${this.hashToken(redirectUri)}`;
      await this.redis.setex(redirectKey, TTL.CLIENT, client.clientId);
    }

    logger.debug({ clientId: client.clientId }, '✅ OAuth client saved');
  }

  /**
   * 클라이언트 조회
   */
  async getClient(clientId: string): Promise<StoredClient | null> {
    const key = `${KEYS.CLIENT}${clientId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 클라이언트 TTL 갱신 (사용 시마다 호출하여 미사용 자동 삭제 방지)
   */
  async refreshClientTTL(clientId: string): Promise<void> {
    const key = `${KEYS.CLIENT}${clientId}`;
    await this.redis.expire(key, TTL.CLIENT);

    // redirect_uri 매핑도 갱신
    const client = await this.getClient(clientId);
    if (client) {
      for (const redirectUri of client.redirectUris) {
        const redirectKey = `${KEYS.CLIENT_BY_REDIRECT}${this.hashToken(redirectUri)}`;
        await this.redis.expire(redirectKey, TTL.CLIENT);
      }
    }
  }

  /**
   * 클라이언트 삭제
   */
  async deleteClient(clientId: string): Promise<void> {
    const key = `${KEYS.CLIENT}${clientId}`;
    await this.redis.del(key);
    logger.debug({ clientId }, '🗑️ OAuth client deleted');
  }

  /**
   * 클라이언트 시크릿 검증
   */
  async verifyClientSecret(clientId: string, clientSecret: string): Promise<boolean> {
    const client = await this.getClient(clientId);
    if (!client || !client.clientSecret) {
      return false;
    }

    // 만료 확인
    if (client.clientSecretExpiresAt && client.clientSecretExpiresAt < Date.now() / 1000) {
      logger.warn({ clientId }, '⚠️ Client secret expired');
      return false;
    }

    // 타이밍 공격 방지를 위한 상수 시간 비교
    return crypto.timingSafeEqual(
      Buffer.from(client.clientSecret),
      Buffer.from(clientSecret)
    );
  }

  // ===== 인증 세션 관리 =====

  /**
   * 인증 세션 저장 (state 검증용)
   */
  async saveSession(session: OAuthSession): Promise<void> {
    const key = `${KEYS.SESSION}${session.state}`;
    await this.redis.setex(key, TTL.SESSION, JSON.stringify(session));
    logger.debug({ state: session.state.substring(0, 8) }, '✅ OAuth session saved');
  }

  /**
   * 인증 세션 조회 및 삭제 (일회성)
   */
  async consumeSession(state: string): Promise<OAuthSession | null> {
    const key = `${KEYS.SESSION}${state}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    // 일회성: 조회 후 즉시 삭제
    await this.redis.del(key);

    const session: OAuthSession = JSON.parse(data);

    // 만료 확인
    if (new Date(session.expiresAt) < new Date()) {
      logger.warn({ state: state.substring(0, 8) }, '⚠️ OAuth session expired');
      return null;
    }

    return session;
  }

  /**
   * Backend authorization grant의 jti를 일회성으로 소비합니다.
   * Redis SET NX로 동시 콜백에서도 정확히 한 요청만 성공합니다.
   */
  async consumeGrantJti(jti: string, expiresAt: number): Promise<boolean> {
    const ttl = Math.max(1, expiresAt - Math.floor(Date.now() / 1000));
    const key = `${KEYS.GRANT_JTI}${this.hashToken(jti)}`;
    const result = await this.redis.set(key, 'consumed', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  // ===== 인증 코드 관리 =====

  /**
   * 인증 코드 저장
   */
  async saveAuthorizationCode(authCode: AuthorizationCode): Promise<void> {
    const key = `${KEYS.AUTH_CODE}${this.hashToken(authCode.code)}`;
    await this.redis.setex(key, TTL.AUTH_CODE, JSON.stringify(authCode));
    logger.debug({ clientId: authCode.clientId }, '✅ Authorization code saved');
  }

  /**
   * 인증 코드 조회 및 삭제 (일회성)
   */
  async consumeAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
    const key = `${KEYS.AUTH_CODE}${this.hashToken(code)}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    // 일회성: 조회 후 즉시 삭제
    await this.redis.del(key);

    const authCode: AuthorizationCode = JSON.parse(data);

    // 만료 확인
    if (new Date(authCode.expiresAt) < new Date()) {
      logger.warn({ clientId: authCode.clientId }, '⚠️ Authorization code expired');
      return null;
    }

    return authCode;
  }

  // ===== 액세스 토큰 관리 =====

  /**
   * 액세스 토큰 저장
   */
  async saveAccessToken(accessToken: AccessToken): Promise<void> {
    const hash = this.hashToken(accessToken.token);
    const key = `${KEYS.ACCESS_TOKEN}${hash}`;

    // 토큰 TTL 계산
    const ttl = Math.floor((new Date(accessToken.expiresAt).getTime() - Date.now()) / 1000);

    if (ttl <= 0) {
      logger.warn('⚠️ Access token already expired, not saving');
      return;
    }

    await this.redis.setex(key, ttl, JSON.stringify(accessToken));

    // 사용자별 토큰 목록에 추가 (나중에 전체 무효화용)
    const userKey = `${KEYS.TOKEN_BY_USER}${accessToken.userId}`;
    await this.redis.sadd(userKey, hash);
    await this.redis.expire(userKey, TTL.REFRESH_TOKEN);

    logger.debug({ userId: accessToken.userId.substring(0, 8) }, '✅ Access token saved');
  }

  /**
   * 액세스 토큰 검증 및 조회
   */
  async validateAccessToken(token: string): Promise<AccessToken | null> {
    const hash = this.hashToken(token);
    const key = `${KEYS.ACCESS_TOKEN}${hash}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const accessToken: AccessToken = JSON.parse(data);

    // 만료 확인
    if (new Date(accessToken.expiresAt) < new Date()) {
      logger.warn({ userId: accessToken.userId.substring(0, 8) }, '⚠️ Access token expired');
      await this.redis.del(key);
      return null;
    }

    return accessToken;
  }

  /**
   * 액세스 토큰 삭제 (로그아웃)
   */
  async revokeAccessToken(token: string): Promise<void> {
    const hash = this.hashToken(token);
    const key = `${KEYS.ACCESS_TOKEN}${hash}`;
    const tokenRaw = await this.redis.get(key);
    if (tokenRaw) {
      try {
        const accessToken: AccessToken = JSON.parse(tokenRaw);
        const userKey = `${KEYS.TOKEN_BY_USER}${accessToken.userId}`;
        await this.redis.srem(userKey, hash);
      } catch {
        // ignore parse errors; key 삭제는 계속 진행
      }
    }
    await this.redis.del(key);
    logger.debug('🗑️ Access token revoked');
  }

  // ===== 리프레시 토큰 관리 =====

  /**
   * 리프레시 토큰 저장
   */
  async saveRefreshToken(refreshToken: RefreshToken): Promise<void> {
    const hash = this.hashToken(refreshToken.token);
    const key = `${KEYS.REFRESH_TOKEN}${hash}`;

    // 토큰 TTL 계산
    const ttl = Math.floor((new Date(refreshToken.expiresAt).getTime() - Date.now()) / 1000);

    if (ttl <= 0) {
      logger.warn('⚠️ Refresh token already expired, not saving');
      return;
    }

    await this.redis.setex(key, ttl, JSON.stringify(refreshToken));

    // 사용자별 리프레시 토큰 목록에 추가 (전체 무효화용)
    const refreshUserKey = `${KEYS.REFRESH_BY_USER}${refreshToken.userId}`;
    await this.redis.sadd(refreshUserKey, hash);
    await this.redis.expire(refreshUserKey, TTL.REFRESH_TOKEN);

    logger.debug({ userId: refreshToken.userId.substring(0, 8) }, '✅ Refresh token saved');
  }

  /**
   * 리프레시 토큰 조회 및 갱신 (Rotation)
   */
  async consumeRefreshToken(token: string): Promise<RefreshToken | null> {
    const hash = this.hashToken(token);
    const key = `${KEYS.REFRESH_TOKEN}${hash}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    // Rotation: 사용 후 삭제
    await this.redis.del(key);

    const refreshToken: RefreshToken = JSON.parse(data);

    // 사용자별 리프레시 토큰 인덱스에서 제거
    const refreshUserKey = `${KEYS.REFRESH_BY_USER}${refreshToken.userId}`;
    await this.redis.srem(refreshUserKey, hash);

    // 만료 확인
    if (new Date(refreshToken.expiresAt) < new Date()) {
      logger.warn({ userId: refreshToken.userId.substring(0, 8) }, '⚠️ Refresh token expired');
      return null;
    }

    // 연결된 액세스 토큰도 삭제
    await this.revokeAccessToken(refreshToken.accessToken);

    return refreshToken;
  }

  // ===== 사용자별 토큰 관리 =====

  /**
   * 사용자의 모든 토큰 무효화 (비밀번호 변경 등)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const userKey = `${KEYS.TOKEN_BY_USER}${userId}`;
    const refreshUserKey = `${KEYS.REFRESH_BY_USER}${userId}`;
    const [tokenHashes, refreshHashesFromIndex] = await Promise.all([
      this.redis.smembers(userKey),
      this.redis.smembers(refreshUserKey),
    ]);

    // 레거시 토큰 호환:
    // 과거에 REFRESH_BY_USER 인덱스 없이 발급된 리프레시 토큰이 남아 있을 수 있어
    // 인덱스가 비어있으면 refresh 키 공간을 스캔해 해당 userId 토큰을 보강한다.
    const refreshHashes = new Set<string>(refreshHashesFromIndex);
    if (refreshHashes.size === 0) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${KEYS.REFRESH_TOKEN}*`,
          'COUNT',
          200
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          const values = await this.redis.mget(...keys);
          for (let i = 0; i < keys.length; i += 1) {
            const raw = values[i];
            if (!raw) continue;
            try {
              const token: RefreshToken = JSON.parse(raw);
              if (token.userId === userId) {
                const key = keys[i];
                if (key) {
                  refreshHashes.add(key.replace(KEYS.REFRESH_TOKEN, ''));
                }
              }
            } catch {
              // ignore parse errors for corrupted legacy tokens
            }
          }
        }
      } while (cursor !== '0');
    }

    if (tokenHashes.length === 0 && refreshHashes.size === 0) {
      return;
    }

    // 모든 액세스/리프레시 토큰 삭제
    const pipeline = this.redis.pipeline();
    for (const hash of tokenHashes) {
      pipeline.del(`${KEYS.ACCESS_TOKEN}${hash}`);
    }
    for (const hash of refreshHashes) {
      pipeline.del(`${KEYS.REFRESH_TOKEN}${hash}`);
    }
    pipeline.del(userKey);
    pipeline.del(refreshUserKey);
    await pipeline.exec();

    logger.info(
      {
        userId: userId.substring(0, 8),
        accessCount: tokenHashes.length,
        refreshCount: refreshHashes.size,
      },
      '🗑️ All user tokens revoked'
    );
  }

  // ===== 통계 =====

  /**
   * OAuth 저장소 통계
   */
  async getStats(): Promise<{
    clients: number;
    activeSessions: number;
    accessTokens: number;
    refreshTokens: number;
  }> {
    const [clients, sessions, accessTokens, refreshTokens] = await Promise.all([
      this.redis.keys(`${KEYS.CLIENT}*`),
      this.redis.keys(`${KEYS.SESSION}*`),
      this.redis.keys(`${KEYS.ACCESS_TOKEN}*`),
      this.redis.keys(`${KEYS.REFRESH_TOKEN}*`),
    ]);

    return {
      clients: clients.length,
      activeSessions: sessions.length,
      accessTokens: accessTokens.length,
      refreshTokens: refreshTokens.length,
    };
  }
}
