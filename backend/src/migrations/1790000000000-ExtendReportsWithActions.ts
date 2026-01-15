import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendReportsWithActions1790000000000
  implements MigrationInterface
{
  name = "ExtendReportsWithActions1790000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reports"
      ADD COLUMN "community_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "reports"
      ADD COLUMN "reported_moderator_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "reports"
      ADD COLUMN "action_payload" jsonb NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_community_id" ON "reports" ("community_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_reported_moderator_id" ON "reports" ("reported_moderator_id")`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."reports_actiontaken_enum" ADD VALUE IF NOT EXISTS 'community_locked'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."reports_actiontaken_enum" ADD VALUE IF NOT EXISTS 'community_unlocked'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."reports_actiontaken_enum" ADD VALUE IF NOT EXISTS 'snapshot_captured'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."reports_actiontaken_enum" ADD VALUE IF NOT EXISTS 'moderator_removed'`,
    );

    await queryRunner.query(`
      CREATE TABLE "report_actions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "report_id" uuid NOT NULL,
        "action" varchar NOT NULL,
        "executor_id" uuid NOT NULL,
        "payload" jsonb,
        "result" jsonb,
        "status" varchar NOT NULL DEFAULT 'pending',
        "error_message" text,
        "created_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_report_actions_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_actions_report" ON "report_actions" ("report_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_actions_status" ON "report_actions" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_actions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_actions_report"`);
    await queryRunner.query('DROP TABLE IF EXISTS "report_actions"');

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reports_reported_moderator_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_community_id"`);
    await queryRunner.query(
      'ALTER TABLE "reports" DROP COLUMN IF EXISTS "action_payload"',
    );
    await queryRunner.query(
      'ALTER TABLE "reports" DROP COLUMN IF EXISTS "reported_moderator_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "reports" DROP COLUMN IF EXISTS "community_id"',
    );
  }
}
