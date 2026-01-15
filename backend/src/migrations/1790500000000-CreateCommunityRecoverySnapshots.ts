import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 커뮤니티 복구 스냅샷 테이블 생성
 *
 * - community_recovery_snapshots
 *   · 커뮤니티 게시물/댓글/설정 JSON 스냅샷 저장
 *   · Admin이 폭주/삭제 사고 시 롤백 근거로 활용
 */
export class CreateCommunityRecoverySnapshots1790500000000
  implements MigrationInterface
{
  name = "CreateCommunityRecoverySnapshots1790500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "community_recovery_snapshots" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "createdById" UUID,
        "reason" VARCHAR(120) NOT NULL,
        "postsSnapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "commentsSnapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "settingsSnapshot" JSONB NOT NULL,
        "metadata" JSONB,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_crs_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_crs_created_by" FOREIGN KEY ("createdById")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_crs_community_created_at"
      ON "community_recovery_snapshots" ("communityId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_crs_created_by"
      ON "community_recovery_snapshots" ("createdById")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_crs_created_by"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_crs_community_created_at"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "community_recovery_snapshots"`,
    );
  }
}
