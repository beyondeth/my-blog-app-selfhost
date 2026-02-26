import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePopularPostSnapshots1805000000000
  implements MigrationInterface
{
  name = "CreatePopularPostSnapshots1805000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "popular_post_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshotAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "period" character varying(10) NOT NULL,
        "sourceType" character varying(10) NOT NULL,
        "postId" uuid NOT NULL,
        "score" integer NOT NULL,
        "rank" integer NOT NULL,
        "metaJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_popular_post_snapshots_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_popular_snapshots_source_period_rank"
      ON "popular_post_snapshots" ("sourceType", "period", "rank")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_popular_snapshots_source_period_post"
      ON "popular_post_snapshots" ("sourceType", "period", "postId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_popular_snapshots_source_period_post"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_popular_snapshots_source_period_rank"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "popular_post_snapshots"`);
  }
}
