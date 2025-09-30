import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSubscriptionFields1759091000000 implements MigrationInterface {
    name = 'AddUserSubscriptionFields1759091000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // users 테이블에 구독 관련 필드 추가
        // subscriptionTier: 구독 티어 (free, starter, pro)
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_subscriptiontier_enum') THEN
                    CREATE TYPE "users_subscriptiontier_enum" AS ENUM('free', 'starter', 'pro');
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "subscriptionTier" "users_subscriptiontier_enum" DEFAULT 'free'
        `);

        // subscriptionStatus: 구독 상태 (active, cancelled, past_due, expired, trialing)
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_subscriptionstatus_enum') THEN
                    CREATE TYPE "users_subscriptionstatus_enum" AS ENUM('active', 'cancelled', 'past_due', 'expired', 'trialing');
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "subscriptionStatus" "users_subscriptionstatus_enum"
        `);

        // subscriptionStartDate: 구독 시작일
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "subscriptionStartDate" TIMESTAMP
        `);

        // subscriptionEndDate: 구독 종료일
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "subscriptionEndDate" TIMESTAMP
        `);

        // trialEndDate: 무료 체험 종료일
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "trialEndDate" TIMESTAMP
        `);

        // paymentCustomerId: 결제 시스템의 Customer ID
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "paymentCustomerId" character varying
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 컬럼 삭제
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "paymentCustomerId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "trialEndDate"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "subscriptionEndDate"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "subscriptionStartDate"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "subscriptionStatus"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "subscriptionTier"`);

        // enum 타입 삭제
        await queryRunner.query(`DROP TYPE IF EXISTS "users_subscriptionstatus_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "users_subscriptiontier_enum"`);
    }
}