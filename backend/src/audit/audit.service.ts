import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { DateUtils } from '../common/utils/date.utils';

export interface AuditContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditLogEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create an audit log entry
   */
  async log(
    entry: AuditLogEntry,
    context: AuditContext,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...entry,
      performedById: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
    });

    return await this.auditLogRepository.save(auditLog);
  }

  /**
   * Log user action
   */
  async logUserAction(
    action: AuditAction,
    userId: string,
    changes: { previous?: any; new?: any },
    context: AuditContext,
  ) {
    return await this.log(
      {
        action,
        entityType: 'user',
        entityId: userId,
        previousData: changes.previous,
        newData: changes.new,
      },
      context,
    );
  }

  /**
   * Log post action
   */
  async logPostAction(
    action: AuditAction,
    postId: string,
    changes: { previous?: any; new?: any },
    context: AuditContext,
  ) {
    return await this.log(
      {
        action,
        entityType: 'post',
        entityId: postId,
        previousData: changes.previous,
        newData: changes.new,
      },
      context,
    );
  }

  /**
   * Log report action
   */
  async logReportAction(
    action: AuditAction,
    reportId: string,
    changes: { previous?: any; new?: any },
    context: AuditContext,
  ) {
    return await this.log(
      {
        action,
        entityType: 'report',
        entityId: reportId,
        previousData: changes.previous,
        newData: changes.new,
      },
      context,
    );
  }

  /**
   * Log admin access
   */
  async logAdminAccess(
    action: AuditAction,
    metadata: Record<string, any>,
    context: AuditContext,
  ) {
    return await this.log(
      {
        action,
        entityType: 'admin',
        metadata,
      },
      context,
    );
  }

  /**
   * Get audit logs with filters
   */
  async findAll(
    filters: {
      action?: AuditAction;
      entityType?: string;
      entityId?: string;
      performedById?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page = 1,
    limit = 50,
  ) {
    const where: FindOptionsWhere<AuditLog> = {};

    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.performedById) where.performedById = filters.performedById;
    
    if (filters.startDate && filters.endDate) {
      where.createdAt = Between(filters.startDate, filters.endDate);
    }

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where,
      relations: ['performedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    page = 1,
    limit = 50,
  ) {
    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { entityType, entityId },
      relations: ['performedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit logs by user
   */
  async findByUser(
    userId: string,
    page = 1,
    limit = 50,
  ) {
    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { performedById: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get recent admin activity
   */
  async getRecentAdminActivity(limit = 20) {
    const logs = await this.auditLogRepository.find({
      relations: ['performedBy'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return logs;
  }

  /**
   * Get audit statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date) {
    const where: FindOptionsWhere<AuditLog> = {};
    
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const [
      totalLogs,
      logsByAction,
      logsByEntityType,
      topUsers,
    ] = await Promise.all([
      this.auditLogRepository.count({ where }),
      this.getLogsByAction(where),
      this.getLogsByEntityType(where),
      this.getTopUsers(where),
    ]);

    return {
      totalLogs,
      logsByAction,
      logsByEntityType,
      topUsers,
    };
  }

  /**
   * Clean up old audit logs (retention policy)
   */
  async cleanupOldLogs(retentionDays = 90) {
    // DateUtils를 사용한 일수 기반 계산
    const cutoffDate = DateUtils.fromNowSubtractDays(retentionDays);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return { deletedCount: result.affected };
  }

  // Private helper methods

  private async getLogsByAction(where: FindOptionsWhere<AuditLog>) {
    const result = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('log.action')
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.action] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getLogsByEntityType(where: FindOptionsWhere<AuditLog>) {
    const result = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.entityType', 'entityType')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('log.entityType')
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.entityType] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getTopUsers(where: FindOptionsWhere<AuditLog>) {
    const result = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.performedById', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('log.performedById')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return result;
  }
}