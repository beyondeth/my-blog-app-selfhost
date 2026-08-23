import { MigrationInterface, QueryRunner } from "typeorm";

/** Preserve the HTTP correlation ID across transactional outbox delivery. */
export class AddOutboxRequestContext1805100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ADD COLUMN IF NOT EXISTS "requestId" character varying(128)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outbox_events_requestId" ON "outbox_events" ("requestId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_outbox_events_requestId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "requestId"`,
    );
  }
}
