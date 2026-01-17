import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHomeFeedPerformanceIndexes1800000000000
  implements MigrationInterface
{
  name = 'AddHomeFeedPerformanceIndexes1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Posts table index for unified feed query optimization
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_home_feed" 
      ON "posts" ("status", "isPublished", "isDeleted", "createdAt" DESC, "id" DESC)
    `);

    // CommunityPosts table index for unified feed query optimization
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_community_posts_home_feed" 
      ON "community_posts" ("status", "deletedAt", "createdAt" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_community_posts_home_feed"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_posts_home_feed"
    `);
  }
}
