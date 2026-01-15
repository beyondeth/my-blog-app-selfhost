import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hero 메인 타이틀 커스터마이징 필드를 제거합니다.
 */
export class RemoveIconTitleCustomization1790702000000
  implements MigrationInterface
{
  name = "RemoveIconTitleCustomization1790702000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blogs"
      DROP COLUMN IF EXISTS "iconTitleEnabled",
      DROP COLUMN IF EXISTS "iconTitle"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blogs"
      ADD COLUMN "iconTitle" VARCHAR(160),
      ADD COLUMN "iconTitleEnabled" BOOLEAN NOT NULL DEFAULT true
    `);
  }
}
