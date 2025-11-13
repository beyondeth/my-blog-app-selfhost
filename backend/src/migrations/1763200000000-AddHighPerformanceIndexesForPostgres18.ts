import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PostgreSQL 18 고성능 인덱스 추가 마이그레이션
 *
 * 이 마이그레이션은 PostgreSQL 18의 새로운 기능을 활용하여
 * 모바일 성능을 최적화하기 위한 인덱스를 추가합니다.
 */
export class AddHighPerformanceIndexesForPostgres181763200000000
  implements MigrationInterface {
  name = 'AddHighPerformanceIndexesForPostgres181763200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== 1. 포스트 관련 핵심 인덱스 =====

    // BRIN 인덱스: 시간순 포스트 정렬 최적화 (PostgreSQL 18)
    // 대용량 데이터에 메모리 효율적
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_temporal_brin"
      ON "posts" USING brin("blogId", "publishedAt", "isDeleted")
      WITH (pages_per_range = 64);
    `);

    // Hash 인덱스: 상태 필드 빠른 조회 (PostgreSQL 18 개선)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_published_hash"
      ON "posts" USING hash("isPublished")
      WHERE "isPublished" = true;
    `);

    // Covering 인덱스: 포스트 목록 조회 최적화
    // INCLUDE 절을 사용하여 테이블 접근 없이 인덱스만으로 조회 완료
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_feed_covering"
      ON "posts" ("isPublished", "blogId", "publishedAt" DESC NULLS LAST, "category")
      INCLUDE (id, title, slug, excerpt, thumbnail, "status", "contentType")
      WITH (FILLFACTOR = 95);
    `);

    // 복합 인덱스: 홈 피드 조회 최적화
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_home_feed"
      ON "posts" ("isPublished", "isDeleted", "publishedAt" DESC NULLS LAST)
      INCLUDE (id, title, slug, "thumbnail", "blogId", "authorId", "excerpt")
      WITH (FILLFACTOR = 95);
    `);

    // ===== 2. 태그 검색 최적화 (GIN 인덱스) =====

    // GIN 인덱스: JSONB 태그 배열 검색 최적화
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_tags_gin"
      ON "posts" USING gin("tags")
      WHERE "isPublished" = true AND "isDeleted" = false;
    `);

    // GIN 인덱스 with include: 태그 검색 결과의 기본 정보 포함
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_tags_gin_covering"
      ON "posts" USING gin("tags")
      WHERE "isPublished" = true
      INCLUDE (id, title, slug, excerpt, "thumbnail", "publishedAt");
    `);

    // ===== 3. 상호작용 관련 인덱스 =====

    // 북마크 조회 최적화 (복합 인덱스)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bookmarks_user_post"
      ON "bookmarks" ("userId", "postId");
    `);

    // 포스트 통계 조회 최적화
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_post_stats_post_id"
      ON "post_stats" ("postId");
    `);

    // 좋아요 상태 조회 최적화 (사용자별)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_post_likes_user_post"
      ON "post_likes" ("userId", "postId")
      WHERE "isActive" = true;
    `);

    // ===== 4. 블로그/사용자 관련 인덱스 =====

    // 블로그별 포스트 개수 카운트 최적화
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_blog_published_count"
      ON "posts" ("blogId", "isPublished", "isDeleted")
      WHERE "isDeleted" = false;
    `);

    // 사용자별 작성 포스트 조회 최적화
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_author_published"
      ON "posts" ("authorId", "isPublished", "publishedAt" DESC);
    `);

    // ===== 5. 검색 관련 인덱스 =====

    // 전체 텍스트 검색 (PostgreSQL 18 개선된 GIN 인덱스)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_posts_search_fts"
      ON "posts" USING gin(to_tsvector('korean', "title" || ' ' || COALESCE("excerpt", '')))
      WHERE "isPublished" = true AND "isDeleted" = false;
    `);

    // ===== 6. 코멘트 관련 인덱스 =====

    // 포스트별 코멘트 조회 최적화
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_comments_post_created"
      ON "comments" ("postId", "isDeleted", "createdAt" DESC)
      WHERE "isDeleted" = false;
    `);

    // ===== 7. 통계용 Materialized View =====

    // 인기 포스트 집계 뷰
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW CONCURRENTLY IF NOT EXISTS "mv_popular_posts" AS
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
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "idx_mv_popular_posts_id"
      ON "mv_popular_posts" (id);
    `);

    // Materialized View 정렬용 인덱스
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_mv_popular_posts_score_published"
      ON "mv_popular_posts" ("popularityScore" DESC, "publishedAt" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 및 뷰 제거
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_mv_popular_posts_score_published";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_mv_popular_posts_id";`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_popular_posts";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_comments_post_created";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_search_fts";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_author_published";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_blog_published_count";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_post_likes_user_post";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_post_stats_post_id";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_bookmarks_user_post";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_tags_gin_covering";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_tags_gin";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_home_feed";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_feed_covering";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_published_hash";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_posts_temporal_brin";`);
  }
}