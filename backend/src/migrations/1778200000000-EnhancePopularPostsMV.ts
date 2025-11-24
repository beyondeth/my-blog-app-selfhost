import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Materialized View 개선: author/blog 정보 포함
 *
 * 목적:
 * - 인기 포스트 조회 시 재조회 제거 (2회 → 1회)
 * - author, blog 정보를 MV에 포함하여 JOIN 제거
 * - 성능 향상: 10-20배
 */
export class EnhancePopularPostsMV1778200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 기존 Materialized View 삭제
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_popular_posts;`);

    // 개선된 Materialized View 생성 (최소 author/blog 정보만 포함)
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_popular_posts AS
      SELECT
          -- 기존 포스트 정보
          p.id,
          p.title,
          p.slug,
          p.excerpt,
          p."thumbnail_image_id",
          COALESCE(f."file_url", NULL) as thumbnail,
          p."blogId",
          p."authorId",
          p."publishedAt",
          p."createdAt",

          -- 통계 정보
          ps."viewCount",
          ps."likeCount",
          ps."commentCount",
          ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2 AS "popularityScore",

          -- 🆕 최소 Author 정보 (username만)
          u.username AS "authorUsername",

          -- 🆕 최소 Blog 정보 (slug만 - URL 생성용)
          b.slug AS "blogSlug"

      FROM posts p
      LEFT JOIN post_stats ps ON p.id = ps."postId"
      LEFT JOIN files f ON p."thumbnail_image_id" = f.id
      LEFT JOIN users u ON p."authorId" = u.id
      LEFT JOIN blogs b ON p."blogId" = b.id
      WHERE p."isPublished" = true AND p."isDeleted" = false
      ORDER BY (ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2) DESC, p."publishedAt" DESC;
    `);

    // 인덱스 재생성
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_mv_popular_posts_id ON mv_popular_posts (id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mv_popular_posts_thumbnail ON mv_popular_posts ("thumbnail_image_id");
    `);

    // 🆕 publishedAt 인덱스 (날짜 필터링용)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mv_popular_posts_published_at ON mv_popular_posts ("publishedAt" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: 기존 MV로 복원
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_popular_posts;`);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_popular_posts AS
      SELECT
          p.id,
          p.title,
          p.slug,
          p.excerpt,
          p."thumbnail_image_id",
          COALESCE(f."file_url", NULL) as thumbnail,
          p."blogId",
          p."authorId",
          p."publishedAt",
          p."createdAt",
          ps."viewCount",
          ps."likeCount",
          ps."commentCount",
          ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2 AS "popularityScore"
      FROM posts p
      LEFT JOIN post_stats ps ON p.id = ps."postId"
      LEFT JOIN files f ON p."thumbnail_image_id" = f.id
      WHERE p."isPublished" = true AND p."isDeleted" = false
      ORDER BY (ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2) DESC, p."publishedAt" DESC;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_mv_popular_posts_id ON mv_popular_posts (id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mv_popular_posts_thumbnail ON mv_popular_posts ("thumbnail_image_id");
    `);
  }
}
