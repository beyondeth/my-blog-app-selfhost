import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * PostgreSQL 18 고성능 인덱스 추가 마이그레이션 (개발 환경용)
 *
 * 기본적인 성능 최적화 인덱스만 추가
 */
export class AddHighPerformanceIndexesForPostgres18Dev1763200000001
  implements MigrationInterface
{
  name = "AddHighPerformanceIndexesForPostgres18Dev1763200000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== 1. 포스트 관련 핵심 인덱스 =====

    // Hash 인덱스: 상태 필드 빠른 조회 (PostgreSQL 18 개선)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_published_hash"
      ON "posts" USING hash("isPublished")
      WHERE "isPublished" = true;
    `);

    // Covering 인덱스: 포스트 목록 조회 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_feed_covering"
      ON "posts" ("isPublished", "blogId", "publishedAt" DESC NULLS LAST)
      INCLUDE (id, title, slug, thumbnail, "status")
      WITH (FILLFACTOR = 95);
    `);

    // 복합 인덱스: 홈 피드 조회 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_home_feed"
      ON "posts" ("isPublished", "isDeleted", "publishedAt" DESC NULLS LAST)
      INCLUDE (id, title, slug, "thumbnail", "blogId", "authorId")
      WITH (FILLFACTOR = 95);
    `);

    // ===== 2. 태그 검색 최적화 (GIN 인덱스) =====

    // GIN 인덱스: JSONB 태그 배열 검색 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_tags_gin"
      ON "posts" USING gin("tags")
      WHERE "isPublished" = true AND "isDeleted" = false;
    `);

    // ===== 3. 상호작용 관련 인덱스 =====

    // 북마크 조회 최적화 (사용자별 포스트 북마크 상태 조회)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookmarks_user_post"
      ON "bookmarks" ("userId", "postId");
    `);

    // ===== 4. 블로그/사용자 관련 인덱스 =====

    // 블로그별 포스트 개수 카운트 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_blog_published_count"
      ON "posts" ("blogId", "isPublished", "isDeleted")
      WHERE "isDeleted" = false;
    `);

    // 사용자별 작성 포스트 조회 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_author_published"
      ON "posts" ("authorId", "isPublished", "publishedAt" DESC);
    `);

    // ===== 5. 검색 관련 인덱스 =====

    // 전체 텍스트 검색 (기본 english 설정)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_search_fts"
      ON "posts" USING gin(to_tsvector('english', "title" || ' ' || COALESCE("excerpt", '')))
      WHERE "isPublished" = true AND "isDeleted" = false;
    `);

    // ===== 6. 코멘트 관련 인덱스 =====

    // 포스트별 코멘트 조회 최적화 (Comments 엔티티는 camelCase 사용)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_comments_post_created"
      ON "comments" ("postId", "isDeleted", "createdAt" DESC)
      WHERE "isDeleted" = false;
    `);

    // ===== 7. 통계용 Materialized View =====

    // 인기 포스트 집계 뷰
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_popular_posts" AS
      SELECT
        p.id,
        p.title,
        p.slug,
        p.excerpt,
        p.thumbnail,
        p."blogId",
        p."authorId",
        p."publishedAt",
        COALESCE(ps."viewCount", 0) as "viewCount",
        COALESCE(ps."likeCount", 0) as "likeCount",
        COALESCE(ps."commentCount", 0) as "commentCount",
        (COALESCE(ps."viewCount", 0) + (COALESCE(ps."likeCount", 0) * 3) + (COALESCE(ps."commentCount", 0) * 2)) as "popularityScore"
      FROM "posts" p
      LEFT JOIN "post_stats" ps ON p.id = ps."postId"
      WHERE p."isPublished" = true AND p."isDeleted" = false
      ORDER BY "popularityScore" DESC, p."publishedAt" DESC
      WITH DATA;
    `);

    // Materialized View에 대한 고유 인덱스
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_mv_popular_posts_id"
      ON "mv_popular_posts" (id);
    `);

    // Materialized View 정렬용 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_mv_popular_posts_score_published"
      ON "mv_popular_posts" ("popularityScore" DESC, "publishedAt" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 및 뷰 제거 (역순으로 제거)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_mv_popular_posts_score_published";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_mv_popular_posts_id";`);
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS "mv_popular_posts";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_comments_post_created";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_search_fts";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_posts_author_published";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_posts_blog_published_count";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookmarks_user_post";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_tags_gin";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_home_feed";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_feed_covering";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_published_hash";`);
  }
}
