import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 커뮤니티 잠금 필드 추가
 *
 * @description
 * - 커뮤니티 폭주 대응을 위해 communities 테이블에 잠금 상태 컬럼을 추가합니다.
 */
export class AddCommunityLockColumns1789000000000
  implements MigrationInterface
{
  name = "AddCommunityLockColumns1789000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communities"
      ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "communities"
      ADD COLUMN "locked_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "communities"
      ADD COLUMN "locked_by_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "communities"
      ADD CONSTRAINT "FK_communities_locked_by_id_users"
      FOREIGN KEY ("locked_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "communities"
      DROP CONSTRAINT IF EXISTS "FK_communities_locked_by_id_users"
    `);

    await queryRunner.query(`
      ALTER TABLE "communities"
      DROP COLUMN IF EXISTS "locked_by_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "communities"
      DROP COLUMN IF EXISTS "locked_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "communities"
      DROP COLUMN IF EXISTS "is_locked"
    `);
  }
}
