import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProfileAndUsernameLengths1791100000000
  implements MigrationInterface
{
  name = "UpdateProfileAndUsernameLengths1791100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // mv_popular_posts 뷰가 users.username을 참조하고 있어 컬럼 타입 변경 전에 제거
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS mv_popular_posts;`,
    );

    await queryRunner.query(
      `ALTER TABLE "profiles" ALTER COLUMN "jobTitle" TYPE character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "username" TYPE character varying(30)`,
    );

    // 최신 정의로 materialized view 재생성 (EnhancePopularPostsMV1778200000000과 동일)
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
          ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2 AS "popularityScore",
          u.username AS "authorUsername",
          b.slug AS "blogSlug"
      FROM posts p
      LEFT JOIN post_stats ps ON p.id = ps."postId"
      LEFT JOIN files f ON p."thumbnail_image_id" = f.id
      LEFT JOIN users u ON p."authorId" = u.id
      LEFT JOIN blogs b ON p."blogId" = b.id
      WHERE p."isPublished" = true AND p."isDeleted" = false
      ORDER BY (ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2) DESC, p."publishedAt" DESC;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_mv_popular_posts_id ON mv_popular_posts (id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mv_popular_posts_thumbnail ON mv_popular_posts ("thumbnail_image_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_mv_popular_posts_published_at ON mv_popular_posts ("publishedAt" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS mv_popular_posts;`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "username" TYPE character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ALTER COLUMN "jobTitle" TYPE character varying(120)`,
    );

    // 이전 정의로 MV 복구 (EnhancePopularPostsMV down과 동일)
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
