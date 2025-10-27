import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserConsentFields1757000000001 implements MigrationInterface {
    name = 'AddUserConsentFields1757000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 약관 동의 관련 필드 추가
        await queryRunner.query(`ALTER TABLE "users" ADD "termsAcceptedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "privacyAcceptedAt" TIMESTAMP`);

        // 마케팅 동의 관련 필드 추가
        await queryRunner.query(`ALTER TABLE "users" ADD "marketingOptIn" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "marketingOptInAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "newsletterOptIn" boolean NOT NULL DEFAULT false`);

        // 보안 관련 필드 추가
        await queryRunner.query(`ALTER TABLE "users" ADD "loginAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "lockedUntil" TIMESTAMP`);

        // 인덱스 추가 (선택적)
        await queryRunner.query(`CREATE INDEX "IDX_users_marketingOptIn" ON "users" ("marketingOptIn")`);
        await queryRunner.query(`CREATE INDEX "IDX_users_newsletterOptIn" ON "users" ("newsletterOptIn")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 인덱스 제거
        await queryRunner.query(`DROP INDEX "public"."IDX_users_newsletterOptIn"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_marketingOptIn"`);

        // 필드 제거
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lockedUntil"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "loginAttempts"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "newsletterOptIn"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "marketingOptInAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "marketingOptIn"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "privacyAcceptedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "termsAcceptedAt"`);
    }
}