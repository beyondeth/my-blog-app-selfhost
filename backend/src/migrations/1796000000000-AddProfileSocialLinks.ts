import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfileSocialLinks1796000000000 implements MigrationInterface {
  name = "AddProfileSocialLinks1796000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "socialLinks" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP COLUMN IF EXISTS "socialLinks"`,
    );
  }
}
