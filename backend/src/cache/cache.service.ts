import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

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
  
  // 캐시 통계 추적을 위한 Shadow Map
  private readonly cacheTracker = new Map<string, { size: number; setAt: Date }>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheSets = 0;
  private cacheDeletes = 0;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * 캐시에서 값 가져오기
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.cacheManager.get<T>(key);
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
   * 캐시에 값 저장
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      
      // Shadow Map에 추적 정보 저장
      try {
        const size = JSON.stringify(value).length;
        this.cacheTracker.set(key, { size, setAt: new Date() });
        this.cacheSets++;
      } catch {
        // 직렬화 실패 시 기본값
        this.cacheTracker.set(key, { size: 1000, setAt: new Date() });
      }
      
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * 캐시에서 값 삭제
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      
      // Shadow Map에서도 제거
      this.cacheTracker.delete(key);
      this.cacheDeletes++;
      
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * 패턴에 매칭되는 모든 키 삭제
   * 주의: Redis에서만 작동, 개발 환경에서는 무시됨
   * SCAN 명령어 사용으로 성능 개선
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      // cache-manager v5 이상에서는 store 구조가 다름
      const store = (this.cacheManager as any).store || this.cacheManager;
      
      // Redis store인 경우에만 패턴 삭제 지원
      if (store && store.client) {
        const keys: string[] = [];
        let cursor = '0';
        
        // SCAN 명령어로 키 조회 (블로킹 방지)
        do {
          const result = await new Promise<[string, string[]]>((resolve, reject) => {
            store.client.scan(
              cursor,
              'MATCH',
              pattern,
              'COUNT',
              100, // 한 번에 100개씩 스캔
              (err, result) => {
                if (err) reject(err);
                else resolve(result);
              }
            );
          });
          
          cursor = result[0];
          keys.push(...result[1]);
        } while (cursor !== '0');
        
        // 찾은 키들 삭제
        if (keys.length > 0) {
          // 배치로 삭제 (파이프라인 사용)
          const pipeline = store.client.pipeline();
          keys.forEach(key => pipeline.del(key));
          await pipeline.exec();
          
          this.logger.debug(`Cache DEL pattern: ${pattern} (${keys.length} keys via SCAN)`);
        }
      } else if (store && store.keys) {
        // Fallback: keys 명령어 사용 (개발 환경)
        const keys = await store.keys(pattern);
        if (keys && keys.length > 0) {
          await Promise.all(keys.map(key => this.del(key)));
          this.logger.debug(`Cache DEL pattern: ${pattern} (${keys.length} keys)`);
        }
      } else {
        // 메모리 캐시 사용 시 - 전체 키 순회
        try {
          const cache = (store as any).getCache ? (store as any).getCache() : store;
          if (cache && cache.keys) {
            const allKeys = Array.from(cache.keys()) as string[];
            // 패턴을 정규식으로 변환 (* -> .*)
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            const matchingKeys = allKeys.filter((key: string) => regex.test(key));
            
            if (matchingKeys.length > 0) {
              await Promise.all(matchingKeys.map((key: string) => this.del(key)));
              this.logger.debug(`Cache DEL pattern (memory): ${pattern} (${matchingKeys.length} keys)`);
            }
          }
        } catch (err) {
          this.logger.debug('Memory cache pattern deletion not supported');
        }
      }
    } catch (error) {
      this.logger.error(`Cache DEL pattern error for ${pattern}:`, error);
    }
  }

  /**
   * 캐시 초기화
   */
  async reset(): Promise<void> {
    try {
      // cache-manager v5에서는 reset 메서드가 없을 수 있음
      if (typeof (this.cacheManager as any).reset === 'function') {
        await (this.cacheManager as any).reset();
      } else {
        // Redis store 직접 접근
        const store = (this.cacheManager as any).store || this.cacheManager;
        if (store && store.client && store.client.flushdb) {
          await new Promise((resolve, reject) => {
            store.client.flushdb((err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        } else {
          // 메모리 캐시의 경우 모든 키 삭제
          await this.deletePattern('*');
        }
      }
      
      // Shadow Map도 초기화
      this.cacheTracker.clear();
      this.cacheHits = 0;
      this.cacheMisses = 0;
      this.cacheSets = 0;
      this.cacheDeletes = 0;
      
      this.logger.warn('Cache RESET: All cache cleared');
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
   * 메모리 사용량 조회
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
      const store = (this.cacheManager as any).store || this.cacheManager;
      
      // Redis 사용 중인 경우
      if (store && store.client) {
        const info = await new Promise<string>((resolve, reject) => {
          store.client.info('memory', (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        
        // Redis 메모리 정보 파싱
        const usedMemory = info.match(/used_memory_human:(.+)/)?.[1] || 'N/A';
        const maxMemory = info.match(/maxmemory_human:(.+)/)?.[1] || 'N/A';
        
        return {
          itemCount: -1, // Redis에서는 정확한 개수 파악 어려움
          estimatedSize: usedMemory,
          maxItems: -1,
          maxSize: maxMemory,
          usagePercent: -1,
          cacheType: 'redis',
        };
      }
      
      // 메모리 캐시 사용 중인 경우
      // CustomMemoryStore를 사용하는 경우
      try {
        let allKeys: string[] = [];
        let totalSize = 0;
        let itemCount = 0;
        
        // CustomMemoryStore의 dump() 메서드 사용
        if (store && typeof store.dump === 'function') {
          const dump = store.dump();
          if (Array.isArray(dump)) {
            itemCount = dump.length;
            dump.forEach(([key, entry]) => {
              allKeys.push(key);
              // CustomMemoryStore는 { value, size } 형태로 반환
              if (entry && entry.value) {
                try {
                  // size가 이미 계산되어 있으면 사용, 없으면 계산
                  const size = entry.size || JSON.stringify(entry.value).length;
                  totalSize += size;
                } catch {
                  totalSize += 1000;
                }
              }
            });
          }
        } else if (store && typeof store.keys === 'function') {
          // keys() 메서드가 있는 경우
          try {
            // LRUCache의 keys()는 Generator를 반환
            const keysGen = store.keys();
            for (const key of keysGen) {
              allKeys.push(key);
              itemCount++;
            }
            
            // 각 키에 대해 값 가져오기
            for (const key of allKeys) {
              try {
                const value = await this.get(key);
                if (value) {
                  const size = JSON.stringify(value).length;
                  totalSize += size;
                }
              } catch {
                totalSize += 1000;
              }
            }
          } catch (e) {
            this.logger.debug('Failed to iterate keys:', e);
          }
        } else if (store && typeof store.size === 'number') {
          // LRUCache는 size 속성을 가짐
          itemCount = store.size;
          
          // forEach 메서드로 시도
          if (typeof store.forEach === 'function') {
            store.forEach((value, key) => {
              allKeys.push(key);
              try {
                const size = JSON.stringify(value).length;
                totalSize += size;
              } catch {
                totalSize += 1000;
              }
            });
          }
        }
        
        // Shadow Map을 사용하여 통계 제공
        if (itemCount === 0 && this.cacheTracker.size > 0) {
          // Shadow Map에서 데이터 가져오기
          itemCount = this.cacheTracker.size;
          totalSize = 0;
          
          // 현재 시간
          const now = new Date();
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          
          // 1시간 이상 오래된 항목 제거 (만료된 것으로 추정)
          for (const [key, data] of this.cacheTracker.entries()) {
            if (data.setAt < oneHourAgo) {
              this.cacheTracker.delete(key);
            } else {
              totalSize += data.size;
            }
          }
          
          // 다시 카운트
          itemCount = this.cacheTracker.size;
        }
        
        const maxSize = 200 * 1024 * 1024; // 200MB
        const usagePercent = totalSize > 0 ? (totalSize / maxSize) * 100 : 0;
        
        // 80% 이상 사용 시 경고
        if (usagePercent > 80) {
          this.logger.warn(`Memory cache usage high: ${usagePercent.toFixed(2)}%`);
        }
        
        // Hit rate 계산
        const totalRequests = this.cacheHits + this.cacheMisses;
        const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;
        
        return {
          itemCount,
          estimatedSize: totalSize > 0 ? this.formatBytes(totalSize) : 'Unknown',
          maxItems: 5000,
          maxSize: '200 MB',
          usagePercent: parseFloat(usagePercent.toFixed(2)),
          cacheType: itemCount > 0 ? 'memory (tracked)' : 'memory',
          hits: this.cacheHits,
          misses: this.cacheMisses,
          sets: this.cacheSets,
          deletes: this.cacheDeletes,
          hitRate: parseFloat(hitRate.toFixed(2)),
        };
      } catch (error) {
        this.logger.debug('Memory cache inspection failed:', error);
      }
      
      // Shadow Map 데이터를 사용하여 기본 통계 제공
      let totalSize = 0;
      for (const data of this.cacheTracker.values()) {
        totalSize += data.size;
      }
      
      const maxSize = 200 * 1024 * 1024;
      const usagePercent = totalSize > 0 ? (totalSize / maxSize) * 100 : 0;
      const totalRequests = this.cacheHits + this.cacheMisses;
      const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;
      
      return {
        itemCount: this.cacheTracker.size,
        estimatedSize: totalSize > 0 ? this.formatBytes(totalSize) : '0 B',
        maxItems: 5000,
        maxSize: '200 MB',
        usagePercent: parseFloat(usagePercent.toFixed(2)),
        cacheType: 'memory (tracked)',
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
   * 캐시 통계 조회 (디버깅용)
   * Shadow Map을 사용하여 통계 제공
   */
  async getStats(): Promise<any> {
    try {
      const store = (this.cacheManager as any).store || this.cacheManager;
      
      if (store && store.client) {
        // Redis SCAN 사용
        const keys: string[] = [];
        let cursor = '0';
        
        // SCAN으로 모든 키 조회
        do {
          const result = await new Promise<[string, string[]]>((resolve, reject) => {
            store.client.scan(
              cursor,
              'COUNT',
              100, // 한 번에 100개씩
              (err, result) => {
                if (err) reject(err);
                else resolve(result);
              }
            );
          });
          
          cursor = result[0];
          keys.push(...result[1]);
        } while (cursor !== '0');
        
        const stats = {
          totalKeys: keys.length,
          patterns: {},
        };
        
        // 패턴별 키 수 계산
        keys.forEach((key: string) => {
          const pattern = key.split(':')[0];
          stats.patterns[pattern] = (stats.patterns[pattern] || 0) + 1;
        });
        
        return stats;
      }
      
      // 메모리 캐시의 경우 - cache-manager v7 (LRUCache)
      let allKeys: string[] = [];
      
      try {
        // cache-manager v7에서 메모리 캐시는 LRUCache
        if (store && typeof store.dump === 'function') {
          // LRUCache의 dump() 메서드 사용
          const dump = store.dump();
          if (Array.isArray(dump)) {
            dump.forEach(([key]) => {
              allKeys.push(key);
            });
          }
        } else if (store && typeof store.keys === 'function') {
          // keys() 메서드가 있는 경우 (Generator)
          try {
            const keysGen = store.keys();
            for (const key of keysGen) {
              allKeys.push(key);
            }
          } catch (e) {
            this.logger.debug('Failed to iterate keys in stats:', e);
          }
        } else if (store && typeof store.forEach === 'function') {
          // forEach 메서드로 시도
          store.forEach((value, key) => {
            allKeys.push(key);
          });
        }
        
        const stats = {
          totalKeys: allKeys.length,
          patterns: {},
        };
        
        // 패턴별 키 수 계산
        allKeys.forEach((key: string) => {
          const pattern = String(key).split(':')[0];
          stats.patterns[pattern] = (stats.patterns[pattern] || 0) + 1;
        });
        
        // Shadow Map에서 보충 데이터 추가
        if (stats.totalKeys === 0 && this.cacheTracker.size > 0) {
          stats.totalKeys = this.cacheTracker.size;
          
          // Shadow Map에서 패턴 분석
          for (const key of this.cacheTracker.keys()) {
            const pattern = String(key).split(':')[0];
            stats.patterns[pattern] = (stats.patterns[pattern] || 0) + 1;
          }
        }
        
        // 추가 통계 정보
        const extendedStats = {
          ...stats,
          hits: this.cacheHits,
          misses: this.cacheMisses,
          sets: this.cacheSets,
          deletes: this.cacheDeletes,
          hitRate: this.cacheHits + this.cacheMisses > 0 
            ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(2) + '%'
            : '0%',
        };
        
        return extendedStats;
      } catch (error) {
        this.logger.debug('Failed to get memory cache stats, using shadow map:', error);
        
        // Shadow Map에서 통계 생성
        const stats = {
          totalKeys: this.cacheTracker.size,
          patterns: {},
          hits: this.cacheHits,
          misses: this.cacheMisses,
          sets: this.cacheSets,
          deletes: this.cacheDeletes,
          hitRate: this.cacheHits + this.cacheMisses > 0 
            ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(2) + '%'
            : '0%',
        };
        
        // 패턴 분석
        for (const key of this.cacheTracker.keys()) {
          const pattern = String(key).split(':')[0];
          stats.patterns[pattern] = (stats.patterns[pattern] || 0) + 1;
        }
        
        return stats;
      }
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