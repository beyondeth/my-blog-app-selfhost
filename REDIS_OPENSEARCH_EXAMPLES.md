# Redis & OpenSearch 구현 예제

## 📚 목차
1. [Redis 캐싱 구현 예제](#redis-캐싱-구현-예제)
2. [OpenSearch 검색 구현 예제](#opensearch-검색-구현-예제)
3. [통합 구현 예제](#통합-구현-예제)

---

## Redis 캐싱 구현 예제

### 1. Posts Controller with Redis Caching

```typescript
// backend/src/posts/posts.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseInterceptors } from '@nestjs/common';
import { PostsService } from './posts.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { Cacheable, CachePresets } from '../cache/cache.decorators';
import { CacheInterceptor } from '../cache/cache.interceptor';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Get all posts with caching (1 minute TTL)
   */
  @Get()
  @Cacheable({
    key: 'posts:list',
    ttl: 60,
    prefix: 'api',
  })
  async findAll(@Query('page') page: number = 1) {
    return this.postsService.findAll({ page });
  }

  /**
   * Get popular posts with longer cache (5 minutes)
   */
  @Get('popular')
  @CachePresets.ApiResponse()
  async findPopular() {
    return this.postsService.findPopular();
  }

  /**
   * Get single post with cache-aside pattern
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Manual cache management for more control
    const cacheKey = RedisCacheService.keys.post(id);
    
    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const post = await this.postsService.findOne(id);
    
    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, post, {
      ttl: RedisCacheService.ttl.standard,
    });

    return post;
  }

  /**
   * Create post and invalidate related caches
   */
  @Post()
  async create(@Body() createPostDto: any) {
    const post = await this.postsService.create(createPostDto);

    // Invalidate related caches
    await this.cacheService.invalidate([
      'posts:list*',
      'posts:popular*',
      `blog:${post.blogId}:posts*`,
    ]);

    return post;
  }

  /**
   * Get post statistics with caching
   */
  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.cacheService.getOrSet(
      `post:${id}:stats`,
      async () => {
        // Expensive computation
        const views = await this.postsService.getViewCount(id);
        const likes = await this.postsService.getLikeCount(id);
        const comments = await this.postsService.getCommentCount(id);
        
        return { views, likes, comments };
      },
      {
        ttl: RedisCacheService.ttl.hour,
        prefix: 'stats',
      },
    );
  }
}
```

### 2. Session Management with Redis

```typescript
// backend/src/auth/session.service.ts
import { Injectable } from '@nestjs/common';
import { RedisCacheService } from '../cache/redis-cache.service';

@Injectable()
export class SessionService {
  constructor(private readonly cacheService: RedisCacheService) {}

  /**
   * Create user session
   */
  async createSession(userId: string, sessionData: any): Promise<string> {
    const sessionId = this.generateSessionId();
    const sessionKey = RedisCacheService.keys.userSession(sessionId);

    await this.cacheService.set(
      sessionKey,
      {
        userId,
        ...sessionData,
        createdAt: new Date(),
      },
      {
        ttl: RedisCacheService.ttl.session, // 24 hours
      },
    );

    return sessionId;
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<any> {
    const sessionKey = RedisCacheService.keys.userSession(sessionId);
    return this.cacheService.get(sessionKey);
  }

  /**
   * Extend session TTL on activity
   */
  async touchSession(sessionId: string): Promise<void> {
    const sessionKey = RedisCacheService.keys.userSession(sessionId);
    const session = await this.cacheService.get(sessionKey);
    
    if (session) {
      await this.cacheService.set(
        sessionKey,
        { ...session, lastActivity: new Date() },
        { ttl: RedisCacheService.ttl.session },
      );
    }
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    const sessionKey = RedisCacheService.keys.userSession(sessionId);
    await this.cacheService.delete(sessionKey);
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
```

### 3. Rate Limiting with Redis

```typescript
// backend/src/common/rate-limiter.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisCacheService } from '../cache/redis-cache.service';

@Injectable()
export class RateLimiterService {
  constructor(private readonly cacheService: RedisCacheService) {}

  /**
   * Check rate limit
   */
  async checkRateLimit(
    identifier: string,
    endpoint: string,
    limit: number = 100,
    window: number = 60, // seconds
  ): Promise<void> {
    const key = RedisCacheService.keys.rateLimit(identifier, endpoint);
    
    // Get current count
    const current = await this.cacheService.get<number>(key) || 0;
    
    if (current >= limit) {
      throw new HttpException(
        'Rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    await this.cacheService.set(key, current + 1, { ttl: window });
  }
}
```

### 4. Cache Warming Strategy

```typescript
// backend/src/cache/cache-warmer.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisCacheService } from './redis-cache.service';
import { PostsService } from '../posts/posts.service';
import { BlogsService } from '../blogs/blogs.service';

@Injectable()
export class CacheWarmerService implements OnModuleInit {
  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly postsService: PostsService,
    private readonly blogsService: BlogsService,
  ) {}

  async onModuleInit() {
    // Warm cache on startup
    await this.warmCache();
  }

  /**
   * Warm cache every hour
   */
  @Cron('0 0 * * * *')
  async warmCache() {
    const warmupKeys = [
      {
        key: 'posts:popular:daily',
        factory: () => this.postsService.getPopularPosts('daily'),
        options: { ttl: RedisCacheService.ttl.hour },
      },
      {
        key: 'posts:popular:weekly',
        factory: () => this.postsService.getPopularPosts('weekly'),
        options: { ttl: RedisCacheService.ttl.hour },
      },
      {
        key: 'blogs:featured',
        factory: () => this.blogsService.getFeaturedBlogs(),
        options: { ttl: RedisCacheService.ttl.day },
      },
    ];

    await this.cacheService.warmUp(warmupKeys);
  }
}
```

---

## OpenSearch 검색 구현 예제

### 1. Search Controller

```typescript
// backend/src/search/search.controller.ts
import { Controller, Get, Query, Param } from '@nestjs/common';
import { PostSearchService } from './post-search.service';
import { UserSearchService } from './user-search.service';

@Controller('search')
export class SearchController {
  constructor(
    private readonly postSearchService: PostSearchService,
    private readonly userSearchService: UserSearchService,
  ) {}

  /**
   * Search posts
   */
  @Get('posts')
  async searchPosts(
    @Query('q') query: string,
    @Query('tags') tags?: string,
    @Query('category') category?: string,
    @Query('sort') sortBy?: 'relevance' | 'date' | 'popularity',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const tagArray = tags ? tags.split(',') : undefined;

    const results = await this.postSearchService.searchPosts({
      query,
      tags: tagArray,
      category,
      sortBy,
      page,
      limit,
      highlight: true,
    });

    // Get facets for filters
    const facets = await this.postSearchService.getSearchFacets(query);

    return {
      results: results.hits,
      total: results.total,
      page,
      limit,
      facets,
    };
  }

  /**
   * Get trending posts
   */
  @Get('posts/trending')
  async getTrendingPosts(
    @Query('period') period: 'day' | 'week' | 'month' = 'week',
    @Query('limit') limit: number = 10,
  ) {
    const results = await this.postSearchService.getTrendingPosts(period, limit);
    return {
      posts: results.hits,
      total: results.total,
    };
  }

  /**
   * Get similar posts
   */
  @Get('posts/:id/similar')
  async getSimilarPosts(
    @Param('id') postId: string,
    @Query('limit') limit: number = 5,
  ) {
    const results = await this.postSearchService.getSimilarPosts(postId, limit);
    return {
      posts: results.hits,
      total: results.total,
    };
  }

  /**
   * Autocomplete suggestions
   */
  @Get('suggest')
  async getSuggestions(
    @Query('q') query: string,
    @Query('type') type: 'posts' | 'tags' | 'users' = 'posts',
  ) {
    let suggestions: string[] = [];

    switch (type) {
      case 'posts':
        suggestions = await this.postSearchService.getPostSuggestions(query);
        break;
      case 'tags':
        suggestions = await this.postSearchService.getTagSuggestions(query);
        break;
      case 'users':
        suggestions = await this.userSearchService.getUserSuggestions(query);
        break;
    }

    return { suggestions };
  }

  /**
   * Advanced search with filters
   */
  @Get('advanced')
  async advancedSearch(
    @Query('q') query: string,
    @Query('blogId') blogId?: string,
    @Query('author') author?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('tags') tags?: string,
    @Query('minViews') minViews?: number,
    @Query('minLikes') minLikes?: number,
  ) {
    // Complex search with multiple criteria
    const results = await this.postSearchService.searchPosts({
      query,
      blogId,
      author,
      tags: tags ? tags.split(',') : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      sortBy: 'relevance',
      highlight: true,
    });

    return results;
  }
}
```

### 2. Post Indexing Service

```typescript
// backend/src/posts/post-indexing.service.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PostSearchService, PostSearchDocument } from '../search/post-search.service';
import { Post } from './entities/post.entity';

@Injectable()
export class PostIndexingService {
  constructor(private readonly postSearchService: PostSearchService) {}

  /**
   * Index post on creation
   */
  @OnEvent('post.created')
  async handlePostCreated(post: Post) {
    const searchDocument = this.toSearchDocument(post);
    await this.postSearchService.indexPost(searchDocument);
  }

  /**
   * Update index on post update
   */
  @OnEvent('post.updated')
  async handlePostUpdated(post: Post) {
    const searchDocument = this.toSearchDocument(post);
    await this.postSearchService.updatePost(post.id, searchDocument);
  }

  /**
   * Remove from index on deletion
   */
  @OnEvent('post.deleted')
  async handlePostDeleted(postId: string) {
    await this.postSearchService.deletePost(postId);
  }

  /**
   * Convert entity to search document
   */
  private toSearchDocument(post: Post): PostSearchDocument {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt || post.content.substring(0, 200),
      tags: post.tags || [],
      category: post.category,
      author: post.author.id,
      authorName: post.author.displayName || post.author.username,
      blogId: post.blog.id,
      blogSlug: post.blog.slug,
      slug: post.slug,
      isPublished: post.isPublished,
      isPrivate: post.blog.isPrivate || false,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      viewCount: post.viewCount || 0,
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
    };
  }
}
```

### 3. User Search Service

```typescript
// backend/src/search/user-search.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OpenSearchService, SearchResult } from './opensearch.service';

export interface UserSearchDocument {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  lastActiveAt?: Date;
  postCount: number;
  followerCount: number;
}

@Injectable()
export class UserSearchService {
  private readonly logger = new Logger(UserSearchService.name);
  private readonly INDEX_NAME = 'users';

  constructor(private readonly openSearchService: OpenSearchService) {}

  /**
   * Search users
   */
  async searchUsers(
    query: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<SearchResult<UserSearchDocument>> {
    const searchQuery = {
      multi_match: {
        query,
        fields: ['username^3', 'displayName^2', 'bio'],
        type: 'best_fields',
        analyzer: 'korean_analyzer',
      },
    };

    const page = options.page || 1;
    const limit = Math.min(options.limit || 10, 50);
    const from = (page - 1) * limit;

    return this.openSearchService.search<UserSearchDocument>(
      this.INDEX_NAME,
      searchQuery,
      {
        size: limit,
        from,
        sort: [{ followerCount: { order: 'desc' } }],
      },
    );
  }

  /**
   * Get user suggestions
   */
  async getUserSuggestions(prefix: string, limit: number = 5): Promise<string[]> {
    return this.openSearchService.suggest(this.INDEX_NAME, 'username', prefix, limit);
  }

  /**
   * Index user
   */
  async indexUser(user: UserSearchDocument): Promise<void> {
    await this.openSearchService.index(this.INDEX_NAME, user.id, user);
  }

  /**
   * Update user in index
   */
  async updateUser(userId: string, updates: Partial<UserSearchDocument>): Promise<void> {
    await this.openSearchService.update(this.INDEX_NAME, userId, updates);
  }

  /**
   * Delete user from index
   */
  async deleteUser(userId: string): Promise<void> {
    await this.openSearchService.delete(this.INDEX_NAME, userId);
  }
}
```

---

## 통합 구현 예제

### 1. Redis + OpenSearch 통합 Service

```typescript
// backend/src/posts/enhanced-posts.service.ts
import { Injectable } from '@nestjs/common';
import { PostsService } from './posts.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { PostSearchService } from '../search/post-search.service';

@Injectable()
export class EnhancedPostsService {
  constructor(
    private readonly postsService: PostsService,
    private readonly cacheService: RedisCacheService,
    private readonly searchService: PostSearchService,
  ) {}

  /**
   * Get post with caching and view count increment
   */
  async getPostWithCache(postId: string, userId?: string): Promise<any> {
    // Check cache first
    const cacheKey = RedisCacheService.keys.post(postId);
    let post = await this.cacheService.get(cacheKey);

    if (!post) {
      // Fetch from database
      post = await this.postsService.findOne(postId);
      
      // Cache for 10 minutes
      await this.cacheService.set(cacheKey, post, {
        ttl: RedisCacheService.ttl.standard,
      });
    }

    // Increment view count asynchronously
    this.incrementViewCount(postId, userId);

    return post;
  }

  /**
   * Search posts with caching
   */
  async searchPostsWithCache(query: string, options: any = {}): Promise<any> {
    // Generate cache key from search parameters
    const cacheKey = `search:${JSON.stringify({ query, ...options })}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Perform search
    const results = await this.searchService.searchPosts({
      query,
      ...options,
    });

    // Cache for 3 minutes
    await this.cacheService.set(cacheKey, results, {
      ttl: RedisCacheService.ttl.short,
    });

    return results;
  }

  /**
   * Get trending posts with multi-layer caching
   */
  async getTrendingPosts(period: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    const cacheKey = `trending:${period}`;
    
    // L1 Cache - Redis
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // L2 - OpenSearch
    const searchResults = await this.searchService.getTrendingPosts(period);
    
    // Get full post data for top results
    const postIds = searchResults.hits.map(hit => hit._id);
    const posts = await this.postsService.findByIds(postIds);

    // Cache in Redis
    await this.cacheService.set(cacheKey, posts, {
      ttl: period === 'day' ? RedisCacheService.ttl.hour : RedisCacheService.ttl.day,
    });

    return posts;
  }

  /**
   * Increment view count with rate limiting
   */
  private async incrementViewCount(postId: string, userId?: string): Promise<void> {
    const viewKey = `view:${postId}:${userId || 'anonymous'}`;
    
    // Check if already viewed recently (within 1 hour)
    const recentView = await this.cacheService.get(viewKey);
    if (recentView) {
      return; // Skip increment
    }

    // Mark as viewed
    await this.cacheService.set(viewKey, true, {
      ttl: RedisCacheService.ttl.hour,
    });

    // Increment view count in database
    await this.postsService.incrementViewCount(postId);

    // Update search index
    const statsKey = RedisCacheService.keys.postViews(postId);
    const currentViews = await this.cacheService.get<number>(statsKey) || 0;
    await this.cacheService.set(statsKey, currentViews + 1, {
      ttl: RedisCacheService.ttl.day,
    });
  }

  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(userId: string): Promise<any> {
    const cacheKey = `recommendations:${userId}`;
    
    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get user's reading history from Redis
    const historyKey = `history:${userId}`;
    const history = await this.cacheService.get<string[]>(historyKey) || [];

    // Get similar posts based on history
    const recommendations = [];
    for (const postId of history.slice(0, 3)) {
      const similar = await this.searchService.getSimilarPosts(postId, 3);
      recommendations.push(...similar.hits);
    }

    // Remove duplicates and limit
    const uniqueRecommendations = Array.from(
      new Map(recommendations.map(item => [item._id, item])).values()
    ).slice(0, 10);

    // Cache recommendations
    await this.cacheService.set(cacheKey, uniqueRecommendations, {
      ttl: RedisCacheService.ttl.hour,
    });

    return uniqueRecommendations;
  }
}
```

### 2. Application Module 설정

```typescript
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

// Cache & Search
import { RedisCacheModule } from './cache/redis-cache.module';
import { OpenSearchModule } from './search/opensearch.module';
import { CacheWarmerService } from './cache/cache-warmer.service';

// Business modules
import { PostsModule } from './posts/posts.module';
import { BlogsModule } from './blogs/blogs.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

// Configuration
import redisConfig from './config/redis.config';
import opensearchConfig from './config/opensearch.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [redisConfig, opensearchConfig],
    }),

    // Database
    TypeOrmModule.forRoot({
      // ... existing database config
    }),

    // Event system for search indexing
    EventEmitterModule.forRoot(),

    // Scheduling for cache warming
    ScheduleModule.forRoot(),

    // Cache & Search
    RedisCacheModule,
    OpenSearchModule,

    // Business modules
    AuthModule,
    UsersModule,
    BlogsModule,
    PostsModule,
  ],
  providers: [CacheWarmerService],
})
export class AppModule {}
```

### 3. Frontend 검색 구현

```typescript
// frontend/src/hooks/useSearch.ts
import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import debounce from 'lodash/debounce';

interface SearchOptions {
  type?: 'posts' | 'users' | 'tags';
  filters?: Record<string, any>;
}

export function useSearch(initialQuery: string = '', options: SearchOptions = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Main search query
  const searchResults = useQuery({
    queryKey: ['search', query, options],
    queryFn: async () => {
      if (!query || query.length < 2) return null;

      const params = new URLSearchParams({
        q: query,
        ...options.filters,
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/search/${options.type || 'posts'}?${params}`,
      );
      return response.json();
    },
    enabled: query.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });

  // Autocomplete suggestions
  const fetchSuggestions = useCallback(
    debounce(async (searchTerm: string) => {
      if (searchTerm.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/search/suggest?q=${searchTerm}&type=${options.type || 'posts'}`,
        );
        const data = await response.json();
        setSuggestions(data.suggestions);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      }
    }, 300),
    [options.type],
  );

  useEffect(() => {
    fetchSuggestions(query);
  }, [query, fetchSuggestions]);

  return {
    query,
    setQuery,
    searchResults: searchResults.data,
    isSearching: searchResults.isLoading,
    suggestions,
    clearSuggestions: () => setSuggestions([]),
  };
}
```

### 4. 모니터링 및 메트릭

```typescript
// backend/src/monitoring/cache-metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisCacheService } from '../cache/redis-cache.service';
import { PrometheusService } from './prometheus.service';

@Injectable()
export class CacheMetricsService {
  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly prometheusService: PrometheusService,
  ) {}

  /**
   * Collect cache metrics every 30 seconds
   */
  @Interval(30000)
  async collectMetrics() {
    const stats = this.cacheService.getStats();
    
    // Calculate hit ratio
    const total = stats.hits + stats.misses;
    const hitRatio = total > 0 ? stats.hits / total : 0;

    // Send to Prometheus
    this.prometheusService.gauge('cache_hit_ratio', hitRatio);
    this.prometheusService.counter('cache_hits_total', stats.hits);
    this.prometheusService.counter('cache_misses_total', stats.misses);
    this.prometheusService.counter('cache_sets_total', stats.sets);
    this.prometheusService.counter('cache_deletes_total', stats.deletes);
    this.prometheusService.counter('cache_errors_total', stats.errors);

    // Log if hit ratio is low
    if (hitRatio < 0.5 && total > 100) {
      console.warn(`Low cache hit ratio: ${(hitRatio * 100).toFixed(2)}%`);
    }

    // Reset stats after collection
    this.cacheService.resetStats();
  }
}
```

---

## 성능 최적화 팁

### Redis 최적화
1. **Pipeline 사용**: 여러 명령을 배치로 실행
2. **적절한 TTL 설정**: 메모리 관리와 freshness 균형
3. **Key 네이밍 규칙**: 일관된 패턴으로 관리 용이성 향상
4. **압축 사용**: 큰 객체는 압축하여 저장

### OpenSearch 최적화
1. **인덱스 샤드 수 조정**: 데이터 크기에 맞게 설정
2. **벌크 연산 사용**: 대량 데이터 처리 시 필수
3. **필드 매핑 최적화**: 불필요한 필드 인덱싱 방지
4. **캐시 활용**: 자주 사용되는 쿼리 결과 캐싱

### 통합 최적화
1. **비동기 처리**: 검색 인덱싱을 비동기로 처리
2. **이벤트 기반 업데이트**: 데이터 변경 시 자동 동기화
3. **레이어드 캐싱**: L1(Redis) + L2(Application) 캐시
4. **모니터링**: 성능 메트릭 수집 및 분석

---

## 트러블슈팅

### Redis 연결 문제
```typescript
// Retry strategy
retryStrategy: (times: number) => {
  if (times > 3) {
    console.error('Redis connection failed after 3 attempts');
    return null; // Stop retrying
  }
  return Math.min(times * 100, 3000); // Exponential backoff
}
```

### OpenSearch 인덱싱 실패
```typescript
// Graceful degradation
if (!this.openSearchService.isServiceConnected()) {
  console.warn('OpenSearch not available, falling back to database search');
  return this.databaseSearchFallback(query);
}
```

### 메모리 관리
```typescript
// Monitor Redis memory usage
const info = await redis.info('memory');
const usedMemory = parseFloat(info.used_memory_human);
if (usedMemory > maxMemory * 0.9) {
  // Trigger cache eviction or alert
}
```

---

이 구현 예제들은 Redis와 OpenSearch를 실제 프로젝트에 통합하는 방법을 보여줍니다. 각 서비스의 장점을 활용하여 성능과 사용자 경험을 크게 향상시킬 수 있습니다.