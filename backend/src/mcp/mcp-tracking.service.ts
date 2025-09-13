import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { McpUserLog } from './entities/mcp-user-log.entity';

export interface LogActivityParams {
  userId: string;
  apiKeyId: string;
  actionType: 'read' | 'write' | 'search';
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
    read: number;
    write: number;
    search: number;
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

  constructor(
    @InjectRepository(McpUserLog)
    private mcpUserLogRepository: Repository<McpUserLog>,
  ) {}

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
   * Get statistics for a specific period
   */
  async getStats(startDate: Date, endDate: Date): Promise<McpStats> {
    const logs = await this.mcpUserLogRepository.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
    });

    const uniqueUsers = new Set(logs.map(log => log.userId));
    
    const actionBreakdown = {
      read: logs.filter(log => log.actionType === 'read').length,
      write: logs.filter(log => log.actionType === 'write').length,
      search: logs.filter(log => log.actionType === 'search').length,
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

    return {
      totalActions: logs.length,
      uniqueUsers: uniqueUsers.size,
      actionBreakdown,
      clientBreakdown,
      popularResources,
    };
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
    });

    return {
      total: logs.length,
      actions: {
        read: logs.filter(log => log.actionType === 'read').length,
        write: logs.filter(log => log.actionType === 'write').length,
        search: logs.filter(log => log.actionType === 'search').length,
      },
      recentActivity: logs.slice(0, 10).map(log => ({
        actionType: log.actionType,
        resourceSlug: log.resourceSlug,
        timestamp: log.timestamp,
      })),
    };
  }

  /**
   * Get popular posts accessed via MCP
   */
  async getPopularPosts(days: number = 7, limit: number = 10): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // First get the popular posts with basic stats
    const popularPosts = await this.mcpUserLogRepository
      .createQueryBuilder('log')
      .select('log.resource_slug', 'postSlug')
      .addSelect('log.resource_id', 'postId')
      .addSelect('COUNT(*)', 'readCount')
      .addSelect('COUNT(DISTINCT log.user_id)', 'uniqueClients')
      .addSelect('MAX(log.timestamp)', 'lastAccessedAt')
      .where('log.resource_type = :type', { type: 'post' })
      .andWhere('log.resource_slug IS NOT NULL')
      .andWhere('log.timestamp > :startDate', { startDate })
      .groupBy('log.resource_slug')
      .addGroupBy('log.resource_id')
      .orderBy('"readCount"', 'DESC')
      .limit(limit)
      .getRawMany();

    // For each popular post, get the AI clients that accessed it
    const enrichedPosts = await Promise.all(
      popularPosts.map(async (post) => {
        // Get unique AI clients for this post
        const clientsResult = await this.mcpUserLogRepository
          .createQueryBuilder('log')
          .select('DISTINCT log.client_type', 'clientType')
          .where('log.resource_slug = :slug', { slug: post.postslug })
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
          readCount: parseInt(post.readcount) || 0,
          uniqueClients: parseInt(post.uniqueclients) || 0,
          aiClients: aiClients || [],
          lastAccessedAt: post.lastaccessedat,
        };
      })
    );

    return enrichedPosts;
  }

  /**
   * Get hourly activity pattern
   */
  async getHourlyActivity(days: number = 7): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.mcpUserLogRepository
      .createQueryBuilder('log')
      .select('EXTRACT(HOUR FROM log.timestamp)', 'hour')
      .addSelect('log.client_type', 'clientType')
      .addSelect('COUNT(*)', 'count')
      .where('log.timestamp > :startDate', { startDate })
      .groupBy('hour')
      .addGroupBy('log.client_type')
      .orderBy('hour', 'ASC')
      .getRawMany();

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
    });

    const clientUsage: { [key: string]: number } = {};
    logs.forEach(log => {
      const client = log.clientType || 'unknown';
      clientUsage[client] = (clientUsage[client] || 0) + 1;
    });

    return {
      totalActions: logs.length,
      actionBreakdown: {
        read: logs.filter(log => log.actionType === 'read').length,
        write: logs.filter(log => log.actionType === 'write').length,
        search: logs.filter(log => log.actionType === 'search').length,
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