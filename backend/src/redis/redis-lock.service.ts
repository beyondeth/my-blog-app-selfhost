import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * 분산 락 획득
   * @param resource 리소스 키
   * @param ttl 락 유지 시간 (밀리초)
   * @returns 락 ID (획득 성공) 또는 null (획득 실패)
   */
  async acquireLock(
    resource: string,
    ttl: number = 5000,
  ): Promise<string | null> {
    const lockId = uuidv4();
    const key = `lock:${resource}`;

    try {
      // SET NX (Not eXists) with TTL - 원자적 연산
      const result = await this.redis.set(
        key,
        lockId,
        'PX', // milliseconds
        ttl,
        'NX', // only if not exists
      );

      if (result === 'OK') {
        this.logger.debug(`Lock acquired: ${key} with lockId: ${lockId}`);
        return lockId;
      }

      this.logger.debug(`Failed to acquire lock: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Error acquiring lock for ${key}:`, error);
      return null;
    }
  }

  /**
   * 분산 락 해제
   * @param resource 리소스 키
   * @param lockId 락 ID
   * @returns 성공 여부
   */
  async releaseLock(resource: string, lockId: string): Promise<boolean> {
    const key = `lock:${resource}`;

    // Lua 스크립트로 원자적 처리 (check and delete)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(script, 1, key, lockId) as number;

      if (result === 1) {
        this.logger.debug(`Lock released: ${key}`);
        return true;
      }

      this.logger.warn(`Failed to release lock: ${key} - lock ID mismatch or not found`);
      return false;
    } catch (error) {
      this.logger.error(`Error releasing lock for ${key}:`, error);
      return false;
    }
  }

  /**
   * 락 연장 (TTL 갱신)
   * @param resource 리소스 키
   * @param lockId 락 ID
   * @param ttl 새로운 TTL (밀리초)
   * @returns 성공 여부
   */
  async extendLock(
    resource: string,
    lockId: string,
    ttl: number = 5000,
  ): Promise<boolean> {
    const key = `lock:${resource}`;

    // Lua 스크립트로 원자적 처리 (check and extend)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(script, 1, key, lockId, ttl) as number;

      if (result === 1) {
        this.logger.debug(`Lock extended: ${key} for ${ttl}ms`);
        return true;
      }

      this.logger.warn(`Failed to extend lock: ${key} - lock ID mismatch or not found`);
      return false;
    } catch (error) {
      this.logger.error(`Error extending lock for ${key}:`, error);
      return false;
    }
  }

  /**
   * 락이 존재하는지 확인
   * @param resource 리소스 키
   * @returns 락 존재 여부
   */
  async isLocked(resource: string): Promise<boolean> {
    const key = `lock:${resource}`;

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Error checking lock for ${key}:`, error);
      return false;
    }
  }

  /**
   * 락을 기다리면서 획득 시도 (with retry)
   * @param resource 리소스 키
   * @param ttl 락 유지 시간
   * @param retryTimes 재시도 횟수
   * @param retryDelay 재시도 간격 (밀리초)
   * @returns 락 ID 또는 null
   */
  async waitForLock(
    resource: string,
    ttl: number = 5000,
    retryTimes: number = 10,
    retryDelay: number = 100,
  ): Promise<string | null> {
    for (let i = 0; i < retryTimes; i++) {
      const lockId = await this.acquireLock(resource, ttl);

      if (lockId) {
        return lockId;
      }

      // 마지막 시도가 아니면 대기
      if (i < retryTimes - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    this.logger.warn(`Failed to acquire lock after ${retryTimes} attempts: ${resource}`);
    return null;
  }

  /**
   * 락과 함께 작업 실행 (자동 해제)
   * @param resource 리소스 키
   * @param ttl 락 유지 시간
   * @param callback 실행할 작업
   * @returns 작업 결과
   */
  async executeWithLock<T>(
    resource: string,
    ttl: number,
    callback: () => Promise<T>,
  ): Promise<T> {
    const lockId = await this.waitForLock(resource, ttl);

    if (!lockId) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }

    try {
      return await callback();
    } finally {
      await this.releaseLock(resource, lockId);
    }
  }
}