import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource } from "typeorm";

/**
 * IP 데이터 TTL 관리 서비스
 *
 * 개인정보보호법 준수를 위한 IP 데이터 자동 삭제
 * - 기본 보관 기간: 90일
 * - 매일 자정에 만료된 데이터 정리
 */
@Injectable()
export class IpRetentionService {
  private readonly logger = new Logger(IpRetentionService.name);

  // 보관 기간 (일)
  private readonly retentionDays = parseInt(
    process.env.IP_RETENTION_DAYS || "90",
    10,
  );

  constructor(private readonly dataSource: DataSource) {}

  /**
   * 매일 자정에 만료된 IP 데이터 정리
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredIpData(): Promise<void> {
    this.logger.log("🧹 Starting IP data cleanup job...");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      // Posts 테이블에서 오래된 IP 데이터 삭제
      const postsResult = await this.dataSource.query(
        `
        UPDATE posts 
        SET ip_address = NULL, user_agent = NULL
        WHERE "createdAt" < $1 
          AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
      `,
        [cutoffDate],
      );

      // Comments 테이블에서 오래된 IP 데이터 삭제
      const commentsResult = await this.dataSource.query(
        `
        UPDATE comments 
        SET ip_address = NULL, user_agent = NULL
        WHERE "createdAt" < $1 
          AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
      `,
        [cutoffDate],
      );

      // 만료된 IP 차단 해제
      const blocksResult = await this.dataSource.query(`
        DELETE FROM ip_block_list 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `);

      this.logger.log(
        `✅ IP cleanup complete: ` +
          `Posts: ${postsResult[1] || 0}, ` +
          `Comments: ${commentsResult[1] || 0}, ` +
          `Expired blocks: ${blocksResult[1] || 0}`,
      );
    } catch (error) {
      this.logger.error(`❌ IP cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * 수동 정리 실행 (관리자용)
   */
  async manualCleanup(): Promise<{
    posts: number;
    comments: number;
    blocks: number;
  }> {
    this.logger.log("🧹 Manual IP cleanup triggered");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const postsResult = await this.dataSource.query(
      `
      UPDATE posts 
      SET ip_address = NULL, user_agent = NULL
      WHERE "createdAt" < $1 
        AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
      RETURNING id
    `,
      [cutoffDate],
    );

    const commentsResult = await this.dataSource.query(
      `
      UPDATE comments 
      SET ip_address = NULL, user_agent = NULL
      WHERE "createdAt" < $1 
        AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
      RETURNING id
    `,
      [cutoffDate],
    );

    const blocksResult = await this.dataSource.query(`
      DELETE FROM ip_block_list 
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
      RETURNING ip_address
    `);

    return {
      posts: postsResult.length || 0,
      comments: commentsResult.length || 0,
      blocks: blocksResult.length || 0,
    };
  }

  /**
   * 보관 기간 조회
   */
  getRetentionDays(): number {
    return this.retentionDays;
  }
}
