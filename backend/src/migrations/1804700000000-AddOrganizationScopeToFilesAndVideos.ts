import { MigrationInterface, QueryRunner } from "typeorm";

/** Carry the tenant boundary through file contexts and video metadata. */
export class AddOrganizationScopeToFilesAndVideos1804700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "file_contexts" ADD COLUMN IF NOT EXISTS "organizationId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "organizationId" uuid`,
    );

    await queryRunner.query(`
      UPDATE "file_contexts" c
      SET "organizationId" = f."organizationId"
      FROM "files" f
      WHERE f."context_id" = c."id"
        AND c."organizationId" IS NULL
        AND f."organizationId" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "videos" v
      SET "organizationId" = o."id"
      FROM "organizations" o
      WHERE v."user_id" = o."ownerId"
        AND o."isPersonal" = true
        AND v."organizationId" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "file_contexts"
      ADD CONSTRAINT "FK_file_contexts_organization"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD CONSTRAINT "FK_videos_organization"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_file_contexts_organizationId" ON "file_contexts" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_videos_organizationId" ON "videos" ("organizationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_videos_organizationId"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_file_contexts_organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "FK_videos_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_contexts" DROP CONSTRAINT IF EXISTS "FK_file_contexts_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" DROP COLUMN IF EXISTS "organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_contexts" DROP COLUMN IF EXISTS "organizationId"`,
    );
  }
}
