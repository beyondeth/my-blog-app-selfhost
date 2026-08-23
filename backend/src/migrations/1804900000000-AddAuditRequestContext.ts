import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditRequestContext1804900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of [
      "refresh_token_reuse",
      "organization_access_denied",
      "internal_auth_failed",
      "outbox_dead_lettered",
    ]) {
      await queryRunner.query(
        `ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "requestId" character varying(128)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_requestId" ON "audit_logs" ("requestId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_requestId"`);
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "requestId"`,
    );
  }
}
