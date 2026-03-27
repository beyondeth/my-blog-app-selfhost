import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 토스페이먼츠 빌링키 테이블 생성
 *
 * 정기결제용 카드 토큰(billingKey) 저장
 * 사용자당 여러 빌링키 보유 가능 (카드 여러 장)
 */
export class AddTossBillingKeyEntity1805700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "toss_billing_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "customerKey" character varying(255) NOT NULL,
        "billingKey" character varying(255) NOT NULL,
        "cardCompany" character varying(50),
        "cardNumber" character varying(50),
        "cardType" character varying(20),
        "isActive" boolean NOT NULL DEFAULT true,
        "authenticatedAt" timestamp,
        "metadata" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_toss_billing_keys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_toss_billing_keys_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_toss_billing_keys_userId" ON "toss_billing_keys" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_toss_billing_keys_customerKey" ON "toss_billing_keys" ("customerKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_toss_billing_keys_isActive" ON "toss_billing_keys" ("isActive")`,
    );

    // PaymentHistory에 type 컬럼 추가 (구독/마켓플레이스 구분)
    const hasTypeColumn = await queryRunner.hasColumn(
      "payment_history",
      "type",
    );
    if (!hasTypeColumn) {
      await queryRunner.query(
        `ALTER TABLE "payment_history" ADD "type" character varying(50) NOT NULL DEFAULT 'subscription'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_history" DROP COLUMN IF EXISTS "type"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "toss_billing_keys"`);
  }
}
