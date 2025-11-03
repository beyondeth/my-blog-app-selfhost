/**
 * 블로그 통계 기능 테스트용 컨트롤러
 *
 * UnifiedRedisService 마이그레이션 후 플로우 확인
 */

import { Controller, Get, Post, Param, HttpException, HttpStatus } from '@nestjs/common';
import { BlogStatsService } from '../common/services/blog-stats.service';
import { BlogResolverService } from '../common/services/blog-resolver.service';
import { BlogEventEmitter } from '../common/events/blog-event-emitter.service';
import { UnifiedRedisService } from '../redis/unified-redis.service';

@Controller('test/blog-stats')
export class TestBlogStatsController {
  constructor(
    private readonly blogStatsService: BlogStatsService,
    private readonly blogResolverService: BlogResolverService,
    private readonly blogEventEmitter: BlogEventEmitter,
    private readonly unifiedRedisService: UnifiedRedisService,
  ) {}

  /**
   * 테스트용: 블로그 통계 전체 조회
   */
  @Get(':identifier')
  async getBlogStats(@Param('identifier') identifier: string) {
    try {
      // 1. 블로그 식별자 해결
      const blog = await this.blogResolverService.resolveBlogByIdentifier(identifier);
      if (!blog) {
        throw new HttpException('Blog not found', HttpStatus.NOT_FOUND);
      }

      // 2. 통계 조회
      const [
        categories,
        postCount,
        activityStats,
        popularPosts,
      ] = await Promise.all([
        this.blogStatsService.getBlogCategoriesWithCount(identifier),
        this.blogStatsService.getBlogPostCount(blog.id),
        this.blogStatsService.getBlogActivityStats(blog.id),
        this.blogStatsService.getBlogPopularPosts(blog.id, 5),
      ]);

      return {
        blog: {
          id: blog.id,
          identifier,
        },
        stats: {
          categories,
          postCount,
          activityStats,
          popularPosts,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          error: 'Failed to get blog stats',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 테스트용: 캐시 상태 확인
   */
  @Get(':identifier/cache')
  async getCacheStatus(@Param('identifier') identifier: string) {
    try {
      const cacheKeys = [
        `blog:resolver:${identifier}`,
        `blog:resolver:alias:${identifier}`,
        `blog:stats:categories:${identifier}`,
      ];

      const cacheResults = await Promise.all(
        cacheKeys.map(async (key) => ({
          key,
          exists: !!(await this.unifiedRedisService.get(key)),
        })),
      );

      return {
        identifier,
        cache: cacheResults,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          error: 'Failed to check cache status',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 테스트용: 캐시 무효화
   */
  @Post(':identifier/invalidate-cache')
  async invalidateCache(@Param('identifier') identifier: string) {
    try {
      const blog = await this.blogResolverService.resolveBlogByIdentifier(identifier);
      if (!blog) {
        throw new HttpException('Blog not found', HttpStatus.NOT_FOUND);
      }

      await this.blogStatsService.invalidateBlogStatsCache(blog.id, identifier);

      return {
        success: true,
        message: 'Cache invalidated',
        identifier,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          error: 'Failed to invalidate cache',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 테스트용: 이벤트 발행
   */
  @Post(':identifier/event/:eventType')
  async emitEvent(
    @Param('identifier') identifier: string,
    @Param('eventType') eventType: string,
  ) {
    try {
      const blog = await this.blogResolverService.resolveBlogByIdentifier(identifier);
      if (!blog) {
        throw new HttpException('Blog not found', HttpStatus.NOT_FOUND);
      }

      // 가짜 포스트 ID
      const postId = `test-post-${Date.now()}`;

      switch (eventType) {
        case 'post-created':
          await this.blogEventEmitter.emitBlogPostCreated({
            blogId: blog.id,
            postId,
            userId: 'test-user',
            title: 'Test Post',
            category: 'test',
            createdAt: new Date(),
          });
          break;
        case 'post-updated':
          await this.blogEventEmitter.emitBlogPostUpdated({
            blogId: blog.id,
            postId,
            userId: 'test-user',
            title: 'Test Post Updated',
            category: 'test',
            updatedAt: new Date(),
          });
          break;
        case 'post-deleted':
          await this.blogEventEmitter.emitBlogPostDeleted({
            blogId: blog.id,
            postId,
            userId: 'test-user',
            isDeleted: true,
            updatedAt: new Date(),
          });
          break;
        default:
          throw new HttpException('Invalid event type', HttpStatus.BAD_REQUEST);
      }

      return {
        success: true,
        message: `${eventType} event emitted`,
        blogId: blog.id,
        postId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          error: 'Failed to emit event',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 테스트용: UnifiedRedisService 기능 테스트
   */
  @Post('redis/test')
  async testRedisOperations() {
    try {
      const testKey = `test:unified-redis:${Date.now()}`;
      const testValue = 'test-value';

      // 1. setWithExpiry 테스트
      await this.unifiedRedisService.setWithExpiry(testKey, testValue, 60);

      // 2. get 테스트
      const retrievedValue = await this.unifiedRedisService.get(testKey);

      // 3. deleteMany 테스트
      const keysToDelete = [
        `${testKey}-1`,
        `${testKey}-2`,
        `${testKey}-3`,
      ];

      // 먼저 키들을 설정
      await Promise.all(
        keysToDelete.map(key =>
          this.unifiedRedisService.setWithExpiry(key, 'value', 60)
        ),
      );

      const deletedCount = await this.unifiedRedisService.deleteMany(keysToDelete);

      // 4. deleteNamespace 테스트
      const namespace = 'test:namespace:';
      const namespaceKeys = [
        `${namespace}key1`,
        `${namespace}key2`,
      ];

      await Promise.all(
        namespaceKeys.map(key =>
          this.unifiedRedisService.setWithExpiry(key, 'value', 60)
        ),
      );

      const namespaceDeletedCount = await this.unifiedRedisService.deleteNamespace(namespace);

      // 5. 정리
      await this.unifiedRedisService.del(testKey);

      return {
        success: true,
        tests: {
          setWithExpiry: {
            key: testKey,
            value: testValue,
            retrieved: retrievedValue,
            passed: retrievedValue === testValue,
          },
          deleteMany: {
            keys: keysToDelete,
            deletedCount,
            passed: deletedCount === keysToDelete.length,
          },
          deleteNamespace: {
            namespace,
            deletedCount: namespaceDeletedCount,
            passed: namespaceDeletedCount > 0,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          error: 'Redis test failed',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}