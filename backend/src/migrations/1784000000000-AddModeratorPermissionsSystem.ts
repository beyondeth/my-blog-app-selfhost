import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 모더레이터 권한 시스템 마이그레이션 (Reddit 스타일)
 *
 * 변경 사항:
 * 1. community_members 테이블에 permissions 컬럼 추가 (simple-array)
 * 2. community_members 테이블에 moderatorOrder 컬럼 추가 (int, nullable)
 * 3. community_members 테이블에 promotedAt 컬럼 추가 (timestamp, nullable)
 * 4. 기존 데이터 마이그레이션:
 *    - OWNER → permissions: ['all'], moderatorOrder: 1
 *    - ADMIN → permissions: ['all'], moderatorOrder: 2+
 *    - MODERATOR → permissions: ['posts', 'members'], moderatorOrder: N+
 *    - MEMBER → permissions: null, moderatorOrder: null
 *
 * 설계 원칙:
 * - 기존 role enum 유지 (하위 호환성)
 * - 새로운 권한 시스템 병행 사용
 * - Top-Mod 개념 도입 (moderatorOrder = 1)
 */
export class AddModeratorPermissionsSystem1784000000000
  implements MigrationInterface
{
  name = "AddModeratorPermissionsSystem1784000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // 1. permissions 컬럼 추가 (text 타입, simple-array 저장)
    // =====================================================
    await queryRunner.query(`
      ALTER TABLE "community_members"
      ADD COLUMN "permissions" TEXT
    `);

    // =====================================================
    // 2. moderatorOrder 컬럼 추가 (운영진 순서)
    // =====================================================
    await queryRunner.query(`
      ALTER TABLE "community_members"
      ADD COLUMN "moderatorOrder" INTEGER
    `);

    // moderatorOrder 인덱스 추가
    await queryRunner.query(`
      CREATE INDEX "idx_community_members_moderator_order"
      ON "community_members"("communityId", "moderatorOrder")
      WHERE "moderatorOrder" IS NOT NULL
    `);

    // =====================================================
    // 3. promotedAt 컬럼 추가 (운영진 승격 시간)
    // =====================================================
    await queryRunner.query(`
      ALTER TABLE "community_members"
      ADD COLUMN "promotedAt" TIMESTAMPTZ
    `);

    // =====================================================
    // 4. 기존 데이터 마이그레이션
    // =====================================================

    // 4.1. OWNER → permissions: 'all', moderatorOrder: 1
    await queryRunner.query(`
      UPDATE "community_members"
      SET
        "permissions" = 'all',
        "moderatorOrder" = 1,
        "promotedAt" = "joinedAt"
      WHERE "role" = 'owner'
    `);

    // 4.2. ADMIN → permissions: 'all', moderatorOrder: 2부터 순차적
    // 커뮤니티별로 ADMIN들에게 순서 부여
    await queryRunner.query(`
      WITH admin_ranked AS (
        SELECT
          id,
          "communityId",
          ROW_NUMBER() OVER (PARTITION BY "communityId" ORDER BY "joinedAt") + 1 as new_order
        FROM "community_members"
        WHERE "role" = 'admin'
      )
      UPDATE "community_members" cm
      SET
        "permissions" = 'all',
        "moderatorOrder" = ar.new_order,
        "promotedAt" = cm."joinedAt"
      FROM admin_ranked ar
      WHERE cm.id = ar.id
    `);

    // 4.3. MODERATOR → permissions: 'posts,members', moderatorOrder: ADMIN 다음 순서부터
    // 각 커뮤니티에서 가장 높은 moderatorOrder 값을 찾아서 그 다음부터 부여
    await queryRunner.query(`
      WITH max_order AS (
        SELECT "communityId", COALESCE(MAX("moderatorOrder"), 0) as max_ord
        FROM "community_members"
        WHERE "moderatorOrder" IS NOT NULL
        GROUP BY "communityId"
      ),
      moderator_ranked AS (
        SELECT
          cm.id,
          cm."communityId",
          COALESCE(mo.max_ord, 0) + ROW_NUMBER() OVER (PARTITION BY cm."communityId" ORDER BY cm."joinedAt") as new_order
        FROM "community_members" cm
        LEFT JOIN max_order mo ON cm."communityId" = mo."communityId"
        WHERE cm."role" = 'moderator'
      )
      UPDATE "community_members" cm
      SET
        "permissions" = 'posts,members',
        "moderatorOrder" = mr.new_order,
        "promotedAt" = cm."joinedAt"
      FROM moderator_ranked mr
      WHERE cm.id = mr.id
    `);

    // 4.4. MEMBER → permissions: null, moderatorOrder: null (기본값이므로 별도 처리 불필요)
    // 이미 null이므로 생략
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_community_members_moderator_order"
    `);

    // 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE "community_members"
      DROP COLUMN IF EXISTS "promotedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "community_members"
      DROP COLUMN IF EXISTS "moderatorOrder"
    `);

    await queryRunner.query(`
      ALTER TABLE "community_members"
      DROP COLUMN IF EXISTS "permissions"
    `);
  }
}
