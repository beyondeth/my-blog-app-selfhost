import { MigrationInterface, QueryRunner } from "typeorm";

export class HashEmailVerificationCodes1804200000000
  implements MigrationInterface
{
  name = "HashEmailVerificationCodes1804200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_verifications" ADD "codeHash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_verifications" ALTER COLUMN "code" DROP NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_58575e75914e0b6832685808b1"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verifications_email_codeHash" ON "email_verifications" ("email", "codeHash")`,
    );

    // Pending legacy rows are expired so a plaintext code that was already in
    // the database cannot survive the migration. The verifier still supports
    // a legacy row created during a rolling deployment and upgrades it after
    // the user supplies the matching code; it never trusts client metadata.
    await queryRunner.query(
      `UPDATE "email_verifications" SET "expiresAt" = CURRENT_TIMESTAMP, "code" = NULL WHERE "codeHash" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*)::int AS "count" FROM "email_verifications" WHERE "code" IS NULL`,
    );
    const nullCodeCount = Number(rows[0]?.count || 0);

    // A hash cannot be converted back into the six-digit legacy code. Refuse
    // to perform a lossy rollback instead of writing a fake code or accepting
    // arbitrary client metadata.
    if (nullCodeCount > 0) {
      throw new Error(
        "Cannot safely revert HashEmailVerificationCodes: legacy plaintext codes were intentionally removed",
      );
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_email_verifications_email_codeHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_verifications" DROP COLUMN "codeHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_verifications" ALTER COLUMN "code" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58575e75914e0b6832685808b1" ON "email_verifications" ("email", "code")`,
    );
  }
}
