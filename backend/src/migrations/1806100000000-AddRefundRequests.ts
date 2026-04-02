import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 환불 요청 테이블 마이그레이션
 */
export class AddRefundRequests1806100000000 implements MigrationInterface {
  name = "AddRefundRequests1806100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refund_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "buyerId" uuid,
        "sellerId" uuid,
        "reason" text NOT NULL,
        "reasonCategory" varchar(30) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "sellerResponse" text,
        "respondedAt" timestamptz,
        "processedAt" timestamptz,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_refund_requests_order" FOREIGN KEY ("orderId")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_refund_requests_buyer" FOREIGN KEY ("buyerId")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_refund_requests_seller" FOREIGN KEY ("sellerId")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // 주문당 1건의 환불 요청만 허용
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refund_requests_orderId"
      ON "refund_requests" ("orderId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refund_requests_buyerId"
      ON "refund_requests" ("buyerId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refund_requests_sellerId"
      ON "refund_requests" ("sellerId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refund_requests_status"
      ON "refund_requests" ("status")
    `);

    // 자동 승인용: pending 상태 + 생성일 기준 조회
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refund_requests_pending_created"
      ON "refund_requests" ("status", "createdAt")
      WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_requests_pending_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_requests_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_requests_sellerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_requests_buyerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_requests_orderId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refund_requests"`);
  }
}
