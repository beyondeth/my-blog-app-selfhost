import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxReliabilityAndIdempotency1805000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "maxAttempts" integer NOT NULL DEFAULT 10`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "deadLetteredAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "dedupeKey" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_outbox_events_type_dedupe" ON "outbox_events" ("eventType", "dedupeKey") WHERE "dedupeKey" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "idempotency_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scope" character varying(200) NOT NULL,
        "key" character varying(200) NOT NULL,
        "requestHash" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL,
        "result" jsonb,
        "lockedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_idempotency_records_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_idempotency_records_scope_key" UNIQUE ("scope", "key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_idempotency_records_expiresAt" ON "idempotency_records" ("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_idempotency_records_expiresAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_records"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_outbox_events_type_dedupe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "dedupeKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "deadLetteredAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "maxAttempts"`,
    );
  }
}
