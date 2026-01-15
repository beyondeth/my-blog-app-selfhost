import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 성인 인증 필드 추가 마이그레이션
 *
 * 변경사항:
 * - profiles 테이블에 생년월일(birthdate) 필드 추가
 * - profiles 테이블에 성인 인증 상태(isAdultVerified) 필드 추가
 * - profiles 테이블에 성인 인증 시각(adultVerifiedAt) 필드 추가
 *
 * 용도:
 * - NSFW 커뮤니티 접근 시 18세 이상 확인
 * - Reddit 스타일 생년월일 입력 기반 자기 확인
 */
export class AddAdultVerificationFields1782000000001
  implements MigrationInterface
{
  name = "AddAdultVerificationFields1782000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 생년월일 필드 추가
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "birthdate" DATE
    `);

    // 2. 성인 인증 상태 필드 추가 (기본값: false)
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "isAdultVerified" BOOLEAN DEFAULT false
    `);

    // 3. 성인 인증 시각 필드 추가
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "adultVerifiedAt" TIMESTAMPTZ
    `);

    // 4. 성인 인증 사용자 조회 최적화를 위한 부분 인덱스
    // NSFW 커뮤니티 접근 시 인증 여부 빠른 확인
    await queryRunner.query(`
      CREATE INDEX "idx_profiles_adult_verified" ON "profiles"("isAdultVerified")
        WHERE "isAdultVerified" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_profiles_adult_verified"
    `);

    // 필드 삭제
    await queryRunner.query(`
      ALTER TABLE "profiles"
        DROP COLUMN IF EXISTS "adultVerifiedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "profiles"
        DROP COLUMN IF EXISTS "isAdultVerified"
    `);

    await queryRunner.query(`
      ALTER TABLE "profiles"
        DROP COLUMN IF EXISTS "birthdate"
    `);
  }
}
