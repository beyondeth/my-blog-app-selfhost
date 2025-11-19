import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Recreate mv_popular_posts materialized view with thumbnailImageId support
 *
 * This migration restores the materialized view that was accidentally dropped
 * and updates it to use thumbnailImageId with files table instead of thumbnail field
 */
export class RecreatePopularPostsWithThumbnailFix1763312000000 implements MigrationInterface {
    name = 'RecreatePopularPostsWithThumbnailFix1763312000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Recreate materialized view with proper thumbnail handling
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
            ORDER BY (ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2) DESC, p."publishedAt" DESC
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_mv_popular_posts_id ON mv_popular_posts (id)
        `);

        // Create index for better performance on joins
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_mv_popular_posts_thumbnail ON mv_popular_posts ("thumbnail_image_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback: Drop the updated view
        await queryRunner.query(`
            DROP MATERIALIZED VIEW IF EXISTS mv_popular_posts
        `);

        // Recreate the old version (using thumbnail field - which no longer exists)
        // Note: This rollback will fail since thumbnail column is already dropped
        // In production, we should not rollback this migration
        await queryRunner.query(`
            CREATE MATERIALIZED VIEW mv_popular_posts AS
            SELECT
                p.id,
                p.title,
                p.slug,
                p.excerpt,
                NULL as thumbnail,  -- Since thumbnail column was dropped
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
            WHERE p."isPublished" = true AND p."isDeleted" = false
            ORDER BY (ps."viewCount" + ps."likeCount" * 3 + ps."commentCount" * 2) DESC, p."publishedAt" DESC
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_mv_popular_posts_id ON mv_popular_posts (id)
        `);
    }
}