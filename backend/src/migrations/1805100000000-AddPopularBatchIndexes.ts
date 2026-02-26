import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPopularBatchIndexes1805100000000 implements MigrationInterface {
  name = "AddPopularBatchIndexes1805100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_popular_batch"
      ON "posts" ("publishedAt" DESC)
      INCLUDE ("authorId", "blogId", "thumbnail_image_id")
      WHERE "isPublished" = true
        AND "isDeleted" = false
        AND "status" = 'published'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_community_posts_popular_batch"
      ON "community_posts" ("createdAt" DESC)
      INCLUDE ("communityId", "authorId", "viewCount", "upvoteCount", "commentCount")
      WHERE "status" = 'published'
        AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_community_posts_popular_batch"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_popular_batch"`);
  }
}
