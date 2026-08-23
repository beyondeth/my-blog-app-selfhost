import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
} from "typeorm";
import { AuditLog, AuditAction } from "./entities/audit-log.entity";
import { DateUtils } from "../common/utils/date.utils";
import { RequestContextService } from "../common/services/request-context.service";

export interface AuditContext {
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
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
    private readonly requestContextService: RequestContextService,
  ) {}

  /**
   * Create an audit log entry
   */
  async log(entry: AuditLogEntry, context: AuditContext): Promise<AuditLog> {
    const requestContext = this.requestContextService.get();
    const auditLog = this.auditLogRepository.create({
      ...entry,
      performedById: context.userId || null,
      organizationId: context.organizationId || requestContext.organizationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      requestId: context.requestId || requestContext.requestId,
    });

    return await this.auditLogRepository.save(auditLog);
  }

  async logSecurityEvent(
    action: AuditAction,
    metadata: Record<string, any>,
    context: AuditContext = {},
  ): Promise<AuditLog> {
    return this.log(
      {
        action,
        entityType: "security",
        metadata,
      },
      context,
    );
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
        entityType: "user",
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
        entityType: "post",
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
        entityType: "report",
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
        entityType: "admin",
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
      organizationId?: string;
      requestId?: string;
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
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.requestId) where.requestId = filters.requestId;

    if (filters.startDate && filters.endDate) {
      where.createdAt = Between(filters.startDate, filters.endDate);
    } else if (filters.startDate) {
      where.createdAt = MoreThanOrEqual(filters.startDate);
    } else if (filters.endDate) {
      where.createdAt = LessThanOrEqual(filters.endDate);
    }

    const safePage = Math.max(Math.trunc(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where,
      relations: ["performedBy"],
      order: { createdAt: "DESC" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data: logs,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Get tenant-scoped audit logs for an operator-facing API.
   * The performed user is intentionally projected to non-sensitive fields.
   */
  async findOrganizationLogs(
    filters: {
      action?: AuditAction;
      entityType?: string;
      entityId?: string;
      performedById?: string;
      organizationId: string;
      requestId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page = 1,
    limit = 50,
  ) {
    const result = await this.findAll(filters, page, limit);

    return {
      ...result,
      data: result.data.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        previousData: log.previousData,
        newData: log.newData,
        metadata: log.metadata,
        organizationId: log.organizationId,
        requestId: log.requestId,
        createdAt: log.createdAt,
        performedBy: log.performedBy
          ? {
              id: log.performedBy.id,
              username: log.performedBy.username,
            }
          : null,
      })),
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
      relations: ["performedBy"],
      order: { createdAt: "DESC" },
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
  async findByUser(userId: string, page = 1, limit = 50) {
    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { performedById: userId },
      order: { createdAt: "DESC" },
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
      relations: ["performedBy"],
      order: { createdAt: "DESC" },
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

    const [totalLogs, logsByAction, logsByEntityType, topUsers] =
      await Promise.all([
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
      .where("createdAt < :cutoffDate", { cutoffDate })
      .execute();

    return { deletedCount: result.affected };
  }

  // Private helper methods

  private async getLogsByAction(where: FindOptionsWhere<AuditLog>) {
    const result = await this.auditLogRepository
      .createQueryBuilder("log")
      .select("log.action", "action")
      .addSelect("COUNT(*)", "count")
      .where(where)
      .groupBy("log.action")
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.action] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getLogsByEntityType(where: FindOptionsWhere<AuditLog>) {
    const result = await this.auditLogRepository
      .createQueryBuilder("log")
      .select("log.entityType", "entityType")
      .addSelect("COUNT(*)", "count")
      .where(where)
      .groupBy("log.entityType")
      .getRawMany();

    return result.reduce((acc, item) => {
      acc[item.entityType] = parseInt(item.count);
      return acc;
    }, {});
  }

  private async getTopUsers(where: FindOptionsWhere<AuditLog>) {
    const result = await this.auditLogRepository
      .createQueryBuilder("log")
      .select("log.performedById", "userId")
      .addSelect("COUNT(*)", "count")
      .where(where)
      .groupBy("log.performedById")
      .orderBy("COUNT(*)", "DESC")
      .limit(10)
      .getRawMany();

    return result;
  }
}
