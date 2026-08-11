import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Remove viewCount from posts table and migrate data to post_stats
 *
 * This migration:
 * 1. Creates missing PostStats records for posts that don't have them
 * 2. Merges viewCount data from posts table to post_stats table (takes the higher value)
 * 3. Drops the viewCount column from posts table
 * 4. Updates related indexes if needed
 */
export class RemoveViewCountFromPosts1775000000000
  implements MigrationInterface
{
  name = "RemoveViewCountFromPosts1775000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create PostStats records for posts that don't have them
    await queryRunner.query(`
            INSERT INTO post_stats ("postId", "viewCount", "likeCount", "commentCount", "qualityScore", "createdAt", "updatedAt")
            SELECT
                p.id,
                COALESCE(p."viewCount", 0),
                0,
                0,
                0,
                p."createdAt",
                p."updatedAt"
            FROM posts p
            LEFT JOIN post_stats ps ON p.id = ps."postId"
            WHERE ps."postId" IS NULL
        `);

    // 2. Update post_stats with the maximum view count from both tables
    await queryRunner.query(`
            UPDATE post_stats
            SET
                "viewCount" = GREATEST(
                    post_stats."viewCount",
                    (SELECT COALESCE(p."viewCount", 0) FROM posts p WHERE p.id = post_stats."postId")
                ),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE EXISTS (
                SELECT 1 FROM posts p
                WHERE p.id = post_stats."postId"
                AND p."viewCount" IS NOT NULL
            )
        `);

    // 3. Update materialized view to use post_stats instead of posts.viewCount
    await queryRunner.query(`
            DROP MATERIALIZED VIEW IF EXISTS mv_popular_posts
        `);

    await queryRunner.query(`
            CREATE MATERIALIZED VIEW mv_popular_posts AS
            SELECT p.id,
                p.title,
                p.slug,
                p.excerpt,
                p."thumbnail_image_id",
                COALESCE(f."file_url", NULL) AS thumbnail,
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
            ORDER BY (ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2) DESC, p."publishedAt" DESC
        `);

    await queryRunner.query(`
            CREATE UNIQUE INDEX idx_mv_popular_posts_id ON mv_popular_posts (id)
        `);

    // 4. Drop the viewCount column from posts table
    await queryRunner.query(`
            ALTER TABLE posts
            DROP COLUMN IF EXISTS "viewCount"
        `);

    // 4. Also drop likeCount and commentCount if they exist (as they're also in post_stats)
    const hasLikeCount = await queryRunner.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'posts'
            AND column_name = 'likeCount'
        `);

    if (hasLikeCount.length > 0) {
      await queryRunner.query(`
                ALTER TABLE posts
                DROP COLUMN IF EXISTS "likeCount"
            `);
    }

    const hasCommentCount = await queryRunner.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'posts'
            AND column_name = 'commentCount'
        `);

    if (hasCommentCount.length > 0) {
      await queryRunner.query(`
                ALTER TABLE posts
                DROP COLUMN IF EXISTS "commentCount"
            `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Recreate original materialized view
    await queryRunner.query(`
            DROP MATERIALIZED VIEW IF EXISTS mv_popular_posts
        `);

    await queryRunner.query(`
            CREATE MATERIALIZED VIEW mv_popular_posts AS
            SELECT id,
                title,
                slug,
                excerpt,
                thumbnail,
                "blogId",
                "authorId",
                "publishedAt",
                "createdAt",
                "viewCount",
                "likeCount",
                "commentCount",
                "viewCount" + "likeCount" * 3 + "commentCount" * 2 AS "popularityScore"
            FROM posts p
            WHERE "isPublished" = true AND "isDeleted" = false
            ORDER BY ("viewCount" + "likeCount" * 3 + "commentCount" * 2) DESC, "publishedAt" DESC
        `);

    await queryRunner.query(`
            CREATE UNIQUE INDEX idx_mv_popular_posts_id ON mv_popular_posts (id)
        `);

    // Add viewCount back to posts table
    await queryRunner.query(`
            ALTER TABLE posts
            ADD COLUMN "viewCount" integer DEFAULT 0 NOT NULL
        `);

    // Copy viewCount data back from post_stats
    await queryRunner.query(`
            UPDATE posts
            SET "viewCount" = COALESCE(
                (SELECT "viewCount" FROM post_stats WHERE "postId" = posts.id),
                0
            )
        `);

    // Add likeCount and commentCount back if they were dropped
    await queryRunner.query(`
            ALTER TABLE posts
            ADD COLUMN IF NOT EXISTS "likeCount" integer DEFAULT 0 NOT NULL
        `);

    await queryRunner.query(`
            ALTER TABLE posts
            ADD COLUMN IF NOT EXISTS "commentCount" integer DEFAULT 0 NOT NULL
        `);

    // Copy likeCount and commentCount data back
    await queryRunner.query(`
            UPDATE posts
            SET "likeCount" = COALESCE(
                (SELECT "likeCount" FROM post_stats WHERE "postId" = posts.id),
                0
            )
        `);

    await queryRunner.query(`
            UPDATE posts
            SET "commentCount" = COALESCE(
                (SELECT "commentCount" FROM post_stats WHERE "postId" = posts.id),
                0
            )
        `);
  }
}
