import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommunityPostFiles1808300000000 implements MigrationInterface {
  name = "AddCommunityPostFiles1808300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_post_files (
        "communityPostId" uuid NOT NULL,
        "fileId" uuid NOT NULL,
        CONSTRAINT "PK_community_post_files" PRIMARY KEY ("communityPostId", "fileId"),
        CONSTRAINT "FK_community_post_files_post" FOREIGN KEY ("communityPostId")
          REFERENCES community_posts(id) ON DELETE CASCADE,
        CONSTRAINT "FK_community_post_files_file" FOREIGN KEY ("fileId")
          REFERENCES files(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_post_files_file"
      ON community_post_files ("fileId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS community_post_files`);
  }
}
