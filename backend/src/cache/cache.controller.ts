import { Controller, Get, Delete, Post, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CacheService } from './cache.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';
import { UnifiedRedisService } from '../redis/unified-redis.service';

@ApiTags('cache')
@Controller('cache')
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly unifiedRedisService: UnifiedRedisService,
  ) {}

  /**
   * 캐시 상태 확인 (헬스체크)
   */
  @Get('health')
  @Public()
  @ApiOperation({ summary: '캐시 시스템 헬스체크' })
  @ApiResponse({ 
    status: 200, 
    description: '캐시 시스템 상태',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        type: { type: 'string', description: 'redis or memory' },
        message: { type: 'string' },
        testResult: { type: 'object' }
      }
    }
  })
  async healthCheck() {
    try {
      // 테스트 키로 캐시 동작 확인
      const testKey = 'health:check:test';
      const testValue = { timestamp: new Date().toISOString() };
      
      // SET 테스트
      await this.cacheService.set(testKey, testValue, 10);
      
      // GET 테스트
      const retrieved = await this.cacheService.get(testKey);
      
      // DELETE 테스트
      await this.cacheService.del(testKey);
      
      // 캐시 타입 확인
      const cacheManager = (this.cacheService as any).cacheManager;
      const store = cacheManager?.store || cacheManager;
      const isRedis = store && (store.client || store.name === 'redis');
      
      return {
        status: 'healthy',
        type: isRedis ? 'redis' : 'memory',
        message: `Cache system is working properly with ${isRedis ? 'Redis' : 'memory'} store`,
        testResult: {
          set: 'success',
          get: retrieved ? 'success' : 'failed',
          delete: 'success',
          testedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        type: 'unknown',
        message: `Cache system error: ${error.message}`,
        testResult: {
          error: error.message,
          testedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 캐시 통계 조회 (관리자 전용)
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '캐시 통계 조회' })
  @ApiBearerAuth()
  @ApiResponse({ 
    status: 200, 
    description: '캐시 통계 정보',
    schema: {
      type: 'object',
      properties: {
        totalKeys: { type: 'number' },
        patterns: { type: 'object' }
      }
    }
  })
  async getStats() {
    return this.cacheService.getStats();
  }

  /**
   * 메모리 사용량 조회 (관리자 전용)
   */
  @Get('memory-usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '메모리 캐시 사용량 조회' })
  @ApiBearerAuth()
  @ApiResponse({ 
    status: 200, 
    description: '메모리 사용량 정보',
    schema: {
      type: 'object',
      properties: {
        itemCount: { type: 'number', description: '캐시된 아이템 수' },
        estimatedSize: { type: 'string', description: '예상 사용 메모리' },
        maxItems: { type: 'number', description: '최대 아이템 수' },
        maxSize: { type: 'string', description: '최대 메모리 크기' },
        usagePercent: { type: 'number', description: '사용률 (%)' },
        cacheType: { type: 'string', enum: ['redis', 'memory', 'unknown'] }
      }
    }
  })
  async getMemoryUsage() {
    return this.cacheService.getMemoryUsage();
  }

  /**
   * 특정 패턴의 캐시 삭제 (관리자 전용)
   */
  @Delete('pattern/:pattern')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '패턴별 캐시 삭제' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '캐시 삭제 완료' })
  async deletePattern(@Param('pattern') pattern: string) {
    await this.cacheService.deletePattern(pattern);
    return { 
      message: `Cache pattern '${pattern}' deleted`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 전체 캐시 초기화 (관리자 전용)
   */
  @Delete('reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '전체 캐시 초기화' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '캐시 초기화 완료' })
  async resetCache() {
    await this.cacheService.reset();
    return { 
      message: 'All cache cleared',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Redis 연결 테스트 (개발용)
   */
  @Get('test-connection')
  @Public()
  @ApiOperation({ summary: 'Redis 연결 테스트' })
  @ApiResponse({
    status: 200,
    description: 'Redis 연결 상태',
    schema: {
      type: 'object',
      properties: {
        connected: { type: 'boolean' },
        type: { type: 'string' },
        message: { type: 'string' }
      }
    }
  })
  async testConnection() {
    try {
      // UnifiedRedisService를 통해 Redis 연결 확인
      const testKey = 'test:connection:' + Date.now();
      await this.unifiedRedisService.setCache('cache', testKey, 'test', 1);
      const result = await this.unifiedRedisService.getCache('cache', testKey);
      await this.unifiedRedisService.deleteCache('cache', testKey);

      if (result === 'test') {
        return {
          connected: true,
          type: 'redis',
          message: 'Redis connection successful'
        };
      } else {
        return {
          connected: false,
          type: 'redis',
          message: 'Redis connection test failed'
        };
      }
    } catch (error) {
      return {
        connected: false,
        type: 'error',
        message: `Connection test failed: ${error.message}`
      };
    }
  }

  /**
   * 네임스페이스별 캐시 삭제 (관리자 전용)
   */
  @Delete('namespace/:namespace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '네임스페이스별 캐시 삭제' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '네임스페이스 캐시 삭제 완료' })
  async deleteNamespace(@Param('namespace') namespace: string) {
    await this.unifiedRedisService.clearNamespace(namespace);
    return {
      message: `Namespace '${namespace}' cache cleared`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Redis 서버 정보 조회 (관리자 전용)
   */
  @Get('redis-info')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Redis 서버 정보 조회' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Redis 서버 정보',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string' },
        uptime: { type: 'number' },
        connectedClients: { type: 'number' },
        memoryUsage: { type: 'string' },
        keyCount: { type: 'number' }
      }
    }
  })
  @ApiQuery({ name: 'section', required: false, description: 'Redis INFO 섹션 (server, memory, stats 등)' })
  async getRedisInfo(@Query('section') section?: string) {
    try {
      // Redis 서버 정보 조회
      const info = await this.unifiedRedisService.getRedisInfo(section || 'default');
      const stats = await this.unifiedRedisService.getCacheStatistics();

      return {
        ...info,
        totalKeys: stats.totalKeys,
        memoryUsage: stats.memoryUsage,
        namespaces: stats.patterns,
      };
    } catch (error) {
      return {
        error: `Failed to get Redis info: ${error.message}`
      };
    }
  }

  /**
   * Redis 통계 리셋 (관리자 전용)
   * - keyspace_hits, keyspace_misses 등 누적 통계 초기화
   */
  @Post('reset-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Redis 통계 리셋 (누적 카운터 초기화)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: '통계 리셋 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        timestamp: { type: 'string' }
      }
    }
  })
  async resetStats() {
    const result = await this.unifiedRedisService.resetStats();

    return {
      success: result,
      message: result
        ? 'Redis 통계가 성공적으로 리셋되었습니다'
        : 'Redis 통계 리셋에 실패했습니다',
      timestamp: new Date().toISOString()
    };
  }
}