import { MigrationInterface, QueryRunner } from "typeorm";

/** Prevent concurrent account initialization from creating two personal tenants. */
export class EnsurePersonalOrganizationUniqueness1804600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_organizations_personal_owner"
      ON "organizations" ("ownerId")
      WHERE "isPersonal" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_organizations_personal_owner"`,
    );
  }
}
