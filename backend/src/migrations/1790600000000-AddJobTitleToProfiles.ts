import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 사용자 프로필에 직업/역할(jobTitle) 필드를 추가하여
 * 블로그 사이드바 카드 등에서 노출할 수 있도록 확장
 */
export class AddJobTitleToProfiles1790600000000 implements MigrationInterface {
  name = "AddJobTitleToProfiles1790600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
      ADD COLUMN "jobTitle" VARCHAR(120)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
      DROP COLUMN IF EXISTS "jobTitle"
    `);
  }
}
