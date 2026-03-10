import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGithubResourceFieldsToPostMetadata1805500000000
  implements MigrationInterface
{
  name = "AddGithubResourceFieldsToPostMetadata1805500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "post_metadata"
      ADD COLUMN IF NOT EXISTS "githubUrl" character varying(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "post_metadata"
      ADD COLUMN IF NOT EXISTS "githubDescription" character varying(240)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "post_metadata"
      DROP COLUMN IF EXISTS "githubDescription"
    `);
    await queryRunner.query(`
      ALTER TABLE "post_metadata"
      DROP COLUMN IF EXISTS "githubUrl"
    `);
  }
}
