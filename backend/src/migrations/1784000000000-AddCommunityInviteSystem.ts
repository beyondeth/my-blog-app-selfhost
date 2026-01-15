import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 커뮤니티 초대 시스템 마이그레이션
 *
 * @description
 * 1. community_invites 테이블 생성 (초대 링크/코드 관리)
 * 2. community_members 테이블에 승인/초대 관련 필드 추가
 *    - applicationMessage: 가입 신청서 (RESTRICTED 커뮤니티용)
 *    - inviteId: 초대를 통한 가입인 경우 초대 ID
 *    - approvedById: 가입 승인한 모더레이터 ID
 *    - approvedAt: 가입 승인 시간
 */
export class AddCommunityInviteSystem1784000000000
  implements MigrationInterface
{
  name = "AddCommunityInviteSystem1784000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. community_invites 테이블 생성
    await queryRunner.query(`
      CREATE TABLE "community_invites" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "createdById" UUID NOT NULL,
        "token" VARCHAR(64) NOT NULL UNIQUE,
        "maxUses" INTEGER NOT NULL DEFAULT 0,
        "useCount" INTEGER NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_community_invites_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_invites_creator" FOREIGN KEY ("createdById")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // community_invites 인덱스
    await queryRunner.query(`
      CREATE INDEX "idx_community_invites_community" ON "community_invites"("communityId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_community_invites_token" ON "community_invites"("token")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_community_invites_active_expires" ON "community_invites"("isActive", "expiresAt")
        WHERE "isActive" = true
    `);

    // 2. community_members 테이블에 필드 추가
    // 가입 신청서 (RESTRICTED 커뮤니티용)
    await queryRunner.query(`
      ALTER TABLE "community_members"
      ADD COLUMN "applicationMessage" TEXT
    `);

    // 초대 ID (초대를 통한 가입인 경우)
    await queryRunner.query(`
      ALTER TABLE "community_members"
      ADD COLUMN "inviteId" UUID,
      ADD CONSTRAINT "fk_community_members_invite" FOREIGN KEY ("inviteId")
        REFERENCES "community_invites"("id") ON DELETE SET NULL
    `);

    // 승인한 모더레이터 ID
    await queryRunner.query(`
      ALTER TABLE "community_members"
      ADD COLUMN "approvedById" UUID,
      ADD CONSTRAINT "fk_community_members_approver" FOREIGN KEY ("approvedById")
        REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // 승인 시간
    await queryRunner.query(`
      ALTER TABLE "community_members"
      ADD COLUMN "approvedAt" TIMESTAMPTZ
    `);

    // pending 멤버 조회용 인덱스 (승인 대기 목록)
    await queryRunner.query(`
      CREATE INDEX "idx_community_members_pending" ON "community_members"("communityId", "status", "joinedAt")
        WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_community_members_pending"
    `);

    // community_members 필드 삭제
    await queryRunner.query(`
      ALTER TABLE "community_members"
      DROP CONSTRAINT IF EXISTS "fk_community_members_approver",
      DROP COLUMN IF EXISTS "approvedAt",
      DROP COLUMN IF EXISTS "approvedById"
    `);

    await queryRunner.query(`
      ALTER TABLE "community_members"
      DROP CONSTRAINT IF EXISTS "fk_community_members_invite",
      DROP COLUMN IF EXISTS "inviteId"
    `);

    await queryRunner.query(`
      ALTER TABLE "community_members"
      DROP COLUMN IF EXISTS "applicationMessage"
    `);

    // community_invites 테이블 삭제
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_community_invites_active_expires"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_community_invites_token"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_community_invites_community"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "community_invites"
    `);
  }
}
