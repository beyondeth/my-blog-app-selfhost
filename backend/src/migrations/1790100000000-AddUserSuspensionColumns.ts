import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSuspensionColumns1790100000000
  implements MigrationInterface
{
  name = "AddUserSuspensionColumns1790100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "suspension_until" TIMESTAMP NULL,
      ADD COLUMN "suspension_reason" TEXT NULL,
      ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN "ban_reason" TEXT NULL,
      ADD COLUMN "banned_at" TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "banned_at",
      DROP COLUMN IF EXISTS "ban_reason",
      DROP COLUMN IF EXISTS "is_banned",
      DROP COLUMN IF EXISTS "suspension_reason",
      DROP COLUMN IF EXISTS "suspension_until"
    `);
  }
}
