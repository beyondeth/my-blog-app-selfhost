import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { UnifiedRedisService } from '../redis/unified-redis.service';
import { CacheMetricsService } from '../metrics/cache-metrics.service';
import { createHash } from 'crypto';

// 캐시 TTL 상수 (초 단위) - 메모리 최적화 전략
export enum CacheTTL {
  // 핫 데이터 (높은 가치)
  VERY_SHORT = 5,    // 5초 - 댓글 트리 (실시간성 중요)

  // 온 데이터 (중간 가치)
  SHORT = 30,        // 30초 - 실시간 데이터
  HOME_FEED = 30,    // 30초 - 홈 피드 (5분에서 10초로 대폭 단축)
  MEDIUM = 30,       // 30초 - 포스트 목록 (5분에서 10초로 대폭 단축)

  // 콜드 데이터 (낮은 가치)
  LONG = 180,        // 3분 - 기타 데이터

  // 정적 데이터 (고정 가치)
  STATIC = 3600,     // 1시간 - 블로그 설정, 태그

  // 개선된 TTL - 단순화 및 최적화
  POST_DETAIL = 60,  // 1분 - 포스트 상세 (기존 1800초에서 대폭 단축)
  PROFILE = 300,     // 5분 - 프로필 (기존 1800초에서 단축)
  MY_BLOG = 10,      // 10초 - 내 블로그 피드 (실시성 + 성능 균형)
  DAY = 86400,       // 24시간 - 사용자 조회 기록

  // 시스템 관리
  DELETED_POSTS_CLEANUP = 60, // 1분 - 삭제된 포스트 정리 (기존 5분에서 단축)
}

// 표준화된 캐시 키 생성 헬퍼
export const CacheKeys = {
  // Feed 관련 - 표준화된 패턴
  FEED_HOME: (page: number = 1) => `feed:home:page:${page}`,
  FEED_BLOG: (slug: string, page: number = 1) => `feed:blog:${slug}:page:${page}`,
  FEED_EDITOR_PICKS: (limit?: number) =>
    limit ? `feed:editor-picks:limit:${limit}` : 'feed:editor-picks',
  FEED_POPULAR: (period: 'daily' | 'weekly' | 'monthly', limit?: number) =>
    limit ? `feed:popular:${period}:limit:${limit}` : `feed:popular:${period}`,
  FEED_SEARCH: (query: string, page: number = 1) => {
    const hash = createHash('md5').update(query).digest('hex').substring(0, 8);
    return `feed:search:${hash}:page:${page}`;
  },
  FEED_CATEGORY: (category: string, page: number = 1) =>
    `feed:category:${category}:page:${page}`,
  FEED_TAG: (tag: string, page: number = 1) =>
    `feed:tag:${tag}:page:${page}`,

  // Post 관련
  POST_DETAIL: (id: string) => `post:${id}`,
  POST_CORE: (id: string) => `post:core:${id}`,
  POST_METRICS: (id: string) => `post:metrics:${id}`,
  POST_COMMENTS: (id: string, page?: number) =>
    page ? `post:${id}:comments:page:${page}` : `post:${id}:comments`,
  POST_RELATED: (id: string) => `post:${id}:related`,
  POST_BY_SLUG: (slug: string) => `post:slug:${slug}`,
  POST_REBUILDING: (id: string) => `rebuilding:post:${id}`,
  POST_USER_VIEW: (postId: string, userId: string) => `post:${postId}:view:${userId}`,

  // User 관련
  USER_BY_ID: (id: string) => `user:id:${id}`,
  USER_PROFILE: (id: string) => `user:${id}:profile`,
  USER_POSTS: (id: string, page: number = 1) =>
    `user:${id}:posts:page:${page}`,
  USER_COMMENTS: (id: string, page: number = 1) =>
    `user:${id}:comments:page:${page}`,
  USER_STATS: (id: string) => `user:${id}:stats`,
  USER_BY_EMAIL: (email: string) => `user:email:${btoa(email)}`,

  // Blog 관련
  BLOG_INFO: (slug: string) => `blog:${slug}:info`,
  BLOG_STATS: (slug: string) => `blog:${slug}:stats`,
  BLOG_CATEGORIES: (slug: string) => `blog:${slug}:categories`,
  BLOG_TAGS: (slug: string) => `blog:${slug}:tags`,
  BLOG_BY_SLUG: (slug: string) => `blog:slug:${slug}`,
  BLOG_BY_USER: (userId: string) => `blog:user:${userId}`,
  BLOG_BY_ID: (id: string) => `blog:id:${id}`,

  // Alias 관련 - @alias 시스템을 위한 통합된 캐시 키
  ALIAS_MAPPING: (identifier: string) => `alias:map:${identifier}`,
  IDENTIFIER_TO_BLOG: (identifier: string) => `blog:identifier:${identifier}`,
  BLOG_FEED_BY_ALIAS: (alias: string, page: number) => `feed:blog:${alias}:page:${page}`,
  BLOG_FEED_BY_ID: (blogId: string, page: number) => `feed:blog:${blogId}:page:${page}`,

  // Comment 관련
  COMMENT_TREE: (postId: string) => `comment:tree:${postId}`,
  COMMENT_COUNT: (postId: string) => `comment:count:${postId}`,
  COMMENTS_PAGE_FIRST: (postId: string, sortBy: string) =>
    `comments:page:first:${postId}:${sortBy}`,
  COMMENTS_TOTAL: (postId: string) => `comments:total:${postId}`,
  COMMENT_REPLIES_FIRST: (commentId: string) =>
    `comments:replies:first:${commentId}`,
  COMMENTS_REBUILDING: (postId: string) => `rebuilding:comments:${postId}`,

  // 통계
  POST_VIEW_COUNT: (postId: string) => `views:post:${postId}`,

  // API 키
  API_KEY: (keyId: string) => `api:key:${keyId}`,

  // System 관련
  SYSTEM_WARMING_LIST: () => `system:warming:list`,
  SYSTEM_CACHE_STATS: () => `system:cache:stats`,
  SYSTEM_CACHE_VERSION: () => `system:cache:version`,

  // 캐시 키 패턴 (와일드카드 포함)
  PATTERN_ALL_FEEDS: () => `feed:*`,
  PATTERN_BLOG_FEEDS: (slug: string) => `feed:blog:${slug}:*`,
  PATTERN_HOME_PAGES: () => `feed:home:page:*`,
  PATTERN_ALL_POPULAR: () => `feed:popular:*`,
  PATTERN_POST_ALL: (id: string) => `post:*:${id}:*`,
  PATTERN_USER_ALL: (id: string) => `user:${id}:*`,
  PATTERN_BLOG_ALL: (slug: string) => `blog:${slug}:*`,
};

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);

  // Debounce 메커니즘
  private readonly pendingInvalidations = new Map<string, NodeJS.Timeout>();
  private readonly defaultDebounce = 500; // 500ms
  private readonly defaultTTL = 300; // 5분

  // 메모리 누수 방지를 위한 cleanup 인터벌
  private cleanupInterval: NodeJS.Timeout;

  // 캐시 통계 추적
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheSets = 0;
  private cacheDeletes = 0;

  constructor(
    @InjectRedis() private readonly redis: Redis,
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
   * 패턴으로 키 조회하기 (지연된 작업 처리용)
   */
  async getKeys(pattern: string): Promise<string[]> {
    try {
      const keys = await this.redis.keys(pattern);
      return keys;
    } catch (error) {
      this.logger.error(`Failed to get keys for pattern ${pattern}:`, error);
      return [];
    }
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

  /**
   * 패턴 기반 캐시 무효화 (Debounce 지원)
   * 여러 요청이 동시에 들어와도 한 번만 실행
   */
  async invalidatePattern(pattern: string, options?: { force?: boolean; debounce?: number }): Promise<void> {
    // Force 옵션이 있으면 즉시 실행
    if (options?.force) {
      return this.executeInvalidation(pattern);
    }

    // Debounce 처리
    const debounceTime = options?.debounce || this.defaultDebounce;

    // 이미 대기 중인 무효화가 있으면 취소
    const existingTimeout = this.pendingInvalidations.get(pattern);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.logger.debug(`🔄 [Debounce] Cancelled previous invalidation for: ${pattern}`);
    }

    // 새로운 타임아웃 설정
    const timeout = setTimeout(async () => {
      await this.executeInvalidation(pattern);
      this.pendingInvalidations.delete(pattern);
      this.cacheMetricsService.recordDebounceHit();
      this.logger.debug(`✅ [Debounce] Executed invalidation for: ${pattern}`);
    }, debounceTime);

    this.pendingInvalidations.set(pattern, timeout);
    this.logger.debug(`⏳ [Debounce] Scheduled invalidation for: ${pattern} in ${debounceTime}ms`);
  }

  /**
   * 실제 캐시 무효화 실행 (SCAN + UNLINK)
   * Non-blocking 방식으로 대량 키 삭제
   */
  private async executeInvalidation(pattern: string): Promise<void> {
    const startTime = Date.now();
    let deletedCount = 0;

    try {
      // Redis에 저장된 키는 'cache:' prefix를 가지므로 패턴에도 추가
      const scanPattern = `cache:${pattern}`;

      // SCAN을 사용한 비차단 패턴 매칭
      const stream = this.redis.scanStream({
        match: scanPattern,
        count: 100,
      });

      const keysToDelete: string[] = [];

      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          keysToDelete.push(...keys);
          this.logger.debug(`🔍 Found ${keys.length} keys matching: ${scanPattern}`);
        }
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', async () => {
          if (keysToDelete.length > 0) {
            // UNLINK를 사용한 비차단 삭제
            deletedCount = await this.redis.unlink(...keysToDelete);
            this.logger.log(`🧹 Deleted ${deletedCount} keys for pattern: ${scanPattern}`);
          } else {
            this.logger.debug(`⚠️ No keys found matching: ${scanPattern}`);
          }
          resolve();
        });

        stream.on('error', reject);
      });

      // 메트릭 기록
      const duration = Date.now() - startTime;
      this.cacheMetricsService.recordPatternDeletion(pattern, deletedCount, duration);

      if (deletedCount > 0) {
        this.logger.log(`✅ Cache invalidation completed for: ${pattern} (${deletedCount} keys, ${duration}ms)`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to invalidate pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * 여러 패턴을 배치로 무효화
   */
  async invalidatePatterns(patterns: string[], options?: { force?: boolean; debounce?: number }): Promise<void> {
    const promises = patterns.map(pattern =>
      this.invalidatePattern(pattern, options)
    );
    await Promise.all(promises);
  }

  /**
   * @alias 시스템을 위한 통합된 캐시 무효화
   * @param oldAlias - 이전 별칭
   * @param newAlias - 새 별칭
   * @param blogId - 블로그 ID
   */
  async invalidateAliasCache(oldAlias?: string, newAlias?: string, blogId?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      // 1. Alias 관련 캐시 무효화
      if (oldAlias) {
        keysToDelete.push(
          CacheKeys.ALIAS_MAPPING(oldAlias),
          CacheKeys.IDENTIFIER_TO_BLOG(oldAlias),
          CacheKeys.BLOG_FEED_BY_ALIAS(oldAlias, 1),
          CacheKeys.BLOG_FEED_BY_ALIAS(oldAlias, 2),
          CacheKeys.BLOG_FEED_BY_ALIAS(oldAlias, 3),
          CacheKeys.BLOG_FEED_BY_ALIAS(oldAlias, 4),
          CacheKeys.BLOG_FEED_BY_ALIAS(oldAlias, 5)
        );
      }

      if (newAlias) {
        keysToDelete.push(
          CacheKeys.ALIAS_MAPPING(newAlias),
          CacheKeys.IDENTIFIER_TO_BLOG(newAlias),
          CacheKeys.BLOG_FEED_BY_ALIAS(newAlias, 1),
          CacheKeys.BLOG_FEED_BY_ALIAS(newAlias, 2),
          CacheKeys.BLOG_FEED_BY_ALIAS(newAlias, 3),
          CacheKeys.BLOG_FEED_BY_ALIAS(newAlias, 4),
          CacheKeys.BLOG_FEED_BY_ALIAS(newAlias, 5)
        );
      }

      // 2. BlogId 관련 캐시 무효화
      if (blogId) {
        // feed:blog:{blogId}:page:* 패턴 무효화 (와일드카드)
        // SCAN 사용으로 KEYS 대체 (블로킹 방지)
        const pattern = `cache:feed:blog:${blogId}:page:*`;
        const keys = [];
        let cursor = '0';

        do {
          const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = result[0];
          const scannedKeys = result[1];

          if (scannedKeys.length > 0) {
            keys.push(...scannedKeys);
          }
        } while (cursor !== '0');

        if (keys.length > 0) {
          await this.redis.del(...keys);
          this.logger.debug(`[Cache] Invalidated ${keys.length} keys for pattern: ${pattern}`);
        }

        // 개별 페이지 키도 추가
        for (let i = 1; i <= 5; i++) {
          keysToDelete.push(CacheKeys.BLOG_FEED_BY_ID(blogId, i));
        }
      }

      // 3. 개별 키 삭제
      if (keysToDelete.length > 0) {
        const deletePromises = keysToDelete.map(key =>
          this.unifiedRedisService.del(`cache:${key}`).catch(err =>
            this.logger.warn(`Failed to delete cache key ${key}:`, err)
          )
        );
        await Promise.all(deletePromises);
      }

      this.logger.debug(`[Cache] Invalidated alias cache: old=${oldAlias}, new=${newAlias}, blogId=${blogId}`);
    } catch (error) {
      this.logger.error(`[Cache] Failed to invalidate alias cache:`, error);
    }
  }

  /**
   * 모듈 초기화 시 cleanup 인터벌 설정
   */
  onModuleInit(): void {
    // 5분마다 stale pending invalidations 정리
    this.cleanupInterval = setInterval(
      () => this.cleanupPendingInvalidations(),
      5 * 60 * 1000 // 5분
    );
    this.logger.debug('🕐 [Init] Cache cleanup interval started (5min)');
  }

  /**
   * 서비스 종료 시 pending 패턴 정리
   */
  async onModuleDestroy(): Promise<void> {
    // cleanup 인터벌 정리
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.logger.debug('🛑 [Shutdown] Cache cleanup interval stopped');
    }
    // 모든 pending 타임아웃 취소
    const pendingCount = this.pendingInvalidations.size;
    if (pendingCount > 0) {
      this.logger.log(`🔚 [Shutdown] Cleaning up ${pendingCount} pending cache invalidations...`);

      for (const [pattern, timeout] of this.pendingInvalidations) {
        clearTimeout(timeout);
        // 종료 시점에는 즉시 무효화 실행
        try {
          await this.executeInvalidation(pattern);
        } catch (error) {
          this.logger.error(`Failed to execute pending invalidation on shutdown: ${pattern}`, error.message);
        }
      }
      this.pendingInvalidations.clear();
      this.logger.log('✅ [Shutdown] All pending cache invalidations cleared');
    }
  }

  /**
   * 수동으로 pending invalidations 정리 (메모리 누수 방지)
   * 주기적으로 호출하여 미처리된 패턴 정리
   */
  async cleanupPendingInvalidations(): Promise<void> {
    const now = Date.now();
    const patternsToClean: string[] = [];

    // 5분 이상 대기 중인 패턴 찾기
    for (const [pattern, timeout] of this.pendingInvalidations) {
      // 타임아웃 객체에서 남은 시간 확인 (간단한 heuristics)
      if ((timeout as any)._idleStart) {
        const elapsed = now - (timeout as any)._idleStart;
        if (elapsed > 5 * 60 * 1000) { // 5분 초과
          patternsToClean.push(pattern);
        }
      }
    }

    if (patternsToClean.length > 0) {
      this.logger.warn(`🧹 [Cleanup] Force cleaning ${patternsToClean.length} stale pending invalidations`);
      for (const pattern of patternsToClean) {
        const timeout = this.pendingInvalidations.get(pattern);
        if (timeout) {
          clearTimeout(timeout);
          this.pendingInvalidations.delete(pattern);
          // 즉시 실행
          try {
            await this.executeInvalidation(pattern);
          } catch (error) {
            this.logger.error(`Failed to execute stale invalidation: ${pattern}`, error.message);
          }
        }
      }
    }
  }
}