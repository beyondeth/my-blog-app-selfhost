import { MigrationInterface, QueryRunner } from "typeorm";

/** Allow crashed dispatchers to safely return processing events to the queue. */
export class AddOutboxProcessingLease1804500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      DROP COLUMN IF EXISTS "lockedAt"
    `);
  }
}
