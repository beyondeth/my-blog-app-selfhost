import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * 통합 Redis 서비스
 * 모든 Redis 작업을 중앙에서 관리하여 일관성 유지
 */
@Injectable()
export class UnifiedRedisService {
  private readonly logger = new Logger(UnifiedRedisService.name);

  // 무한루프 방지를 위한 최대 재귀 깊이
  private readonly MAX_RECURSION_DEPTH = 3;

  // 현재 처리 중인 키 추적 (순환 참조 방지)
  private readonly processingKeys = new Set<string>();

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * 캐시 키 생성 헬퍼
   * 네임스페이스를 명확하게 구분하여 충돌 방지
   */
  private buildKey(...parts: string[]): string {
    return parts.filter(Boolean).join(':');
  }

  /**
   * 캐시 설정 (TTL 필수)
   * 무한루프 방지를 위해 항상 TTL 설정
   */
  async setCache(
    namespace: string,
    key: string,
    value: any,
    ttl: number = 300, // 기본 5분
  ): Promise<void> {
    const fullKey = this.buildKey(namespace, key);

    // 무한루프 방지: TTL 없는 키는 생성 금지
    if (!ttl || ttl <= 0) {
      throw new Error('TTL은 반드시 양수여야 합니다');
    }

    // 순환 참조 방지: 이미 처리 중인 키인지 확인
    if (this.processingKeys.has(fullKey)) {
      this.logger.warn(`순환 참조 감지, 건너뜀: ${fullKey}`);
      return;
    }

    this.processingKeys.add(fullKey);

    try {
      await this.redis.setex(
        fullKey,
        ttl,
        JSON.stringify(value),
      );
      // 개발 환경에서만 디버그 로그 출력
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`캐시 저장: ${fullKey}, TTL: ${ttl}초`);
      }
    } catch (error) {
      this.logger.error(`캐시 저장 실패: ${fullKey}`, error);
      throw error;
    } finally {
      this.processingKeys.delete(fullKey);
    }
  }

  /**
   * 캐시 조회
   */
  async getCache<T>(namespace: string, key: string): Promise<T | null> {
    const fullKey = this.buildKey(namespace, key);

    try {
      const value = await this.redis.get(fullKey);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`캐시 조회 실패: ${fullKey}`, error);
      return null;
    }
  }

  /**
   * 캐시 삭제
   */
  async deleteCache(namespace: string, key: string): Promise<void> {
    const fullKey = this.buildKey(namespace, key);

    try {
      await this.redis.del(fullKey);
      // 개발 환경에서만 디버그 로그 출력
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`캐시 삭제: ${fullKey}`);
      }
    } catch (error) {
      this.logger.error(`캐시 삭제 실패: ${fullKey}`, error);
      throw error;
    }
  }

  /**
   * 패턴으로 캐시 삭제 (네임스페이스 단위)
   * SCAN 사용으로 블로킹 방지
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({
        match: pattern,
        count: 100, // 한 번에 100개씩 처리
      });

      const pipeline = this.redis.pipeline();
      let count = 0;

      for await (const keys of stream) {
        if (Array.isArray(keys) && keys.length > 0) {
          keys.forEach((key: string) => {
            pipeline.del(key);
            count++;
          });
        }
      }

      if (count > 0) {
        await pipeline.exec();
        this.logger.log(`${count}개 캐시 키 삭제: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`패턴 삭제 실패: ${pattern}`, error);
      throw error;
    }
  }

  /**
   * TTL 갱신 (무한루프 방지)
   */
  async refreshTTL(namespace: string, key: string, ttl: number): Promise<boolean> {
    const fullKey = this.buildKey(namespace, key);

    // TTL 유효성 검증
    if (!ttl || ttl <= 0) {
      this.logger.warn(`잘못된 TTL 값: ${ttl}`);
      return false;
    }

    try {
      const exists = await this.redis.exists(fullKey);
      if (exists) {
        await this.redis.expire(fullKey, ttl);
        // 개발 환경에서만 디버그 로그 출력
        if (process.env.NODE_ENV === 'development') {
          this.logger.debug(`TTL 갱신: ${fullKey}, 새 TTL: ${ttl}초`);
        }
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`TTL 갱신 실패: ${fullKey}`, error);
      return false;
    }
  }

  /**
   * Redis 서버 정보 조회
   */
  async getInfo(section?: string): Promise<any> {
    try {
      const info = await this.redis.info(section);
      return this.parseRedisInfo(info);
    } catch (error) {
      this.logger.error('Redis 정보 조회 실패', error);
      return null;
    }
  }

  /**
   * Redis INFO 응답 파싱
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');

    let currentSection = 'general';

    for (const line of lines) {
      if (line.startsWith('#')) {
        // 섹션 헤더
        currentSection = line.substring(1).trim().toLowerCase();
        result[currentSection] = {};
      } else if (line.includes(':')) {
        // key:value 형태
        const [key, value] = line.split(':');
        if (currentSection === 'general') {
          result[key] = value;
        } else {
          result[currentSection] = result[currentSection] || {};
          result[currentSection][key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Redis 서버 정보 조회
   * - INFO 명령어를 통해 서버 상태 확인
   */
  async getRedisInfo(section: string = 'default'): Promise<any> {
    try {
      const info = await this.redis.info(section);

      // INFO 명령어 결과를 파싱
      const lines = info.split('\r\n');
      const result: Record<string, any> = {};

      for (const line of lines) {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            result[key] = value;
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get Redis info: ${error.message}`);
      return {};
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStatistics(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
    patterns: Record<string, number>;
    hits: number;  // Redis의 실제 히트 수
    misses: number;  // Redis의 실제 미스 수
    uptime?: number;  // Redis 서버 가동 시간 (초)
  }> {
    try {
      const info = await this.getInfo();

      // 키 개수 조회
      const dbInfo = info.keyspace?.db0 || {};
      const keysParts = dbInfo.split ? dbInfo.split(',') : [];
      const totalKeys = keysParts[0]?.split('=')[1] || 0;

      // 메모리 사용량
      const memoryUsage = info.memory?.used_memory_human || 'N/A';

      // 히트율 계산
      const stats = info.stats || {};
      const hits = parseInt(stats.keyspace_hits || '0');
      const misses = parseInt(stats.keyspace_misses || '0');
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) : 0;

      // 서버 가동 시간
      const uptime = parseInt(info.server?.uptime_in_seconds || '0');

      // 네임스페이스별 키 개수 조회
      const patterns = await this.getKeyPatternCounts();

      return {
        totalKeys: parseInt(totalKeys),
        memoryUsage,
        hitRate,
        patterns,
        hits,  // Redis의 실제 히트 수 반환
        misses,  // Redis의 실제 미스 수 반환
        uptime,  // Redis 서버 가동 시간 (초)
      };
    } catch (error) {
      this.logger.error('캐시 통계 조회 실패', error);
      return {
        totalKeys: 0,
        memoryUsage: 'N/A',
        hitRate: 0,
        patterns: {},
        hits: 0,
        misses: 0,
        uptime: 0,
      };
    }
  }

  /**
   * 네임스페이스별 키 개수 조회
   */
  private async getKeyPatternCounts(): Promise<Record<string, number>> {
    const patterns = [
      'cache:posts:*',
      'cache:blogs:*',
      'cache:users:*',
      'chat:*',
      'sessions:*',
      'ratelimit:*',
      'bull:*',
      'temp:*',
    ];

    const result: Record<string, number> = {};

    for (const pattern of patterns) {
      try {
        // SCAN을 사용하여 카운트 (KEYS 명령어 대신)
        let count = 0;
        const stream = this.redis.scanStream({
          match: pattern,
          count: 100,
        });

        for await (const keys of stream) {
          if (Array.isArray(keys)) {
            count += keys.length;
          }
        }

        const namespace = pattern.split(':')[0];
        result[namespace] = (result[namespace] || 0) + count;
      } catch (error) {
        this.logger.error(`패턴 카운트 실패: ${pattern}`, error);
      }
    }

    return result;
  }

  /**
   * 특정 네임스페이스의 모든 캐시 초기화
   */
  async clearNamespace(namespace: string): Promise<void> {
    const pattern = `${namespace}:*`;
    await this.invalidatePattern(pattern);
    this.logger.log(`네임스페이스 초기화: ${namespace}`);
  }

  /**
   * 값 설정 (TTL 포함) - OAuth State 저장용
   */
  async setWithExpiry(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, value);
      this.logger.debug(`Key set with expiry: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Failed to set key with expiry: ${key}`, error);
      throw error;
    }
  }

  /**
   * 값 가져오기 - OAuth State 검증용
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Failed to get key: ${key}`, error);
      return null;
    }
  }

  /**
   * 키 삭제 - OAuth State 사용 후 삭제용
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug(`Key deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete key: ${key}`, error);
    }
  }

  /**
   * 여러 키 한 번에 삭제
   * @param keys 삭제할 키 배열
   * @returns 삭제된 키 개수
   */
  async deleteMany(keys: string[]): Promise<number> {
    if (!keys || keys.length === 0) {
      return 0;
    }

    try {
      // Redis는 multi-key 삭제 지원
      const result = await this.redis.del(...keys);
      this.logger.debug(`Deleted ${result} keys out of ${keys.length} requested`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete multiple keys`, error);
      return 0;
    }
  }

  /**
   * 네임스페이스 전체 삭제
   * @param namespace 네임스페이스 (예: 'cache:', 'blog:')
   * @returns 삭제된 키 개수
   */
  async deleteNamespace(namespace: string): Promise<number> {
    try {
      // SCAN을 사용하여 네임스페이스에 속한 모든 키 찾기
      const keys: string[] = [];
      let cursor = '0';

      do {
        const result = await this.redis.scan(cursor, 'MATCH', `${namespace}*`, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      if (keys.length > 0) {
        const deletedCount = await this.deleteMany(keys);
        this.logger.debug(`Deleted ${deletedCount} keys from namespace: ${namespace}`);
        return deletedCount;
      }

      return 0;
    } catch (error) {
      this.logger.error(`Failed to delete namespace: ${namespace}`, error);
      return 0;
    }
  }

  /**
   * Rate Limiting 구현
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const fullKey = this.buildKey('ratelimit', key);

    try {
      const multi = this.redis.multi();
      const now = Date.now();
      const window = now - windowSeconds * 1000;

      // 오래된 항목 제거
      multi.zremrangebyscore(fullKey, 0, window);

      // 현재 요청 추가
      multi.zadd(fullKey, now, `${now}-${Math.random()}`);

      // 현재 윈도우의 요청 수 조회
      multi.zcard(fullKey);

      // TTL 설정
      multi.expire(fullKey, windowSeconds);

      const results = await multi.exec();
      const count = results?.[2]?.[1] as number || 0;

      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt: new Date(now + windowSeconds * 1000),
      };
    } catch (error) {
      this.logger.error(`Rate limit 체크 실패: ${fullKey}`, error);
      // 에러 시 요청 허용 (fail-open)
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
      };
    }
  }

  /**
   * 분산 락 구현 (무한루프 방지)
   */
  async acquireLock(
    resource: string,
    ttlSeconds: number = 30,
    maxRetries: number = 3,
  ): Promise<boolean> {
    const lockKey = this.buildKey('temp', 'locks', resource);
    const lockValue = `${Date.now()}-${Math.random()}`;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // SET NX EX 원자적 실행
        const result = await this.redis.set(
          lockKey,
          lockValue,
          'EX',
          ttlSeconds,
          'NX',
        );

        if (result === 'OK') {
          // 개발 환경에서만 디버그 로그 출력
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`락 획득 성공: ${resource}`);
          }
          return true;
        }

        // 재시도 전 대기 (exponential backoff)
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
        }
      } catch (error) {
        this.logger.error(`락 획득 실패: ${resource}`, error);
      }
    }

    this.logger.warn(`락 획득 실패 (최대 재시도 초과): ${resource}`);
    return false;
  }

  /**
   * 분산 락 해제
   */
  async releaseLock(resource: string): Promise<void> {
    const lockKey = this.buildKey('temp', 'locks', resource);

    try {
      await this.redis.del(lockKey);
      // 개발 환경에서만 디버그 로그 출력
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`락 해제: ${resource}`);
      }
    } catch (error) {
      this.logger.error(`락 해제 실패: ${resource}`, error);
    }
  }

  /**
   * Redis 통계 리셋
   * - keyspace_hits, keyspace_misses 등 누적 통계 초기화
   */
  async resetStats(): Promise<boolean> {
    try {
      // CONFIG RESETSTAT 명령으로 Redis 통계 리셋
      const result = await this.redis.config('RESETSTAT');
      this.logger.log('Redis 통계가 리셋되었습니다');
      return true;
    } catch (error) {
      this.logger.error('Redis 통계 리셋 실패:', error);
      return false;
    }
  }

  /**
   * Redis 서버 가동 시간 조회
   * - 서버가 시작된 이후 경과 시간(초)
   */
  async getUptime(): Promise<number> {
    try {
      const info = await this.redis.info('server');
      const lines = info.split('\r\n');

      for (const line of lines) {
        if (line.startsWith('uptime_in_seconds:')) {
          const uptime = parseInt(line.split(':')[1]);
          return uptime;
        }
      }

      return 0;
    } catch (error) {
      this.logger.error('Redis uptime 조회 실패:', error);
      return 0;
    }
  }

  /**
   * Redis Set에 멤버 추가
   * 대화방 활성 사용자 추적에 사용
   */
  async addToSet(namespace: string, key: string, member: string): Promise<void> {
    const fullKey = this.buildKey(namespace, key);

    try {
      await this.redis.sadd(fullKey, member);
      // TTL 설정 (대화방 활성 사용자는 1시간 유지)
      await this.redis.expire(fullKey, 3600);

      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Set에 멤버 추가: ${fullKey} -> ${member}`);
      }
    } catch (error) {
      this.logger.error(`Set 멤버 추가 실패: ${fullKey}`, error);
      throw error;
    }
  }

  /**
   * Redis Set에서 멤버 제거
   * 대화방에서 나간 사용자 제거에 사용
   */
  async removeFromSet(namespace: string, key: string, member: string): Promise<void> {
    const fullKey = this.buildKey(namespace, key);

    try {
      await this.redis.srem(fullKey, member);

      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Set에서 멤버 제거: ${fullKey} -> ${member}`);
      }
    } catch (error) {
      this.logger.error(`Set 멤버 제거 실패: ${fullKey}`, error);
      throw error;
    }
  }

  /**
   * Redis Set의 모든 멤버 조회
   * 대화방 활성 사용자 목록 조회에 사용
   */
  async getSetMembers(namespace: string, key: string): Promise<string[]> {
    const fullKey = this.buildKey(namespace, key);

    try {
      const members = await this.redis.smembers(fullKey);
      return members || [];
    } catch (error) {
      this.logger.error(`Set 멤버 조회 실패: ${fullKey}`, error);
      return [];
    }
  }

  /**
   * Redis Set에 특정 멤버가 있는지 확인
   * 사용자가 대화방에 있는지 빠른 확인에 사용
   */
  async isSetMember(namespace: string, key: string, member: string): Promise<boolean> {
    const fullKey = this.buildKey(namespace, key);

    try {
      const result = await this.redis.sismember(fullKey, member);
      return result === 1;
    } catch (error) {
      this.logger.error(`Set 멤버 확인 실패: ${fullKey}`, error);
      return false;
    }
  }

  /**
   * Redis Set의 크기 조회
   * 대화방 활성 사용자 수 확인에 사용
   */
  async getSetSize(namespace: string, key: string): Promise<number> {
    const fullKey = this.buildKey(namespace, key);

    try {
      const size = await this.redis.scard(fullKey);
      return size || 0;
    } catch (error) {
      this.logger.error(`Set 크기 조회 실패: ${fullKey}`, error);
      return 0;
    }
  }
}