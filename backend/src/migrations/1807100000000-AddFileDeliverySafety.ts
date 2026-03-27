import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 2: 파일 배송 + 안전성
 *
 * - download_logs: per-item 다운로드 추적
 * - file_quarantine: S3 격리 → 검증 플로우
 * - delivery_items 확장: quarantineStatus, verifiedAt
 */
export class AddFileDeliverySafety1807100000000 implements MigrationInterface {
  name = "AddFileDeliverySafety1807100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. download_logs 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "download_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL,
        "deliveryItemId" uuid NOT NULL,
        "buyerId" uuid,
        "downloadedAt" timestamptz NOT NULL DEFAULT now(),
        "ipAddress" varchar(150),
        "userAgent" text,
        "metadata" jsonb,
        CONSTRAINT "FK_download_logs_order" FOREIGN KEY ("orderId")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_download_logs_delivery_item" FOREIGN KEY ("deliveryItemId")
          REFERENCES "delivery_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_download_logs_buyer" FOREIGN KEY ("buyerId")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_download_logs_order_item"
      ON "download_logs" ("orderId", "deliveryItemId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_download_logs_buyer"
      ON "download_logs" ("buyerId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_download_logs_item_date"
      ON "download_logs" ("deliveryItemId", "downloadedAt" DESC)
    `);

    // 2. file_quarantine 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_quarantine" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "deliveryItemId" uuid,
        "uploaderId" uuid NOT NULL,
        "quarantineKey" varchar(500) NOT NULL,
        "verifiedKey" varchar(500),
        "originalName" varchar(300) NOT NULL,
        "mimeType" varchar(100) NOT NULL,
        "fileSize" bigint NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "magicBytesValid" boolean,
        "scanResult" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_file_quarantine_delivery_item" FOREIGN KEY ("deliveryItemId")
          REFERENCES "delivery_items"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_file_quarantine_uploader" FOREIGN KEY ("uploaderId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_file_quarantine_status"
          CHECK ("status" IN ('pending', 'scanning', 'clean', 'infected', 'failed'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_file_quarantine_status"
      ON "file_quarantine" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_file_quarantine_pending"
      ON "file_quarantine" ("status", "createdAt")
      WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_file_quarantine_uploader"
      ON "file_quarantine" ("uploaderId")
    `);

    // 3. delivery_items 확장 컬럼
    await queryRunner.query(`
      ALTER TABLE "delivery_items"
      ADD COLUMN IF NOT EXISTS "quarantineStatus" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "delivery_items"
      ADD COLUMN IF NOT EXISTS "verifiedAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(
        `ALTER TABLE "delivery_items" DROP COLUMN IF EXISTS "verifiedAt"`,
      );
      await queryRunner.query(
        `ALTER TABLE "delivery_items" DROP COLUMN IF EXISTS "quarantineStatus"`,
      );
      await queryRunner.query(`DROP TABLE IF EXISTS "file_quarantine"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "download_logs"`);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }
}
