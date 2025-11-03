import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 누락된 account_settings 컬럼 추가 마이그레이션
 *
 * Phase 1-2-3 리팩토링에서 AccountSettings 엔티티에는 선언되어 있었지만
 * 마이그레이션에서 누락된 컬럼들을 추가합니다.
 *
 * 추가 컬럼:
 * - refreshTokenExpiresAt: Refresh Token 만료 시각
 * - primaryIdentityId: Multi-Identity Architecture의 기본 인증 수단 ID
 * - scheduledDeletionAt: 완전 삭제 예정일 (GDPR 준수)
 * - dataRetentionNotifiedAt: 개인정보 보유기간 만료 알림 발송일
 * - dataRetentionYears: 개인정보 보유기간 (년)
 */
export class AddMissingAccountSettingsColumns1760200000000 implements MigrationInterface {
    name = 'AddMissingAccountSettingsColumns1760200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. refreshTokenExpiresAt 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE "account_settings"
            ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP
        `);

        // 2. primaryIdentityId 컬럼 추가 (Multi-Identity Architecture)
        await queryRunner.query(`
            ALTER TABLE "account_settings"
            ADD COLUMN "primaryIdentityId" uuid
        `);

        // 3. scheduledDeletionAt 컬럼 추가 (GDPR 준수)
        await queryRunner.query(`
            ALTER TABLE "account_settings"
            ADD COLUMN "scheduledDeletionAt" TIMESTAMP
        `);

        // 4. dataRetentionNotifiedAt 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE "account_settings"
            ADD COLUMN "dataRetentionNotifiedAt" TIMESTAMP
        `);

        // 5. dataRetentionYears 컬럼 추가 (기본값 3년)
        await queryRunner.query(`
            ALTER TABLE "account_settings"
            ADD COLUMN "dataRetentionYears" integer NOT NULL DEFAULT 3
        `);

        // 6. 인덱스 추가 (성능 최적화)
        await queryRunner.query(`
            CREATE INDEX "IDX_account_settings_scheduledDeletionAt"
            ON "account_settings" ("scheduledDeletionAt")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_account_settings_primaryIdentityId"
            ON "account_settings" ("primaryIdentityId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 인덱스 제거
        await queryRunner.query(`DROP INDEX "public"."IDX_account_settings_primaryIdentityId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_account_settings_scheduledDeletionAt"`);

        // 컬럼 제거 (역순)
        await queryRunner.query(`ALTER TABLE "account_settings" DROP COLUMN "dataRetentionYears"`);
        await queryRunner.query(`ALTER TABLE "account_settings" DROP COLUMN "dataRetentionNotifiedAt"`);
        await queryRunner.query(`ALTER TABLE "account_settings" DROP COLUMN "scheduledDeletionAt"`);
        await queryRunner.query(`ALTER TABLE "account_settings" DROP COLUMN "primaryIdentityId"`);
        await queryRunner.query(`ALTER TABLE "account_settings" DROP COLUMN "refreshTokenExpiresAt"`);
    }
}
