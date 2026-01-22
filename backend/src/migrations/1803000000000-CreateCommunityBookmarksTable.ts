import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCommunityBookmarksTable1803000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "community_bookmarks" (
        "user_id" uuid NOT NULL,
        "post_id" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "PK_community_bookmarks" PRIMARY KEY ("user_id", "post_id"),
        CONSTRAINT "FK_community_bookmark_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_bookmark_post" FOREIGN KEY ("post_id")
          REFERENCES "community_posts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_community_bookmark_user_created" ON "community_bookmarks" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_bookmark_post" ON "community_bookmarks" ("post_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_community_bookmark_post"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_community_bookmark_user_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "community_bookmarks"`);
  }
}
