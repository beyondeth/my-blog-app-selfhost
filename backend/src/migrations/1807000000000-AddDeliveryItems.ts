import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 1: 콘텐츠 접근 모델 분리
 *
 * 3-Layer 콘텐츠 모델 도입:
 *   Layer 1 (공개): descriptionHtml — 마케팅 페이지
 *   Layer 2 (미리보기): previewContent — 기존 유지
 *   Layer 3 (구매자 전용): delivery_items — 실제 배송 콘텐츠
 *
 * 기존 데이터 마이그레이션:
 *   - deliveryType='content' 상품: Post.content → DeliveryItem(content_html)
 *   - deliveryType='file' 상품: digitalDeliveryUrl → DeliveryItem(file)
 *   - 모든 상품: Post.content → descriptionHtml (마케팅용 복사)
 */
export class AddDeliveryItems1807000000000 implements MigrationInterface {
  name = "AddDeliveryItems1807000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. delivery_items 테이블 생성
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "delivery_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "productDetailId" uuid NOT NULL,
        "type" varchar(20) NOT NULL DEFAULT 'content_html',
        "label" varchar(200) NOT NULL DEFAULT '본문 콘텐츠',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "fileKey" varchar(500),
        "fileName" varchar(300),
        "fileSize" bigint,
        "mimeType" varchar(100),
        "contentHtml" text,
        "externalUrl" varchar(1000),
        "metadata" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_delivery_items_product_detail" FOREIGN KEY ("productDetailId")
          REFERENCES "product_details"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_delivery_items_type"
          CHECK ("type" IN ('content_html', 'file', 'external_link'))
      )
    `);

    // 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_delivery_items_product_active"
      ON "delivery_items" ("productDetailId") WHERE "isActive" = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_delivery_items_file_key"
      ON "delivery_items" ("fileKey") WHERE "fileKey" IS NOT NULL
    `);

    // 2. product_details 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "product_details"
      ADD COLUMN IF NOT EXISTS "descriptionHtml" text
    `);
    await queryRunner.query(`
      ALTER TABLE "product_details"
      ADD COLUMN IF NOT EXISTS "deliveryItemCount" integer NOT NULL DEFAULT 0
    `);

    // 3. 기존 데이터 마이그레이션: deliveryType='content' → DeliveryItem(content_html)
    await queryRunner.query(`
      INSERT INTO "delivery_items" ("productDetailId", "type", "label", "sortOrder", "contentHtml")
      SELECT pd."id", 'content_html', '본문 콘텐츠', 0, p."content"
      FROM "product_details" pd
      JOIN "posts" p ON p."id" = pd."postId"
      WHERE pd."deliveryType" = 'content'
        AND p."postType" = 'product'
        AND p."content" IS NOT NULL
    `);

    // 4. 기존 데이터 마이그레이션: deliveryType='file' → DeliveryItem(file)
    await queryRunner.query(`
      INSERT INTO "delivery_items" ("productDetailId", "type", "label", "sortOrder", "fileKey")
      SELECT pd."id", 'file', 'Digital Download', 0, pd."digitalDeliveryUrl"
      FROM "product_details" pd
      WHERE pd."deliveryType" = 'file'
        AND pd."digitalDeliveryUrl" IS NOT NULL
    `);

    // 5. descriptionHtml 초기화 (Post.content를 마케팅 설명으로 복사)
    await queryRunner.query(`
      UPDATE "product_details" SET "descriptionHtml" = (
        SELECT p."content" FROM "posts" p WHERE p."id" = "product_details"."postId"
      )
      WHERE "descriptionHtml" IS NULL
    `);

    // 6. deliveryItemCount 업데이트
    await queryRunner.query(`
      UPDATE "product_details" SET "deliveryItemCount" = (
        SELECT COUNT(*) FROM "delivery_items" di
        WHERE di."productDetailId" = "product_details"."id"
          AND di."isActive" = true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(
        `ALTER TABLE "product_details" DROP COLUMN IF EXISTS "deliveryItemCount"`,
      );
      await queryRunner.query(
        `ALTER TABLE "product_details" DROP COLUMN IF EXISTS "descriptionHtml"`,
      );
      await queryRunner.query(`DROP TABLE IF EXISTS "delivery_items"`);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }
}
