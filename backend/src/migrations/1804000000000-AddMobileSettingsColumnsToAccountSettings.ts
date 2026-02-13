import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMobileSettingsColumnsToAccountSettings1804000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "account_settings"
      ADD COLUMN "themePreference" character varying(20) NOT NULL DEFAULT 'SYSTEM'
    `);

    await queryRunner.query(`
      ALTER TABLE "account_settings"
      ADD COLUMN "pushEnabled" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "account_settings"
      ADD COLUMN "communityReplyEnabled" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "account_settings"
      ADD COLUMN "profileVisible" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "account_settings"
      ADD COLUMN "activityVisible" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account_settings" DROP COLUMN "activityVisible"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_settings" DROP COLUMN "profileVisible"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_settings" DROP COLUMN "communityReplyEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_settings" DROP COLUMN "pushEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account_settings" DROP COLUMN "themePreference"`,
    );
  }
}
