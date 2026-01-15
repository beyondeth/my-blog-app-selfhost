import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedSortingIndexes1785000000000 implements MigrationInterface {
  name = "AddFeedSortingIndexes1785000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_posts_home
        ON community_posts ("createdAt" DESC, id DESC)
        WHERE status = 'published'::community_post_status_enum
          AND "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_posts_hot_global
        ON community_posts ("likeCount" DESC, "commentCount" DESC, "createdAt" DESC)
        WHERE status = 'published'::community_post_status_enum
          AND "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_post_stats_hot_global
        ON post_stats ("likeCount" DESC, "commentCount" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_post_stats_hot_global`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_community_posts_hot_global`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_community_posts_home`);
  }
}
