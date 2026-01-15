import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 약관 동의 관련 필드 추가
 *
 * @description
 * - termsAcceptedAt: 이용약관 동의 시각
 * - privacyAcceptedAt: 개인정보처리방침 동의 시각
 * - marketingOptIn: 마케팅 수신 동의
 * - marketingOptInAt: 마케팅 동의 시각
 * - newsletterOptIn: 뉴스레터 수신 동의
 */
export class AddTermsAcceptanceFields1761100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // termsAcceptedAt 컬럼 추가 (기존 유저는 현재 시각으로 설정)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP DEFAULT NOW()
    `);

    // privacyAcceptedAt 컬럼 추가 (기존 유저는 현재 시각으로 설정)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP DEFAULT NOW()
    `);

    // marketingOptIn 컬럼 추가 (기본값 false)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN DEFAULT false
    `);

    // marketingOptInAt 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "marketingOptInAt" TIMESTAMP
    `);

    // newsletterOptIn 컬럼 추가 (기본값 false)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "newsletterOptIn" BOOLEAN DEFAULT false
    `);

    // 기존 유저들의 약관 동의일을 계정 생성일로 설정
    await queryRunner.query(`
      UPDATE "users"
      SET "termsAcceptedAt" = "createdAt",
          "privacyAcceptedAt" = "createdAt"
      WHERE "termsAcceptedAt" IS NULL
         OR "privacyAcceptedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백 시 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "newsletterOptIn"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "marketingOptInAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "marketingOptIn"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "privacyAcceptedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "termsAcceptedAt"
    `);
  }
}
