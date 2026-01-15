import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * ADMIN 역할 추가 마이그레이션
 *
 * 변경사항:
 * - community_role_enum에 'admin' 역할 추가
 * - 기존 owner, moderator, member에 admin 추가하여 4단계 역할 시스템 구성
 *
 * 역할 계층:
 * - owner (100): 최고 권한 - 커뮤니티 삭제, 소유권 이전
 * - admin (75): 부방장 - 설정 변경, 모더레이터 관리
 * - moderator (50): 모더레이터 - 콘텐츠 관리, 사용자 밴
 * - member (10): 일반 멤버 - 읽기/쓰기
 */
export class AddAdminRoleToCommunity1782000000000
  implements MigrationInterface
{
  name = "AddAdminRoleToCommunity1782000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL에서 ENUM에 새 값을 추가하는 방법
    // ALTER TYPE으로 새 값 추가 (PostgreSQL 9.1+)
    await queryRunner.query(`
      ALTER TYPE "community_role_enum" ADD VALUE IF NOT EXISTS 'admin' AFTER 'owner'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL에서 ENUM 값 제거는 복잡함
    // admin 역할을 가진 멤버를 moderator로 변경 후 타입 재생성
    // 주의: 이 롤백은 데이터 손실 가능성 있음

    // 1. admin 역할을 moderator로 변경
    await queryRunner.query(`
      UPDATE "community_members" SET "role" = 'moderator' WHERE "role" = 'admin'
    `);

    // 2. 기존 타입 이름 변경
    await queryRunner.query(`
      ALTER TYPE "community_role_enum" RENAME TO "community_role_enum_old"
    `);

    // 3. admin 없이 새 타입 생성
    await queryRunner.query(`
      CREATE TYPE "community_role_enum" AS ENUM ('owner', 'moderator', 'member')
    `);

    // 4. 컬럼 타입 변경
    await queryRunner.query(`
      ALTER TABLE "community_members"
        ALTER COLUMN "role" TYPE "community_role_enum"
        USING "role"::text::"community_role_enum"
    `);

    // 5. 기존 타입 삭제
    await queryRunner.query(`
      DROP TYPE "community_role_enum_old"
    `);
  }
}
