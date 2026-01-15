import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostPerformanceIndexes1763050000000
  implements MigrationInterface
{
  name = "AddPostPerformanceIndexes1763050000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 포스트 slug 조회 최적화 (가장 중요)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_slug_published_deleted
            ON posts(slug, "isPublished", "isDeleted")
            WHERE "isDeleted" = false
        `);

    // 작성자 포스트 목록 조회 최적화
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_author_published
            ON posts("authorId", "isPublished", "publishedAt" DESC)
            WHERE "isPublished" = true AND "isDeleted" = false
        `);

    // post_stats 조인 최적화 (1:1 관계)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_post_stats_post_id
            ON post_stats("postId")
        `);

    // post_metadata 조인 최적화 (1:1 관계)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_post_metadata_post_id
            ON post_metadata("postId")
        `);

    // 포스트 목록 페이징 최적화 (created_at + is_published)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_created_published
            ON posts("createdAt" DESC, "isPublished")
            WHERE "isPublished" = true AND "isDeleted" = false
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_created_published`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_post_metadata_post_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_post_stats_post_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_author_published`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_posts_slug_published_deleted`,
    );
  }
}
