import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * IP 접근 감사 로그 서비스
 * 
 * 개인정보보호법 준수를 위한 IP 조회 이력 기록
 * - 누가, 언제, 어떤 IP를 조회했는지 기록
 * - 보관 기간: 1년
 */
@Injectable()
export class IpAuditService {
  private readonly logger = new Logger(IpAuditService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * IP 조회 감사 로그 기록
   * 
   * @param adminId 조회한 관리자 ID
   * @param targetType 대상 유형 (post, comment, user)
   * @param targetId 대상 ID
   * @param action 수행 작업 (view, export, block)
   * @param ipViewed 조회한 IP (마스킹된 값)
   */
  async logIpAccess(
    adminId: string,
    targetType: 'post' | 'comment' | 'user' | 'ip',
    targetId: string,
    action: 'view' | 'export' | 'block' | 'unblock',
    ipViewed?: string,
  ): Promise<void> {
    try {
      await this.dataSource.query(`
        INSERT INTO audit_logs (
          "performedById",
          action,
          "entityType",
          "entityId",
          metadata,
          "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        adminId,
        `ip_${action}`,
        targetType,
        targetId,
        JSON.stringify({
          ipViewed: ipViewed || 'N/A',
          timestamp: new Date().toISOString(),
        }),
      ]);

      this.logger.log(
        `📋 IP Audit: Admin ${adminId} performed ${action} on ${targetType}:${targetId}`
      );
    } catch (error) {
      // 감사 로그 실패는 주요 기능을 중단시키지 않음
      this.logger.error(`Failed to log IP access: ${error.message}`);
    }
  }

  /**
   * 감사 로그 조회 (관리자용)
   * 
   * @param options 조회 옵션
   */
  async getAuditLogs(options: {
    adminId?: string;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    logs: any[];
    total: number;
  }> {
    const { adminId, targetType, startDate, endDate, limit = 50, offset = 0 } = options;

    let whereClause = `WHERE action LIKE 'IP_%'`;
    const params: any[] = [];
    let paramIndex = 1;

    if (adminId) {
      whereClause += ` AND "performedById" = $${paramIndex++}`;
      params.push(adminId);
    }

    if (targetType) {
      whereClause += ` AND "targetType" = $${paramIndex++}`;
      params.push(targetType);
    }

    if (startDate) {
      whereClause += ` AND "createdAt" >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND "createdAt" <= $${paramIndex++}`;
      params.push(endDate);
    }

    const countResult = await this.dataSource.query(`
      SELECT COUNT(*) as total FROM audit_logs ${whereClause}
    `, params);

    const logs = await this.dataSource.query(`
      SELECT 
        al.*,
        u.username as admin_username
      FROM audit_logs al
      LEFT JOIN users u ON al."performedById" = u.id
      ${whereClause}
      ORDER BY al."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, limit, offset]);

    return {
      logs,
      total: parseInt(countResult[0]?.total || '0', 10),
    };
  }
}
