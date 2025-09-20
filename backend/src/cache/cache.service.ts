import { Injectable, Logger } from '@nestjs/common';
import { UnifiedRedisService } from '../redis/unified-redis.service';

// 캐시 TTL 상수 (초 단위)
export enum CacheTTL {
  SHORT = 60,        // 1분 - 댓글, 실시간 데이터
  MEDIUM = 300,      // 5분 - 포스트 목록
  LONG = 600,        // 10분 - 포스트 상세
  EXTRA_LONG = 1800, // 30분 - 프로필
  STATIC = 3600,     // 1시간 - 블로그 설정, 태그
}

// 캐시 키 생성 헬퍼
export const CacheKeys = {
  // 블로그 관련
  BLOG_BY_SLUG: (slug: string) => `blog:slug:${slug}`,
  BLOG_BY_USER: (userId: string) => `blog:user:${userId}`,
  BLOG_BY_ID: (id: string) => `blog:id:${id}`,
  
  // 포스트 관련
  POST_LIST: (page: number, limit: number, search?: string, blogSlug?: string) => {
    const parts = ['posts', 'list', page, limit];
    if (blogSlug) parts.push(blogSlug);
    if (search) parts.push(btoa(search)); // Base64 인코딩으로 특수문자 처리
    return parts.join(':');
  },
  POST_DETAIL: (id: string) => `post:${id}`,
  POST_BY_SLUG: (slug: string) => `post:slug:${slug}`,
  POST_COUNT: (blogId?: string) => blogId ? `post:count:blog:${blogId}` : 'post:count:all',
  
  // 인기 포스트 (기간별)
  POPULAR_POSTS_DAILY: (limit: number = 5) => `popular:posts:daily:${limit}`,
  POPULAR_POSTS_WEEKLY: (limit: number = 5) => `popular:posts:weekly:${limit}`,
  POPULAR_POSTS_MONTHLY: (limit: number = 5) => `popular:posts:monthly:${limit}`,
  
  // 홈페이지 캐싱
  HOME_PAGE_POSTS: (page: number) => `home:posts:page:${page}`,
  
  // 사용자 관련
  USER_PROFILE: (username: string) => `user:profile:${username}`,
  USER_BY_ID: (id: string) => `user:id:${id}`,
  USER_BY_EMAIL: (email: string) => `user:email:${btoa(email)}`,
  
  // 태그 관련
  TAG_LIST: () => 'tags:all',
  TAG_BY_NAME: (name: string) => `tag:${name}`,
  
  // 통계
  BLOG_STATS: (blogId: string) => `stats:blog:${blogId}`,
  POST_VIEW_COUNT: (postId: string) => `views:post:${postId}`,
  USER_STATS: (userId: string) => `stats:user:${userId}`,
  
  // API 키 (짧은 TTL)
  API_KEY: (keyId: string) => `api:key:${keyId}`,
};

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  // 캐시 통계 추적 (UnifiedRedisService에서 관리되지만 호환성을 위해 유지)
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheSets = 0;
  private cacheDeletes = 0;

  constructor(
    private readonly unifiedRedisService: UnifiedRedisService,
  ) {}

  /**
   * 캐시에서 값 가져오기 - UnifiedRedisService 사용
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // 기본 네임스페이스를 'cache'로 사용
      const cached = await this.unifiedRedisService.getCache<T>('cache', key);
      if (cached) {
        this.cacheHits++;
        this.logger.debug(`Cache HIT: ${key}`);
        return cached;
      }
      this.cacheMisses++;
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 캐시에 값 저장 - UnifiedRedisService 사용
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      // TTL이 없으면 기본값 사용 (5분)
      const finalTtl = ttl || CacheTTL.MEDIUM;
      await this.unifiedRedisService.setCache('cache', key, value, finalTtl);

      this.cacheSets++;
      this.logger.debug(`Cache SET: ${key} (TTL: ${finalTtl}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * 캐시에서 값 삭제 - UnifiedRedisService 사용
   */
  async del(key: string): Promise<void> {
    try {
      await this.unifiedRedisService.deleteCache('cache', key);

      this.cacheDeletes++;
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * 패턴에 매칭되는 모든 키 삭제 - UnifiedRedisService 사용
   * SCAN 명령어 사용으로 성능 개선
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      // cache 네임스페이스를 prefix로 추가
      const fullPattern = `cache:${pattern}`;
      await this.unifiedRedisService.invalidatePattern(fullPattern);

      this.logger.debug(`Cache DEL pattern: ${pattern}`);
    } catch (error) {
      this.logger.error(`Cache DEL pattern error for ${pattern}:`, error);
    }
  }

  /**
   * 캐시 초기화 - cache 네임스페이스만 초기화
   */
  async reset(): Promise<void> {
    try {
      // cache 네임스페이스만 초기화
      await this.unifiedRedisService.clearNamespace('cache');

      // 통계 초기화
      this.cacheHits = 0;
      this.cacheMisses = 0;
      this.cacheSets = 0;
      this.cacheDeletes = 0;

      this.logger.warn('Cache RESET: cache namespace cleared');
    } catch (error) {
      this.logger.error('Cache RESET error:', error);
    }
  }

  /**
   * Get or Set 패턴 - 캐시가 없으면 함수 실행 후 캐시
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // 캐시 확인
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 캐시 미스 - 데이터 생성
    const data = await factory();
    
    // 캐시 저장
    if (data !== null && data !== undefined) {
      await this.set(key, data, ttl);
    }
    
    return data;
  }

  /**
   * 블로그 관련 캐시 무효화
   */
  async invalidateBlogCache(blogId: string, slug?: string): Promise<void> {
    const promises = [
      this.del(CacheKeys.BLOG_BY_ID(blogId)),
    ];
    
    if (slug) {
      promises.push(this.del(CacheKeys.BLOG_BY_SLUG(slug)));
    }
    
    // 관련 포스트 목록 캐시도 무효화
    await this.deletePattern(`posts:list:*:*:${slug || blogId}`);
    
    await Promise.all(promises);
  }

  /**
   * 포스트 관련 캐시 무효화
   */
  async invalidatePostCache(postId: string, blogSlug?: string): Promise<void> {
    // 특정 포스트 캐시 삭제
    await this.del(CacheKeys.POST_DETAIL(postId));
    
    // 포스트 목록 캐시 무효화
    if (blogSlug) {
      await this.deletePattern(`posts:list:*:*:${blogSlug}`);
    } else {
      await this.deletePattern('posts:list:*');
    }
    
    // 통계 캐시 무효화
    await this.deletePattern('stats:*');
  }

  /**
   * 사용자 관련 캐시 무효화
   */
  async invalidateUserCache(userId: string, username?: string, email?: string): Promise<void> {
    const promises = [
      this.del(CacheKeys.USER_BY_ID(userId)),
      this.del(CacheKeys.USER_STATS(userId)),
    ];
    
    if (username) {
      promises.push(this.del(CacheKeys.USER_PROFILE(username)));
    }
    
    if (email) {
      promises.push(this.del(CacheKeys.USER_BY_EMAIL(email)));
    }
    
    await Promise.all(promises);
  }

  /**
   * 메모리 사용량 조회 - UnifiedRedisService 사용
   */
  async getMemoryUsage(): Promise<{
    itemCount: number;
    estimatedSize: string;
    maxItems: number;
    maxSize: string;
    usagePercent: number;
    cacheType: string;
    hits?: number;
    misses?: number;
    sets?: number;
    deletes?: number;
    hitRate?: number;
  }> {
    try {
      // UnifiedRedisService에서 Redis 통계 조회
      const stats = await this.unifiedRedisService.getCacheStatistics();

      // Hit rate 계산
      const totalRequests = this.cacheHits + this.cacheMisses;
      const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

      // 메모리 사용률 계산 (약 8GB 기준)
      const memoryBytes = this.parseRedisMemory(stats.memoryUsage);
      const maxMemory = 8 * 1024 * 1024 * 1024; // 8GB
      const usagePercent = memoryBytes / maxMemory * 100;

      // cache 네임스페이스의 키 개수만 추출
      const cacheKeys = stats.patterns['cache'] || stats.totalKeys;

      return {
        itemCount: cacheKeys,
        estimatedSize: stats.memoryUsage,
        maxItems: 100000, // Redis는 더 많은 키 허용
        maxSize: '8 GB',
        usagePercent: parseFloat(usagePercent.toFixed(2)),
        cacheType: 'redis',
        hits: this.cacheHits,
        misses: this.cacheMisses,
        sets: this.cacheSets,
        deletes: this.cacheDeletes,
        hitRate: parseFloat(hitRate.toFixed(2)),
      };
    } catch (error) {
      this.logger.error('Failed to get memory usage:', error);
      return {
        itemCount: -1,
        estimatedSize: 'Error',
        maxItems: 5000,
        maxSize: '200 MB',
        usagePercent: -1,
        cacheType: 'error',
      };
    }
  }

  /**
   * 바이트를 읽기 쉬운 형식으로 변환
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);

    return `${size.toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Redis 메모리 문자열을 바이트로 변환
   * 예: "1.5M" -> 1572864, "2G" -> 2147483648
   */
  private parseRedisMemory(memory: string): number {
    if (!memory || memory === 'N/A') return 0;

    const units = {
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
    };

    const match = memory.match(/^([\d.]+)([KMG])?/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] as keyof typeof units;

    return Math.floor(value * (units[unit] || 1));
  }

  /**
   * 캐시 통계 조회 - UnifiedRedisService 사용
   */
  async getStats(): Promise<any> {
    try {
      // UnifiedRedisService에서 통계 조회
      const redisStats = await this.unifiedRedisService.getCacheStatistics();

      // cache 네임스페이스 키만 필터링
      const cacheKeys = redisStats.patterns['cache'] || 0;

      // Hit rate 계산
      const totalRequests = this.cacheHits + this.cacheMisses;
      const hitRatePercent = totalRequests > 0
        ? ((this.cacheHits / totalRequests) * 100).toFixed(2) + '%'
        : '0%';

      return {
        totalKeys: cacheKeys,
        patterns: redisStats.patterns,
        hits: this.cacheHits,
        misses: this.cacheMisses,
        sets: this.cacheSets,
        deletes: this.cacheDeletes,
        hitRate: hitRatePercent,
        redisHitRate: (redisStats.hitRate * 100).toFixed(2) + '%',
        memoryUsage: redisStats.memoryUsage,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return { 
        totalKeys: 0,
        patterns: {},
        error: 'Failed to get cache stats' 
      };
    }
  }
}