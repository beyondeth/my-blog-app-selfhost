import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 블로그 아이콘 영역 커스터마이징을 위한 텍스트 필드 및 토글 추가
 */
export class AddBlogIconTextFields1790700000000 implements MigrationInterface {
  name = "AddBlogIconTextFields1790700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blogs"
      ADD COLUMN "iconTextEnabled" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN "iconLabel" VARCHAR(120),
      ADD COLUMN "iconLabelEnabled" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN "iconSubtitle" VARCHAR(160),
      ADD COLUMN "iconSubtitleEnabled" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN "iconPlacement" VARCHAR(20) NOT NULL DEFAULT 'inline'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blogs"
      DROP COLUMN IF EXISTS "iconPlacement",
      DROP COLUMN IF EXISTS "iconSubtitleEnabled",
      DROP COLUMN IF EXISTS "iconSubtitle",
      DROP COLUMN IF EXISTS "iconLabelEnabled",
      DROP COLUMN IF EXISTS "iconLabel",
      DROP COLUMN IF EXISTS "iconTextEnabled"
    `);
  }
}
