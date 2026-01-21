import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 커뮤니티 게시물 노출 플래그 추가
 *
 * - isPostDiscoverable: 커뮤니티 포스트의 글로벌 피드/검색 노출 여부
 * - private 커뮤니티는 공개/게시물 노출을 기본 false로 정리
 */
export class AddCommunityDiscoverability1794300000000
  implements MigrationInterface
{
  name = "AddCommunityDiscoverability1794300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "communities"
            ADD COLUMN IF NOT EXISTS "isPostDiscoverable" BOOLEAN NOT NULL DEFAULT true
        `);

    await queryRunner.query(`
            UPDATE "communities"
            SET "isPublic" = false,
                "isPostDiscoverable" = false
            WHERE "joinPolicy" = 'private'
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_communities_discoverable"
            ON "communities" ("isPublic", "isPostDiscoverable", "joinPolicy")
            WHERE ("deletedAt" IS NULL)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_communities_discoverable"
        `);
    await queryRunner.query(`
            ALTER TABLE "communities"
            DROP COLUMN IF EXISTS "isPostDiscoverable"
        `);
  }
}
