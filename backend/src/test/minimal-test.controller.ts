import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Minimal Test')
@Controller('api/v1/minimal-test')
export class MinimalTestController {

  @Get('health')
  @ApiOperation({ summary: '서버 상태 확인' })
  @ApiResponse({ status: 200, description: '서버가 정상 작동 중' })
  async health() {
    return {
      status: 'ok',
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('blog-info')
  @ApiOperation({ summary: '블로그 정보 테스트 (의존성 없음)' })
  @ApiResponse({ status: 200, description: '블로그 정보 반환' })
  async blogInfo() {
    // 이 엔드포인트는 데이터베이스 의존성 없이 테스트용 데이터를 반환
    return {
      message: 'Blog info test endpoint',
      testBlog: {
        identifier: 'luticek-seqn',
        expectedId: 'a4f1923f-d162-41fe-9e08-876222f60e91',
        title: 'Test Blog',
        description: '이것은 블로그 통계 흐름 테스트를 위한 가상 데이터입니다',
      },
      services: {
        blogResolver: 'BlogResolverService should resolve identifier to blogId',
        blogStats: 'BlogStatsService should calculate statistics',
        cache: 'UnifiedRedisService should handle caching',
        events: 'BlogEventEmitter should handle events',
      },
      instructions: [
        '1. BlogResolverService: 블로그 식별자(alias/slug)를 blogId로 변환',
        '2. BlogStatsService: 블로그 통계 계산 (카테고리, 게시물 수, 활동 등)',
        '3. UnifiedRedisService: 캐시 관리 (TTL, 삭제 등)',
        '4. BlogEventEmitter: 이벤트 발생 및 처리',
      ],
    };
  }

  @Post('event-simulation')
  @ApiOperation({ summary: '이벤트 시뮬레이션' })
  @ApiResponse({ status: 200, description: '이벤트 처리 시뮬레이션' })
  async simulateEvent(@Body() eventData: { eventType: string; data: any }) {
    const { eventType, data } = eventData;

    // 이 엔드포인트는 실제 이벤트를 발생시키지 않고 시뮬레이션만 수행
    const simulation = {
      timestamp: new Date().toISOString(),
      eventType,
      data,
      processing: {
        step1: `Event ${eventType} received`,
        step2: 'Cache invalidation triggered',
        step3: 'Statistics recalculated',
        step4: 'Listeners notified',
      },
      expectedServices: [
        'BlogEventEmitter.emit(eventType, data)',
        'BlogStatsService.invalidateCache(blogId)',
        'BlogResolverService.clearCache(identifier)',
        'UnifiedRedisService.delete(cacheKeys)',
      ],
    };

    return {
      message: 'Event simulation completed',
      simulation,
      note: 'This is a simulation only. No actual events were emitted.',
    };
  }

  @Get('dependency-check')
  @ApiOperation({ summary: '의존성 상태 확인' })
  @ApiResponse({ status: 200, description: '서비스 의존성 상태' })
  async dependencyCheck() {
    // 의존성 상태를 확인하지만 실제 주입 없이 상태만 반환
    const dependencies = {
      BlogResolverService: {
        status: '✅ Should be available via CommonModule',
        imports: ['Blog', 'OldAlias', 'UnifiedRedisService'],
        exports: ['BlogResolverService'],
      },
      BlogStatsService: {
        status: '✅ Should be available via PostsModule',
        imports: ['Post', 'PostStats', 'Blog', 'UnifiedRedisService'],
        methods: ['getBlogCategoriesWithCount', 'getBlogPostCounts', 'getBlogActivityStats'],
      },
      UnifiedRedisService: {
        status: '✅ Should be available via CommonModule',
        features: ['get', 'set', 'del', 'deleteMany', 'deleteNamespace'],
      },
      BlogEventEmitter: {
        status: '✅ Should be available via EventsModule',
        events: ['blog.stats.updated', 'blog.cache.invalidate'],
      },
    };

    return {
      message: 'Dependency status check',
      dependencies,
      moduleStructure: {
        CommonModule: ['BlogResolverService', 'UnifiedRedisService'],
        EventsModule: ['BlogEventEmitter'],
        PostsModule: ['BlogStatsService', 'BlogStatsHandler'],
      },
      note: 'Actual dependency injection requires server to start successfully',
    };
  }
}