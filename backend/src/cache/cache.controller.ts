import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CacheService } from './cache.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('cache')
@Controller('cache')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

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
      const cacheManager = (this.cacheService as any).cacheManager;
      const store = cacheManager?.store || cacheManager;
      const isRedis = store && (store.client || store.name === 'redis');
      
      if (isRedis) {
        // Redis ping 테스트
        await new Promise((resolve, reject) => {
          if (store.client && store.client.ping) {
            store.client.ping((err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          } else {
            resolve('no ping method');
          }
        });
        
        return {
          connected: true,
          type: 'redis',
          message: 'Redis connection successful'
        };
      } else {
        return {
          connected: true,
          type: 'memory',
          message: 'Using memory cache (Redis not configured or not available)'
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
}