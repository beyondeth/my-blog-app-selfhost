import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { McpUserLog } from './entities/mcp-user-log.entity';

export interface LogActivityParams {
  userId: string;
  apiKeyId: string;
  actionType: 'write';  // MCP는 오직 쓰기만 지원
  actionCategory?: string;
  resourceType?: string;
  resourceId?: string;
  resourceSlug?: string;
  clientType?: string;
  clientName?: string;
  clientVersion?: string;
  requestEndpoint?: string;
  requestMethod?: string;
  responseStatus?: number;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export interface McpStats {
  totalActions: number;
  uniqueUsers: number;
  actionBreakdown: {
    write: number;  // 쓰기만 추적
  };
  clientBreakdown: {
    [key: string]: number;
  };
  popularResources: Array<{
    resourceSlug: string;
    accessCount: number;
  }>;
}

@Injectable()
export class McpTrackingService {
  private readonly logger = new Logger(McpTrackingService.name);
  private statsCache = new Map<string, { data: any; expiry: number }>();
  private readonly cacheExpiry = 5 * 60 * 1000; // 5분 캐시

  constructor(
    @InjectRepository(McpUserLog)
    private mcpUserLogRepository: Repository<McpUserLog>,
  ) {
    // 10분마다 만료된 캐시 정리
    setInterval(() => this.cleanExpiredCache(), 10 * 60 * 1000);
  }

  private cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.statsCache.entries()) {
      if (value.expiry < now) {
        this.statsCache.delete(key);
      }
    }
  }

  /**
   * Log MCP activity
   */
  async logActivity(params: LogActivityParams): Promise<McpUserLog> {
    try {
      const startTime = Date.now();
      
      // Extract AI type from metadata if available
      let detectedClientType = params.clientType || 'unknown';
      
      // Try to detect from tags if present in metadata
      if (params.metadata?.tags && Array.isArray(params.metadata.tags)) {
        const aiTag = params.metadata.tags.find((tag: string) => 
          tag.startsWith('ai:')
        );
        if (aiTag) {
          detectedClientType = aiTag.replace('ai:', '');
        }
      }

      const log = this.mcpUserLogRepository.create({
        ...params,
        clientType: detectedClientType,
        responseTimeMs: params.responseTimeMs || (Date.now() - startTime),
      });

      const savedLog = await this.mcpUserLogRepository.save(log);
      
      this.logger.log(
        `MCP Activity logged: ${params.actionType} by ${detectedClientType} - ${params.resourceSlug || 'N/A'}`
      );
      
      return savedLog;
    } catch (error) {
      this.logger.error(`Failed to log MCP activity: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get statistics for a specific period with caching
   */
  async getStats(startDate: Date, endDate: Date): Promise<McpStats> {
    // 캐시 키 생성
    const cacheKey = `stats_${startDate.getTime()}_${endDate.getTime()}`;

    // 캐시 확인
    const cached = this.statsCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    const logs = await this.mcpUserLogRepository.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
      take: 10000, // 최대 10000개로 제한
      order: {
        timestamp: 'DESC',
      },
    });

    const uniqueUsers = new Set(logs.map(log => log.userId));

    const actionBreakdown = {
      write: logs.filter(log => log.actionType === 'write').length,  // 쓰기만 카운트
    };

    const clientBreakdown: { [key: string]: number } = {};
    logs.forEach(log => {
      const client = log.clientType || 'unknown';
      clientBreakdown[client] = (clientBreakdown[client] || 0) + 1;
    });

    // Get popular resources
    const resourceCounts = new Map<string, number>();
    logs.forEach(log => {
      if (log.resourceSlug) {
        resourceCounts.set(
          log.resourceSlug,
          (resourceCounts.get(log.resourceSlug) || 0) + 1
        );
      }
    });

    const popularResources = Array.from(resourceCounts.entries())
      .map(([resourceSlug, accessCount]) => ({ resourceSlug, accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    const result = {
      totalActions: logs.length,
      uniqueUsers: uniqueUsers.size,
      actionBreakdown,
      clientBreakdown,
      popularResources,
    };

    // 결과 캐싱
    this.statsCache.set(cacheKey, {
      data: result,
      expiry: Date.now() + this.cacheExpiry,
    });

    return result;
  }

  /**
   * Get activity by client type
   */
  async getStatsByClient(
    clientType: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const logs = await this.mcpUserLogRepository.find({
      where: {
        clientType,
        timestamp: Between(startDate, endDate),
      },
      order: {
        timestamp: 'DESC',
      },
      take: 1000, // 최대 1000개로 제한
    });

    return {
      total: logs.length,
      actions: {
        write: logs.filter(log => log.actionType === 'write').length,  // 쓰기만 카운트
      },
      recentActivity: logs.slice(0, 10).map(log => ({
        actionType: log.actionType,
        resourceSlug: log.resourceSlug,
        timestamp: log.timestamp,
      })),
    };
  }

  /**
   * Get recently created posts via MCP (쓰기 전용 - 최근 생성된 포스트)
   */
  async getPopularPosts(days: number = 7, limit: number = 10): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // MCP는 쓰기만 지원하므로 최근 생성된 포스트를 조회
    const recentPosts = await this.mcpUserLogRepository
      .createQueryBuilder('log')
      .select('log.resource_slug', 'postSlug')
      .addSelect('log.resource_id', 'postId')
      .addSelect('COUNT(*)', 'createdCount')  // 생성 횟수
      .addSelect('COUNT(DISTINCT log.client_type)', 'uniqueClients')
      .addSelect('MAX(log.timestamp)', 'lastCreatedAt')
      .where('log.resource_type = :type', { type: 'post' })
      .andWhere('log.action_type = :action', { action: 'write' })  // 쓰기 액션만
      .andWhere('log.resource_slug IS NOT NULL')
      .andWhere('log.timestamp > :startDate', { startDate })
      .groupBy('log.resource_slug')
      .addGroupBy('log.resource_id')
      .orderBy('"lastCreatedAt"', 'DESC')  // 최근 생성 순
      .limit(Math.min(limit, 20)) // 최대 20개로 제한
      .getRawMany();

    // For each post, get the AI clients that created it
    const enrichedPosts = await Promise.all(
      recentPosts.map(async (post) => {
        // Get unique AI clients for this post
        const clientsResult = await this.mcpUserLogRepository
          .createQueryBuilder('log')
          .select('DISTINCT log.client_type', 'clientType')
          .where('log.resource_slug = :slug', { slug: post.postslug })
          .andWhere('log.action_type = :action', { action: 'write' })
          .andWhere('log.timestamp > :startDate', { startDate })
          .getRawMany();

        const aiClients = clientsResult
          .map(c => c.clienttype)
          .filter(c => c); // Remove null values

        // Extract blog slug from the post slug (format: blog-slug/post-slug)
        const slugParts = post.postslug?.split('/') || [];
        const blogSlug = slugParts.length > 1 ? slugParts[0] : '';

        return {
          postId: post.postid || '',
          postSlug: post.postslug,
          postTitle: post.postslug || 'Untitled', // Use slug as title fallback
          blogSlug: blogSlug,
          createdCount: parseInt(post.createdcount) || 0,  // 생성 횟수로 변경
          uniqueClients: parseInt(post.uniqueclients) || 0,
          aiClients: aiClients || [],
          lastCreatedAt: post.lastcreatedat,  // 마지막 생성 시간
        };
      })
    );

    return enrichedPosts;
  }

  /**
   * Get hourly activity pattern with caching
   */
  async getHourlyActivity(days: number = 7): Promise<any[]> {
    // 캐시 키 생성
    const cacheKey = `hourly_${days}_${Math.floor(Date.now() / (15 * 60 * 1000))}`; // 15분 단위로 캐싱

    // 캐시 확인
    const cached = this.statsCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    // Get raw hourly data grouped by hour and client type
    const rawData = await this.mcpUserLogRepository
      .createQueryBuilder('log')
      .select('DATE_TRUNC(\'hour\', log.timestamp)', 'hour')
      .addSelect('log.client_type', 'clientType')
      .addSelect('COUNT(*)', 'count')
      .where('log.timestamp > :startDate', { startDate })
      .andWhere('log.timestamp <= :endDate', { endDate })
      .groupBy('hour')
      .addGroupBy('log.client_type')
      .orderBy('hour', 'ASC')
      .getRawMany();

    // Transform raw data into the expected format
    const hourlyMap = new Map<string, any>();

    // Initialize all hours in the last 24 hours with zero counts
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now);
      hourDate.setHours(now.getHours() - i, 0, 0, 0);
      const hourKey = hourDate.toISOString();

      hourlyMap.set(hourKey, {
        hour: hourKey,
        activities: 0,
        byClient: {
          claude: 0,
          chatgpt: 0,
          gemini: 0,
          qwen: 0,
          unknown: 0,
        },
      });
    }

    // Fill in actual data from database
    rawData.forEach(row => {
      if (row.hour) {
        const hourDate = new Date(row.hour);
        hourDate.setMinutes(0, 0, 0);
        const hourKey = hourDate.toISOString();

        if (!hourlyMap.has(hourKey)) {
          hourlyMap.set(hourKey, {
            hour: hourKey,
            activities: 0,
            byClient: {
              claude: 0,
              chatgpt: 0,
              gemini: 0,
              qwen: 0,
              unknown: 0,
            },
          });
        }

        const hourData = hourlyMap.get(hourKey);
        const clientType = row.clienttype || row.clientType || 'unknown';
        const count = parseInt(row.count) || 0;

        hourData.activities += count;
        if (hourData.byClient[clientType] !== undefined) {
          hourData.byClient[clientType] += count;
        } else {
          hourData.byClient.unknown += count;
        }
      }
    });

    // Convert to array and sort by hour
    const result = Array.from(hourlyMap.values())
      .sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime());

    // 결과 캐싱
    this.statsCache.set(cacheKey, {
      data: result,
      expiry: Date.now() + this.cacheExpiry,
    });

    return result;
  }

  /**
   * Get user activity summary
   */
  async getUserActivity(userId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.mcpUserLogRepository.find({
      where: {
        userId,
        timestamp: Between(startDate, new Date()),
      },
      order: {
        timestamp: 'DESC',
      },
      take: 500, // 최대 500개로 제한
    });

    const clientUsage: { [key: string]: number } = {};
    logs.forEach(log => {
      const client = log.clientType || 'unknown';
      clientUsage[client] = (clientUsage[client] || 0) + 1;
    });

    return {
      totalActions: logs.length,
      actionBreakdown: {
        write: logs.filter(log => log.actionType === 'write').length,  // 쓰기만 카운트
      },
      clientUsage,
      recentActivity: logs.slice(0, 20),
    };
  }

  /**
   * Clean old logs (retention policy)
   */
  async cleanOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.mcpUserLogRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`Cleaned ${result.affected} old MCP logs`);
    return result.affected || 0;
  }
}