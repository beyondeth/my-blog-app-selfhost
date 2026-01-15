import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRestoreAction1790200000000 implements MigrationInterface {
  name = "AddUserRestoreAction1790200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."reports_actiontaken_enum" ADD VALUE IF NOT EXISTS 'user_restored'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enums cannot easily remove values; leaving empty down migration.
  }
}
