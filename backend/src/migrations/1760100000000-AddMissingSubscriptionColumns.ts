import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 누락된 user_subscriptions 컬럼 추가 마이그레이션
 *
 * Phase 1-2-3 리팩토링에서 Subscription 엔티티에는 선언되어 있었지만
 * 마이그레이션에서 누락된 컬럼들을 추가합니다.
 *
 * 추가 컬럼:
 * - trialEndDate: 무료 체험 종료일
 * - paymentCustomerId: 범용 결제 시스템 Customer ID
 * - paymentSubscriptionId: 범용 결제 시스템 Subscription ID
 * - paymentMethodId: 저장된 결제 수단 ID
 * - cancelAtPeriodEnd: 기간 만료 시 취소 여부
 */
export class AddMissingSubscriptionColumns1760100000000
  implements MigrationInterface
{
  name = "AddMissingSubscriptionColumns1760100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. trialEndDate 컬럼 추가
    await queryRunner.query(`
            ALTER TABLE "user_subscriptions"
            ADD COLUMN "trialEndDate" TIMESTAMP
        `);

    // 2. paymentCustomerId 컬럼 추가 (범용 결제 시스템)
    await queryRunner.query(`
            ALTER TABLE "user_subscriptions"
            ADD COLUMN "paymentCustomerId" character varying(255)
        `);

    // 3. paymentSubscriptionId 컬럼 추가
    await queryRunner.query(`
            ALTER TABLE "user_subscriptions"
            ADD COLUMN "paymentSubscriptionId" character varying(255)
        `);

    // 4. paymentMethodId 컬럼 추가 (저장된 결제 수단)
    await queryRunner.query(`
            ALTER TABLE "user_subscriptions"
            ADD COLUMN "paymentMethodId" character varying(255)
        `);

    // 5. cancelAtPeriodEnd 컬럼 추가
    await queryRunner.query(`
            ALTER TABLE "user_subscriptions"
            ADD COLUMN "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false
        `);

    // 6. 인덱스 추가 (성능 최적화)
    await queryRunner.query(`
            CREATE INDEX "IDX_user_subscriptions_trialEndDate"
            ON "user_subscriptions" ("trialEndDate")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_user_subscriptions_cancelAtPeriodEnd"
            ON "user_subscriptions" ("cancelAtPeriodEnd")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 제거
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_subscriptions_cancelAtPeriodEnd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_subscriptions_trialEndDate"`,
    );

    // 컬럼 제거 (역순)
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP COLUMN "cancelAtPeriodEnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP COLUMN "paymentMethodId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP COLUMN "paymentSubscriptionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP COLUMN "paymentCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP COLUMN "trialEndDate"`,
    );
  }
}
