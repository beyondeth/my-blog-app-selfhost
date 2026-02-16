import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUnifiedFeedRecentIndexes1804100000000
  implements MigrationInterface
{
  name = "AddUnifiedFeedRecentIndexes1804100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_unified_feed_recent_v2"
      ON "posts" ("createdAt" DESC, "id" DESC)
      WHERE "isPublished" = true
        AND "isDeleted" = false
        AND "status" = 'published'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_community_posts_unified_feed_recent_v2"
      ON "community_posts" ("createdAt" DESC, "id" DESC, "communityId")
      WHERE "status" = 'published'
        AND "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_communities_discoverable_feed_v2"
      ON "communities" ("id")
      WHERE "isPublic" = true
        AND "isPostDiscoverable" = true
        AND "deletedAt" IS NULL
        AND "joinPolicy" <> 'private'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_communities_discoverable_feed_v2"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_community_posts_unified_feed_recent_v2"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_posts_unified_feed_recent_v2"`,
    );
  }
}

