import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 블로그 이미지 표시 방식(cover/contain) 선호도 필드 추가
 *
 * - logoImageFit (기본값: contain)
 * - iconImageFit (기본값: contain)
 * - coverImageFit (기본값: cover)
 */
export class AddBlogImageFitPreferences1790300000000
  implements MigrationInterface
{
  name = "AddBlogImageFitPreferences1790300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blogs"
        ADD COLUMN "logoImageFit" VARCHAR(20) NOT NULL DEFAULT 'contain'
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
        ADD COLUMN "iconImageFit" VARCHAR(20) NOT NULL DEFAULT 'contain'
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
        ADD COLUMN "coverImageFit" VARCHAR(20) NOT NULL DEFAULT 'cover'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blogs"
        DROP COLUMN IF EXISTS "coverImageFit"
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
        DROP COLUMN IF EXISTS "iconImageFit"
    `);

    await queryRunner.query(`
      ALTER TABLE "blogs"
        DROP COLUMN IF EXISTS "logoImageFit"
    `);
  }
}
