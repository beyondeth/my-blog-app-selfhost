import { Injectable, Logger } from '@nestjs/common';
import { UnifiedRedisService } from '../redis/unified-redis.service';
import { CacheMetricsService } from '../metrics/cache-metrics.service';

// 캐시 TTL 상수 (초 단위)
export enum CacheTTL {
  VERY_SHORT = 10,   // 10초 - 댓글 트리 (실시간성 중요)
  SHORT = 60,        // 1분 - 실시간 데이터
  MEDIUM = 300,      // 5분 - 포스트 목록
  LONG = 600,        // 10분 - 기타 데이터
  POST_CORE = 1800,  // 30분 - 포스트 Core 데이터 (title, content, author 등)
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

  // 포스트 Core 데이터 (counts 제외)
  POST_CORE: (id: string) => `post:core:${id}`,

  // 포스트 캐시 리빌딩 락 (Cache Stampede 방지)
  POST_REBUILDING: (id: string) => `rebuilding:post:${id}`,

  // ❌ 제거됨 (페이지네이션으로 대체)
  // COMMENTS_TREE: (postId: string) => `comments:tree:${postId}`,

  // 댓글 페이지네이션 (신규)
  COMMENTS_PAGE_FIRST: (postId: string, sortBy: string) =>
    `comments:page:first:${postId}:${sortBy}`, // 첫 페이지만 캐시
  COMMENTS_TOTAL: (postId: string) => `comments:total:${postId}`, // 전체 부모 댓글 개수
  COMMENT_REPLIES_FIRST: (commentId: string) =>
    `comments:replies:first:${commentId}`, // 답글 첫 페이지만 캐시

  // 댓글 캐시 리빌딩 락
  COMMENTS_REBUILDING: (postId: string) => `rebuilding:comments:${postId}`,
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
    private readonly cacheMetricsService: CacheMetricsService,
  ) {}

  /**
   * 키 패턴으로 캐시 타입 감지
   * @param key - 캐시 키
   * @returns 'post' | 'comments' | 'other'
   */
  private detectCacheType(key: string): 'post' | 'comments' | 'other' {
    if (key.includes('post:core') || key.includes('rebuilding:post')) {
      return 'post';
    }
    if (
      key.includes('comments:page') ||
      key.includes('comments:replies') ||
      key.includes('comments:total') ||
      key.includes('rebuilding:comments')
    ) {
      return 'comments';
    }
    return 'other';
  }

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

        // Prometheus 메트릭 기록
        const cacheType = this.detectCacheType(key);
        if (cacheType === 'post') {
          this.cacheMetricsService.recordPostCacheHit();
        } else if (cacheType === 'comments') {
          this.cacheMetricsService.recordCommentsCacheHit();
        }

        return cached;
      }
      this.cacheMisses++;
      this.logger.debug(`Cache MISS: ${key}`);

      // Prometheus 메트릭 기록
      const cacheType = this.detectCacheType(key);
      if (cacheType === 'post') {
        this.cacheMetricsService.recordPostCacheMiss();
      } else if (cacheType === 'comments') {
        this.cacheMetricsService.recordCommentsCacheMiss();
      }

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

      // Prometheus 메트릭 기록 - 캐시 무효화
      const cacheType = this.detectCacheType(key);
      if (cacheType === 'post') {
        this.cacheMetricsService.recordCacheInvalidation('post_core', 'manual');
      } else if (cacheType === 'comments') {
        this.cacheMetricsService.recordCacheInvalidation('comments_tree', 'manual');
      }
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * 단일 캐시 키 삭제 (del의 별칭)
   * posts.controller에서 사용하는 delete 메서드
   */
  async delete(key: string): Promise<void> {
    return this.del(key);
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
    namespaces?: Record<string, number>; // 네임스페이스별 키 개수 추가
    patternAnalysis?: {
      mostUsed: { pattern: string; count: number };
      recommendations: string[];
      inefficientPatterns: string[];
    };
    uptime?: number;  // Redis 서버 가동 시간 (초)
    uptimeHuman?: string;  // 사람이 읽기 쉬운 형태의 가동 시간
    hitsPerHour?: number;  // 시간당 히트 수
    missesPerHour?: number;  // 시간당 미스 수
    redisInfo?: {
      version?: string;
      connectedClients?: number;
      uptime?: number;
      memoryRss?: string;
    };
  }> {
    try {
      // UnifiedRedisService에서 Redis 통계 조회
      const stats = await this.unifiedRedisService.getCacheStatistics();

      // Redis의 실제 히트/미스 값 사용
      const redisHits = stats.hits || 0;
      const redisMisses = stats.misses || 0;

      // Hit rate 계산 - Redis의 실제 통계 사용
      const totalRequests = redisHits + redisMisses;
      const hitRate = totalRequests > 0 ? (redisHits / totalRequests) * 100 : 0;

      // 메모리 사용률 계산 (6GB 기준)
      const memoryBytes = this.parseRedisMemory(stats.memoryUsage);
      const maxMemory = 6 * 1024 * 1024 * 1024; // 6GB
      const usagePercent = memoryBytes / maxMemory * 100;

      // cache 네임스페이스의 키 개수만 추출
      const cacheKeys = stats.patterns['cache'] || 0;

      // 전체 키 개수 (모든 네임스페이스 포함)
      const totalKeys = stats.totalKeys || 0;

      // 서버 가동 시간 및 시간당 통계 계산
      const uptime = stats.uptime || 0;
      const uptimeHours = uptime / 3600;
      const hitsPerHour = uptimeHours > 0 ? Math.round(redisHits / uptimeHours) : 0;
      const missesPerHour = uptimeHours > 0 ? Math.round(redisMisses / uptimeHours) : 0;

      // 사람이 읽기 쉬운 가동 시간 포맷
      const uptimeHuman = this.formatUptime(uptime);

      // 패턴별 통계 분석 (캐시 히트율 개선을 위한 인사이트)
      const patternStats = this.analyzePatternStatistics(stats.patterns);

      return {
        itemCount: totalKeys, // 전체 키 개수 표시
        estimatedSize: stats.memoryUsage || '0 B',
        maxItems: 100000, // Redis는 더 많은 키 허용
        maxSize: '6 GB',
        usagePercent: parseFloat(usagePercent.toFixed(2)),
        cacheType: 'redis',
        hits: redisHits,  // Redis의 실제 히트 수 사용
        misses: redisMisses,  // Redis의 실제 미스 수 사용
        sets: this.cacheSets,  // 애플리케이션 레벨 SET 작업 수
        deletes: this.cacheDeletes,  // 애플리케이션 레벨 DELETE 작업 수
        hitRate: parseFloat(hitRate.toFixed(2)),
        patternAnalysis: patternStats, // 패턴별 분석 추가
        namespaces: stats.patterns, // 네임스페이스별 통계 추가
        uptime,  // Redis 서버 가동 시간 (초)
        uptimeHuman,  // 사람이 읽기 쉬운 형태
        hitsPerHour,  // 시간당 히트 수
        missesPerHour,  // 시간당 미스 수
      };
    } catch (error) {
      this.logger.error('Failed to get memory usage:', error);
      // Redis 연결 실패 시에도 기본값 반환
      return {
        itemCount: 0,
        estimatedSize: '0 B',
        maxItems: 100000,
        maxSize: '6 GB',
        usagePercent: 0,
        cacheType: 'redis',
        hits: this.cacheHits,
        misses: this.cacheMisses,
        sets: this.cacheSets,
        deletes: this.cacheDeletes,
        hitRate: 0,
        namespaces: {},
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
   * 가동 시간을 사람이 읽기 쉬운 형태로 변환
   * 예: 3661 -> "1시간 1분 1초"
   */
  private formatUptime(seconds: number): string {
    if (!seconds || seconds === 0) return '0초';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}일`);
    if (hours > 0) parts.push(`${hours}시간`);
    if (minutes > 0) parts.push(`${minutes}분`);
    if (secs > 0) parts.push(`${secs}초`);

    return parts.join(' ') || '0초';
  }

  /**
   * 패턴별 캐시 통계 분석
   * 어떤 패턴이 효율적인지 분석하여 캐시 히트율 개선 인사이트 제공
   */
  private analyzePatternStatistics(patterns: Record<string, number>) {
    const analysis = {
      mostUsed: { pattern: '', count: 0 },
      recommendations: [] as string[],
      inefficientPatterns: [] as string[],
    };

    // 가장 많이 사용되는 패턴 찾기
    for (const [pattern, count] of Object.entries(patterns || {})) {
      if (count > analysis.mostUsed.count) {
        analysis.mostUsed = { pattern, count };
      }

      // 비효율적인 패턴 식별
      if (pattern.includes('socket') || pattern.includes('msg')) {
        analysis.inefficientPatterns.push(pattern);
      }
    }

    // 개선 권장사항 생성
    if (analysis.inefficientPatterns.length > 0) {
      analysis.recommendations.push(
        '일회성 키(socket, msg)가 많습니다. TTL을 더 짧게 설정하거나 제거를 고려하세요.'
      );
    }

    if (patterns['cache'] < patterns['chat']) {
      analysis.recommendations.push(
        '채팅 캐시가 일반 캐시보다 많습니다. 채팅 TTL을 검토하세요.'
      );
    }

    if (!patterns['feed']) {
      analysis.recommendations.push(
        '피드 캐시가 없습니다. 캐시 워밍이 제대로 작동하는지 확인하세요.'
      );
    }

    return analysis;
  }

  /**
   * 카운터 증가 (INCR 명령어)
   */
  async increment(key: string): Promise<number> {
    try {
      const fullKey = `cache:${key}`;
      // UnifiedRedisService의 increment 기능 사용
      const current = await this.unifiedRedisService.get(fullKey);
      const newValue = current ? parseInt(current) + 1 : 1;
      await this.unifiedRedisService.setWithExpiry(fullKey, String(newValue), 86400 * 7); // 7일
      return newValue;
    } catch (error) {
      this.logger.error(`Cache INCREMENT error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * TTL 조회 (초 단위)
   * UnifiedRedisService에 메서드가 없으므로 간단히 구현
   */
  async ttl(key: string): Promise<number> {
    try {
      // 키가 존재하면 0 (무한), 없으면 -1 반환
      const fullKey = `cache:${key}`;
      const exists = await this.unifiedRedisService.get(fullKey);
      return exists ? 0 : -1;
    } catch (error) {
      this.logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * TTL 설정 (초 단위)
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      const fullKey = `cache:${key}`;
      // 기존 값을 읽어서 TTL과 함께 다시 저장
      const value = await this.unifiedRedisService.get(fullKey);
      if (value) {
        await this.unifiedRedisService.setWithExpiry(fullKey, value, seconds);
        this.logger.debug(`Cache EXPIRE: ${key} (TTL: ${seconds}s)`);
      }
    } catch (error) {
      this.logger.error(`Cache EXPIRE error for key ${key}:`, error);
    }
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

      // Redis의 실제 히트/미스 값 사용
      const redisHits = redisStats.hits || 0;
      const redisMisses = redisStats.misses || 0;

      // Hit rate 계산 - Redis의 실제 통계 사용
      const totalRequests = redisHits + redisMisses;
      const hitRatePercent = totalRequests > 0
        ? ((redisHits / totalRequests) * 100).toFixed(2) + '%'
        : '0%';

      return {
        totalKeys: cacheKeys,
        patterns: redisStats.patterns,
        hits: redisHits,  // Redis의 실제 히트 수 사용
        misses: redisMisses,  // Redis의 실제 미스 수 사용
        sets: this.cacheSets,  // 애플리케이션 레벨 SET 작업 수
        deletes: this.cacheDeletes,  // 애플리케이션 레벨 DELETE 작업 수
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

  /**
   * 분산 락 획득 (Cache Stampede 방지)
   * LikeQueueService의 pending 패턴 재사용
   *
   * @param key - 락 키
   * @param ttl - 락 유지 시간 (초), 기본 5초
   * @returns 락 획득 성공 여부
   */
  async acquireLock(key: string, ttl: number = 5): Promise<boolean> {
    try {
      const fullKey = `cache:${key}`;

      // Redis GET: 키가 이미 존재하는지 확인
      const exists = await this.unifiedRedisService.get(fullKey);
      if (exists) {
        this.logger.debug(`Lock already held: ${key}`);
        return false; // 이미 락 존재
      }

      // Redis SET with TTL: 키가 없을 때만 설정
      await this.unifiedRedisService.setWithExpiry(fullKey, '1', ttl);
      this.logger.debug(`Lock acquired: ${key} (TTL: ${ttl}s)`);

      // Prometheus 메트릭 기록 - 락 획득
      const cacheType = this.detectCacheType(key);
      if (cacheType === 'post' || cacheType === 'comments') {
        this.cacheMetricsService.recordCacheLockAcquired(cacheType);
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to acquire lock ${key}:`, error);
      return false;
    }
  }

  /**
   * 분산 락 해제
   *
   * @param key - 락 키
   */
  async releaseLock(key: string): Promise<void> {
    try {
      const fullKey = `cache:${key}`;
      await this.unifiedRedisService.del(fullKey);
      this.logger.debug(`Lock released: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to release lock ${key}:`, error);
    }
  }

  /**
   * 락이 해제될 때까지 대기 (최대 대기 시간 제한)
   *
   * @param key - 락 키
   * @param maxWaitMs - 최대 대기 시간 (밀리초), 기본 5초
   */
  async waitForLock(key: string, maxWaitMs: number = 5000): Promise<void> {
    const fullKey = `cache:${key}`;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const locked = await this.unifiedRedisService.get(fullKey);
      if (!locked) {
        const waitTime = Date.now() - startTime;
        this.logger.debug(`Lock released, proceeding: ${key} (waited ${waitTime}ms)`);

        // Prometheus 메트릭 기록 - 락 대기
        const cacheType = this.detectCacheType(key);
        if (cacheType === 'post' || cacheType === 'comments') {
          this.cacheMetricsService.recordCacheLockWaited(cacheType, waitTime);
        }

        return; // 락 해제됨
      }

      // 100ms 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.warn(`Lock wait timeout (${maxWaitMs}ms): ${key}`);

    // Prometheus 메트릭 기록 - 타임아웃도 기록
    const cacheType = this.detectCacheType(key);
    if (cacheType === 'post' || cacheType === 'comments') {
      this.cacheMetricsService.recordCacheLockWaited(cacheType, maxWaitMs);
    }
  }
}