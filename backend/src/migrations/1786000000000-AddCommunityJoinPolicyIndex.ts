import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommunityJoinPolicyIndex1786000000000
  implements MigrationInterface
{
  name = "AddCommunityJoinPolicyIndex1786000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_communities_public_join_policy
        ON communities ("isPublic", "joinPolicy")
        WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_communities_public_join_policy`,
    );
  }
}
