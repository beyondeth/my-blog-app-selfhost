import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQualityScoreToPost1758040089931 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "posts"
            ADD COLUMN IF NOT EXISTS "qualityScore" integer DEFAULT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "posts"
            DROP COLUMN IF EXISTS "qualityScore"
        `);
  }
}
