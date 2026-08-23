import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOutboxEvents1804400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventType" character varying(120) NOT NULL,
        "aggregateType" character varying(80) NOT NULL,
        "aggregateId" uuid NOT NULL,
        "organizationId" uuid,
        "payload" jsonb NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "availableAt" TIMESTAMP NOT NULL DEFAULT now(),
        "processedAt" TIMESTAMP,
        "lastError" text,
        "occurredAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_outbox_events_organization" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_events_status_availableAt" ON "outbox_events" ("status", "availableAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_events_aggregate" ON "outbox_events" ("aggregateType", "aggregateId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outbox_events" DROP CONSTRAINT IF EXISTS "FK_outbox_events_organization"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_outbox_events_aggregate"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_outbox_events_status_availableAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);
  }
}
