import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Materialized View 관리 서비스
 *
 * PostgreSQL의 Materialized View를 주기적으로 갱신하여
 * 집계 쿼리 성능을 최적화합니다.
 */
@Injectable()
export class MaterializedViewService implements OnModuleInit {
  private readonly logger = new Logger(MaterializedViewService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit() {
    // 서비스 시작 시 Materialized View 갱신
    this.logger.log('Materialized View Service initialized');

    try {
      await this.refreshAllViews();
    } catch (error: any) {
      // Materialized View가 아직 생성되지 않은 경우
      if (error.code === '42P01') { // relation does not exist
        this.logger.warn('Materialized view "mv_popular_posts" does not exist. Please run migrations first.');
        return;
      }
      throw error;
    }
  }

  /**
   * 모든 Materialized View 갱신
   */
  async refreshAllViews(): Promise<void> {
    this.logger.log('Refreshing all materialized views...');

    try {
      await this.refreshPopularPosts();
      this.logger.log('All materialized views refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh materialized views:', error);
      throw error;
    }
  }

  /**
   * 인기 포스트 Materialized View 갱신
   * 10분마다 자동 갱신 (Cron으로 설정)
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshPopularPosts(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.dataSource.query(`
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_popular_posts
      `);

      const duration = Date.now() - startTime;
      this.logger.debug(`Popular posts view refreshed in ${duration}ms`);

      return result;
    } catch (error) {
      this.logger.error('Failed to refresh popular posts view:', error);
      throw error;
    }
  }

  /**
   * 특정 Materialized View 갱신
   */
  async refreshView(viewName: string): Promise<void> {
    const startTime = Date.now();

    try {
      await this.dataSource.query(`
        REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}
      `);

      const duration = Date.now() - startTime;
      this.logger.log(`Materialized view '${viewName}' refreshed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Failed to refresh materialized view '${viewName}':`, error);
      throw error;
    }
  }

  /**
   * Materialized View의 데이터 최신 상태 확인
   */
  async getViewLastRefreshTime(viewName: string): Promise<Date | null> {
    try {
      // PostgreSQL 시스템 카탈로그에서 정보 조회
      const result = await this.dataSource.query(`
        SELECT schemaname, matviewname, matviewowner, ispopulated, definition
        FROM pg_matviews
        WHERE matviewname = $1
      `, [viewName]);

      if (result.length === 0) {
        return null;
      }

      // 실제 갱신 시간은 pg_stat_all_tables의 last_autoanalyze 시간을 참고할 수 있음
      const statsResult = await this.dataSource.query(`
        SELECT last_autoanalyze
        FROM pg_stat_all_tables
        WHERE relname = $1
      `, [viewName]);

      return statsResult[0]?.last_autoanalyze ? new Date(statsResult[0].last_autoanalyze) : null;
    } catch (error) {
      this.logger.error(`Failed to get last refresh time for '${viewName}':`, error);
      return null;
    }
  }

  /**
   * Materialized View의 통계 정보 조회
   */
  async getViewStats(viewName: string): Promise<any> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          schemaname,
          matviewname,
          matviewowner,
          ispopulated,
          definition
        FROM pg_matviews
        WHERE matviewname = $1
      `, [viewName]);

      if (result.length === 0) {
        return null;
      }

      // 행 수 계산
      const countResult = await this.dataSource.query(`
        SELECT COUNT(*) as total_rows
        FROM ${viewName}
      `);

      return {
        ...result[0],
        total_rows: parseInt(countResult[0].total_rows),
        last_refresh: await this.getViewLastRefreshTime(viewName)
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for '${viewName}':`, error);
      return null;
    }
  }

  /**
   * 인기 포스트 데이터 직접 조회 (Materialized View 사용)
   * MV에서 author, blog 정보 포함하여 조회 (재조회 불필요)
   */
  async getPopularPosts(limit: number = 10): Promise<any[]> {
    try {
      const result = await this.dataSource.query(`
        SELECT
          -- 포스트 정보
          id,
          title,
          slug,
          excerpt,
          thumbnail,
          "thumbnail_image_id" AS "thumbnailImageId",
          "blogId",
          "authorId",
          "publishedAt",
          "createdAt",

          -- 통계 정보
          "viewCount",
          "likeCount",
          "commentCount",
          "popularityScore",

          -- 최소 Author 정보 (username만)
          "authorUsername",

          -- 최소 Blog 정보 (slug만 - URL 생성용)
          "blogSlug"
        FROM mv_popular_posts
        ORDER BY "popularityScore" DESC, "publishedAt" DESC
        LIMIT $1
      `, [limit]);

      return result;
    } catch (error) {
      this.logger.error('Failed to get popular posts from materialized view:', error);
      throw error;
    }
  }
}