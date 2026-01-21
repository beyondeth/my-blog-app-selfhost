import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

/**
 * 통계 테이블 생성 마이그레이션
 *
 * 생성 테이블:
 * - blog_stats: 블로그 레벨 통계 (1:1 with blogs)
 * - community_stats: 커뮤니티 레벨 통계 (1:1 with communities)
 * - stats_snapshot: 일별/주별/월별 통계 스냅샷 (시계열 데이터)
 *
 * 설계 원칙:
 * - SRP: 각 테이블은 단일 책임을 가짐
 * - O(N)+1 방지: Bulk Upsert 지원을 위한 UNIQUE 제약조건
 * - 성능 최적화: 조회 패턴에 맞는 인덱스 설계
 */
export class CreateStatsTables1798000000000 implements MigrationInterface {
  name = "CreateStatsTables1798000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // 1. blog_stats 테이블 생성
    // =====================================================
    await queryRunner.createTable(
      new Table({
        name: "blog_stats",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "blog_id",
            type: "uuid",
            isNullable: false,
            isUnique: true,
          },
          {
            name: "total_posts",
            type: "int",
            default: 0,
          },
          {
            name: "total_views",
            type: "bigint",
            default: 0,
          },
          {
            name: "total_likes",
            type: "int",
            default: 0,
          },
          {
            name: "total_comments",
            type: "int",
            default: 0,
          },
          {
            name: "follower_count",
            type: "int",
            default: 0,
          },
          {
            name: "avg_engagement_rate",
            type: "numeric",
            precision: 5,
            scale: 2,
            default: 0,
            comment: "평균 참여율 (좋아요+댓글) / 조회수 * 100",
          },
          {
            name: "weekly_views",
            type: "int",
            default: 0,
            comment: "최근 7일 조회수",
          },
          {
            name: "weekly_likes",
            type: "int",
            default: 0,
            comment: "최근 7일 좋아요",
          },
          {
            name: "last_calculated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        foreignKeys: [
          {
            columnNames: ["blog_id"],
            referencedTableName: "blogs",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          },
        ],
      }),
      true,
    );

    // =====================================================
    // 2. community_stats 테이블 생성
    // =====================================================
    await queryRunner.createTable(
      new Table({
        name: "community_stats",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "community_id",
            type: "uuid",
            isNullable: false,
            isUnique: true,
          },
          {
            name: "total_posts",
            type: "int",
            default: 0,
          },
          {
            name: "total_views",
            type: "bigint",
            default: 0,
          },
          {
            name: "total_upvotes",
            type: "int",
            default: 0,
          },
          {
            name: "total_downvotes",
            type: "int",
            default: 0,
          },
          {
            name: "total_comments",
            type: "int",
            default: 0,
          },
          {
            name: "active_member_count",
            type: "int",
            default: 0,
            comment: "최근 30일 활동 멤버 수",
          },
          {
            name: "avg_hot_score",
            type: "numeric",
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: "weekly_posts",
            type: "int",
            default: 0,
            comment: "최근 7일 게시물 수",
          },
          {
            name: "weekly_members",
            type: "int",
            default: 0,
            comment: "최근 7일 신규 멤버 수",
          },
          {
            name: "last_calculated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        foreignKeys: [
          {
            columnNames: ["community_id"],
            referencedTableName: "communities",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          },
        ],
      }),
      true,
    );

    // =====================================================
    // 3. stats_snapshot 테이블 생성 (시계열 데이터)
    // =====================================================
    await queryRunner.createTable(
      new Table({
        name: "stats_snapshot",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "target_type",
            type: "varchar",
            length: "20",
            comment: "blog | community",
          },
          {
            name: "target_id",
            type: "uuid",
          },
          {
            name: "period",
            type: "varchar",
            length: "20",
            comment: "daily | weekly | monthly",
          },
          {
            name: "period_start",
            type: "date",
          },
          {
            name: "metrics",
            type: "jsonb",
            default: "'{}'",
            comment: "유연한 메트릭 저장 (views, likes, comments, posts 등)",
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    // =====================================================
    // 4. 인덱스 생성
    // =====================================================

    // stats_snapshot 시계열 조회 최적화
    await queryRunner.createIndex(
      "stats_snapshot",
      new TableIndex({
        name: "idx_stats_snapshot_target_period",
        columnNames: ["target_type", "target_id", "period", "period_start"],
      }),
    );

    // stats_snapshot 중복 방지 (같은 대상, 같은 기간, 같은 시작일 중복 불가)
    await queryRunner.createIndex(
      "stats_snapshot",
      new TableIndex({
        name: "idx_stats_snapshot_unique",
        columnNames: ["target_type", "target_id", "period", "period_start"],
        isUnique: true,
      }),
    );

    // =====================================================
    // 5. 기존 테이블 성능 인덱스 추가 (통계 쿼리 최적화)
    // =====================================================

    // posts 테이블: 블로그 주간 통계용 (Partial Index)
    // 주의: TypeORM이 camelCase 컬럼명 사용
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_blog_weekly_stats 
      ON posts ("blogId", "createdAt") 
      WHERE "isDeleted" = false AND "isPublished" = true;
    `);

    // community_posts 테이블: 커뮤니티 주간 통계용 (Partial Index)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_posts_weekly_stats 
      ON community_posts ("communityId", "createdAt") 
      WHERE "deletedAt" IS NULL;
    `);

    // community_posts 테이블: Top Posts (hotScore 정렬)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_posts_hot_score 
      ON community_posts ("communityId", "hotScore" DESC) 
      WHERE "deletedAt" IS NULL;
    `);

    // community_posts 테이블: Top Posts (upvote 정렬)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_posts_upvotes 
      ON community_posts ("communityId", "upvoteCount" DESC) 
      WHERE "deletedAt" IS NULL;
    `);

    // =====================================================
    // 5. 기존 테이블 컬럼 추가 및 성능 인덱스
    // =====================================================

    // community_members에 lastActivityAt 컬럼 추가 (활성 멤버 추적용)
    await queryRunner.query(`
      ALTER TABLE community_members 
      ADD COLUMN IF NOT EXISTS "lastActivityAt" timestamp
    `);

    // community_members 테이블: 활성 멤버 카운트용 (Partial Index)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_members_active 
      ON community_members ("communityId", "lastActivityAt") 
      WHERE status = 'active';
    `);

    // community_members 테이블: 주간 신규 멤버용
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_members_joined 
      ON community_members ("communityId", "joinedAt") 
      WHERE status = 'active';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 새로 추가한 성능 인덱스 삭제
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_community_members_joined;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_community_members_active;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_community_posts_upvotes;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_community_posts_hot_score;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_community_posts_weekly_stats;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_posts_blog_weekly_stats;`,
    );

    // 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE community_members 
      DROP COLUMN IF EXISTS "lastActivityAt"
    `);

    // 기존 인덱스 삭제
    await queryRunner.dropIndex("stats_snapshot", "idx_stats_snapshot_unique");
    await queryRunner.dropIndex(
      "stats_snapshot",
      "idx_stats_snapshot_target_period",
    );

    // 테이블 삭제
    await queryRunner.dropTable("stats_snapshot");
    await queryRunner.dropTable("community_stats");
    await queryRunner.dropTable("blog_stats");
  }
}
