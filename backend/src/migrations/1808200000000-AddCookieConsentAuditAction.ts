import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCookieConsentAuditAction1808200000000 implements MigrationInterface {
  name = "AddCookieConsentAuditAction1808200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(`
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'audit_logs_action_enum'
        AND e.enumlabel = 'cookie_consent_updated'
    `);

    if (result.length === 0) {
      await queryRunner.query(
        `ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE 'cookie_consent_updated'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Postgres enum values are not removed in down migrations for safety.
  }
}
