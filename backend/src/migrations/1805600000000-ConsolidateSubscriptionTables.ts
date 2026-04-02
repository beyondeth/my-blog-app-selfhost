import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 구독 테이블 통합 마이그레이션
 *
 * user_subscriptions (users 모듈) → subscriptions (subscription 모듈)로 통합
 *
 * 변경 사항:
 * 1. subscriptions 테이블에 isTrialUsed 컬럼 추가
 * 2. user_subscriptions 데이터를 subscriptions로 이관
 *    - 이미 subscriptions에 해당 userId가 있으면 isTrialUsed만 업데이트
 *    - 없으면 새 레코드 삽입
 * 3. subscriptions.userId에 unique 제약 조건 추가 (1:1 보장)
 * 4. user_subscriptions 테이블 삭제
 */
export class ConsolidateSubscriptionTables1805600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. subscriptions 테이블에 isTrialUsed 컬럼 추가
    const hasIsTrialUsed = await queryRunner.hasColumn(
      "subscriptions",
      "isTrialUsed",
    );
    if (!hasIsTrialUsed) {
      await queryRunner.query(
        `ALTER TABLE "subscriptions" ADD "isTrialUsed" boolean NOT NULL DEFAULT false`,
      );
    }

    // 2. user_subscriptions 테이블이 존재하는지 확인
    const userSubsExists = await queryRunner.hasTable("user_subscriptions");
    if (userSubsExists) {
      // 2a. 이미 subscriptions에 존재하는 userId의 isTrialUsed 업데이트
      await queryRunner.query(`
        UPDATE "subscriptions" s
        SET "isTrialUsed" = us."isTrialUsed"
        FROM "user_subscriptions" us
        WHERE s."userId" = us."userId"
      `);

      // 2b. subscriptions에 없는 user_subscriptions 레코드를 삽입
      // (FREE 구독이라 subscriptions에는 없을 수 있음)
      await queryRunner.query(`
        INSERT INTO "subscriptions" (
          "id", "userId", "tier", "status", "startDate",
          "endDate", "trialEndDate", "isTrialUsed",
          "paymentCustomerId", "paymentSubscriptionId",
          "paymentMethodId", "autoRenew", "price", "currency"
        )
        SELECT
          us."id",
          us."userId",
          LOWER(COALESCE(us."subscriptionTier", 'free'))::subscriptions_tier_enum,
          LOWER(COALESCE(us."subscriptionStatus", 'active'))::subscriptions_status_enum,
          us."subscriptionStartDate",
          us."subscriptionEndDate",
          us."trialEndDate",
          us."isTrialUsed",
          us."paymentCustomerId",
          us."paymentSubscriptionId",
          us."paymentMethodId",
          NOT us."cancelAtPeriodEnd",
          0,
          'KRW'
        FROM "user_subscriptions" us
        WHERE us."userId" NOT IN (
          SELECT "userId" FROM "subscriptions" WHERE "userId" IS NOT NULL
        )
      `);

      // 3. user_subscriptions 테이블 삭제
      await queryRunner.query(`DROP TABLE IF EXISTS "user_subscriptions"`);
    }

    // 4. subscriptions.userId에 unique 제약 조건 추가 (기존 일반 인덱스 삭제 후)
    // 기존 non-unique 인덱스 확인 및 삭제
    const indices = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'subscriptions'
      AND indexdef LIKE '%userId%'
      AND indexdef NOT LIKE '%UNIQUE%'
    `);
    for (const idx of indices) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "${idx.indexname}"`,
      );
    }

    // unique 인덱스 추가 (이미 없는 경우에만)
    const uniqueIdx = await queryRunner.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'subscriptions'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%userId%'
    `);
    if (uniqueIdx.length === 0) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_subscriptions_userId_unique" ON "subscriptions" ("userId") WHERE "userId" IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // user_subscriptions 테이블 복원
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "user_subscriptions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "userId" uuid NOT NULL,
          "subscriptionTier" character varying NOT NULL DEFAULT 'free',
          "subscriptionStatus" character varying,
          "subscriptionStartDate" timestamp,
          "subscriptionEndDate" timestamp,
          "trialEndDate" timestamp,
          "isTrialUsed" boolean NOT NULL DEFAULT false,
          "paymentCustomerId" character varying(255),
          "stripeCustomerId" character varying(255),
          "paymentSubscriptionId" character varying(255),
          "paymentMethodId" character varying(255),
          "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_user_subscriptions" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_user_subscriptions_userId" UNIQUE ("userId")
        )
      `);

      // subscriptions에서 데이터를 복원
      await queryRunner.query(`
        INSERT INTO "user_subscriptions" (
          "id", "userId", "subscriptionTier", "subscriptionStatus",
          "subscriptionStartDate", "subscriptionEndDate",
          "trialEndDate", "isTrialUsed",
          "paymentCustomerId", "paymentSubscriptionId",
          "paymentMethodId", "cancelAtPeriodEnd"
        )
        SELECT
          "id", "userId", "tier", "status",
          "startDate", "endDate",
          "trialEndDate", "isTrialUsed",
          "paymentCustomerId", "paymentSubscriptionId",
          "paymentMethodId", NOT "autoRenew"
        FROM "subscriptions"
        WHERE "userId" IS NOT NULL
      `);

      // unique 인덱스 삭제, 일반 인덱스 복원
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_subscriptions_userId_unique"`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_subscriptions_userId" ON "subscriptions" ("userId")`,
      );

      // isTrialUsed 컬럼 삭제
      await queryRunner.query(
        `ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "isTrialUsed"`,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }
}
