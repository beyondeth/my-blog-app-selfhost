import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Body,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RedisMonitoringService } from './redis-monitoring.service';

@ApiTags('redis')
@Controller('redis')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class RedisController {
  constructor(
    private readonly redisMonitoringService: RedisMonitoringService,
  ) {}

  /**
   * Get BullMQ queue statistics
   */
  @Get('queues/status')
  @ApiOperation({ summary: 'Get BullMQ queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics',
    schema: {
      type: 'object',
      properties: {
        waiting: { type: 'number', description: 'Jobs waiting to be processed' },
        active: { type: 'number', description: 'Jobs currently being processed' },
        completed: { type: 'number', description: 'Jobs that completed successfully' },
        failed: { type: 'number', description: 'Jobs that failed' },
        delayed: { type: 'number', description: 'Jobs that are delayed' },
        paused: { type: 'number', description: 'Jobs that are paused' },
      },
    },
  })
  async getQueueStatus() {
    return this.redisMonitoringService.getQueueStats();
  }

  /**
   * Get Redis server information
   */
  @Get('info')
  @ApiOperation({ summary: 'Get Redis server information and memory usage' })
  @ApiResponse({
    status: 200,
    description: 'Redis server information',
    schema: {
      type: 'object',
      properties: {
        usedMemory: { type: 'string', description: 'Memory usage in bytes' },
        usedMemoryHuman: { type: 'string', description: 'Human readable memory' },
        usedMemoryPeak: { type: 'string', description: 'Peak memory usage' },
        usedMemoryPeakHuman: { type: 'string', description: 'Human readable peak memory' },
        memoryFragmentation: { type: 'number', description: 'Memory fragmentation ratio' },
        connectedClients: { type: 'number', description: 'Number of connected clients' },
        totalKeys: { type: 'number', description: 'Total number of keys' },
        uptime: { type: 'number', description: 'Server uptime in seconds' },
      },
    },
  })
  async getRedisInfo() {
    return this.redisMonitoringService.getRedisInfo();
  }

  /**
   * Get key distribution by pattern
   */
  @Get('keys/patterns')
  @ApiOperation({ summary: 'Get key distribution by pattern' })
  @ApiResponse({
    status: 200,
    description: 'Key pattern distribution',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Key pattern' },
          count: { type: 'number', description: 'Number of keys' },
          percentage: { type: 'number', description: 'Percentage of total keys' },
        },
      },
    },
  })
  async getKeyPatterns() {
    return this.redisMonitoringService.getKeyPatterns();
  }

  /**
   * Get distributed locks status
   */
  @Get('locks')
  @ApiOperation({ summary: 'Get distributed locks status' })
  @ApiResponse({
    status: 200,
    description: 'Active locks',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          resource: { type: 'string', description: 'Locked resource name' },
          ttl: { type: 'number', description: 'Time to live in seconds' },
          locked: { type: 'boolean', description: 'Lock status' },
        },
      },
    },
  })
  async getLocks() {
    return this.redisMonitoringService.getLockStatus();
  }

  /**
   * Get rate limiting status
   */
  @Get('rate-limits')
  @ApiOperation({ summary: 'Get rate limiting status' })
  @ApiResponse({
    status: 200,
    description: 'Rate limiting information',
    schema: {
      type: 'object',
      properties: {
        blockedIPs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ip: { type: 'string', description: 'Blocked IP address' },
              apiKeyId: { type: 'string', description: 'API key ID' },
              blockedUntil: { type: 'string', format: 'date-time' },
              remainingTime: { type: 'number', description: 'Remaining block time in seconds' },
            },
          },
        },
        apiKeyUsage: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              apiKeyId: { type: 'string', description: 'API key ID' },
              minuteCount: { type: 'number', description: 'Requests in last minute' },
              hourCount: { type: 'number', description: 'Requests in last hour' },
              dayCount: { type: 'number', description: 'Requests in last day' },
            },
          },
        },
      },
    },
  })
  async getRateLimits() {
    return this.redisMonitoringService.getRateLimitStatus();
  }

  /**
   * Clear keys by pattern (DANGEROUS)
   */
  @Delete('keys/pattern/:pattern')
  @ApiOperation({ summary: 'Clear keys by pattern (DANGEROUS)' })
  @ApiParam({ name: 'pattern', description: 'Key pattern to delete' })
  @ApiResponse({
    status: 200,
    description: 'Number of keys deleted',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'number', description: 'Number of keys deleted' },
        message: { type: 'string' },
      },
    },
  })
  async clearPattern(@Param('pattern') pattern: string) {
    // Safety check - prevent deleting all keys
    if (pattern === '*' || pattern === '**') {
      throw new HttpException(
        'Cannot delete all keys. Please specify a more specific pattern.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const deleted = await this.redisMonitoringService.clearPattern(pattern);
    return {
      deleted,
      message: `Deleted ${deleted} keys matching pattern: ${pattern}`,
    };
  }

  /**
   * Unblock an IP address
   */
  @Post('unblock-ip')
  @ApiOperation({ summary: 'Unblock an IP address' })
  @ApiResponse({
    status: 200,
    description: 'IP unblock result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async unblockIP(
    @Body() data: { ip: string; apiKeyId: string },
  ) {
    const success = await this.redisMonitoringService.unblockIP(data.ip, data.apiKeyId);
    return {
      success,
      message: success
        ? `Successfully unblocked IP: ${data.ip}`
        : `Failed to unblock IP: ${data.ip}`,
    };
  }

  /**
   * Force release a lock (DANGEROUS)
   */
  @Delete('locks/:resource')
  @ApiOperation({ summary: 'Force release a lock (DANGEROUS)' })
  @ApiParam({ name: 'resource', description: 'Lock resource name' })
  @ApiResponse({
    status: 200,
    description: 'Lock release result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async releaseLock(@Param('resource') resource: string) {
    const success = await this.redisMonitoringService.releaseLock(resource);
    return {
      success,
      message: success
        ? `Successfully released lock: ${resource}`
        : `Failed to release lock: ${resource} (may not exist)`,
    };
  }
}