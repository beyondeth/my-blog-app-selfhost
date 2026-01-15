import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveIconPlaceholderToggle1791200000000
  implements MigrationInterface
{
  name = "RemoveIconPlaceholderToggle1791200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blogs" DROP COLUMN IF EXISTS "iconPlaceholderEnabled"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blogs"
      ADD COLUMN "iconPlaceholderEnabled" BOOLEAN NOT NULL DEFAULT true
    `);
  }
}
