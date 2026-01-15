import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 팔로워/팔로잉 카운트 캐싱 필드 추가
 *
 * Phase 1: 실시간 COUNT 쿼리 제거를 위한 비정규화
 * - follower_count: 나를 팔로우하는 사람 수
 * - following_count: 내가 팔로우하는 사람 수
 * - CHECK 제약조건으로 음수 방지
 */
export class AddFollowCountsToUsers1799000000000 implements MigrationInterface {
  name = "AddFollowCountsToUsers1799000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 컬럼 추가 (기본값 0)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "follower_count" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "following_count" integer NOT NULL DEFAULT 0
    `);

    // 2. CHECK 제약조건 추가 (음수 방지)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "CHK_users_follower_count_non_negative"
      CHECK ("follower_count" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "CHK_users_following_count_non_negative"
      CHECK ("following_count" >= 0)
    `);

    // 3. 기존 데이터 마이그레이션 (현재 팔로우 관계에서 카운트 계산)
    await queryRunner.query(`
      UPDATE "users" u
      SET "follower_count" = (
        SELECT COUNT(*)::integer
        FROM "follows" f
        WHERE f."following_id" = u."id"
      )
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "following_count" = (
        SELECT COUNT(*)::integer
        FROM "follows" f
        WHERE f."follower_id" = u."id"
      )
    `);

    // 4. 인덱스 추가 (정렬/필터링 최적화)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_follower_count"
      ON "users" ("follower_count" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_following_count"
      ON "users" ("following_count" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_following_count"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_follower_count"
    `);

    // CHECK 제약조건 삭제
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT IF EXISTS "CHK_users_following_count_non_negative"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT IF EXISTS "CHK_users_follower_count_non_negative"
    `);

    // 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "following_count"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "follower_count"
    `);
  }
}
