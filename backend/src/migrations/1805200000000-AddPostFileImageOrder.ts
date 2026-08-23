import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostFileImageOrder1805200000000 implements MigrationInterface {
  name = "AddPostFileImageOrder1805200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE post_files
      ADD COLUMN IF NOT EXISTS image_order integer
    `);

    await queryRunner.query(`
      WITH ranked_files AS (
        SELECT
          pf."postId",
          pf."fileId",
          row_number() OVER (
            PARTITION BY pf."postId"
            ORDER BY f.created_at ASC, pf."fileId" ASC
          ) - 1 AS image_order
        FROM post_files pf
        INNER JOIN files f ON f.id = pf."fileId"
      )
      UPDATE post_files pf
      SET image_order = ranked_files.image_order
      FROM ranked_files
      WHERE pf."postId" = ranked_files."postId"
        AND pf."fileId" = ranked_files."fileId"
        AND pf.image_order IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE post_files
      ALTER COLUMN image_order SET DEFAULT 0,
      ALTER COLUMN image_order SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_post_files_post_image_order
      ON post_files ("postId", image_order, "fileId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_post_files_post_image_order
    `);
    await queryRunner.query(`
      ALTER TABLE post_files DROP COLUMN IF EXISTS image_order
    `);
  }
}
