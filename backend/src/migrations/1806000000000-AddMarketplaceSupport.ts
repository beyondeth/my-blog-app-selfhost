import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 마켓플레이스 지원 마이그레이션
 *
 * 변경 사항:
 * 1. posts 테이블에 postType 컬럼 추가 (기존 데이터는 'blog')
 * 2. product_details 테이블 생성 (1:1 with Post, 상품 전용 정보)
 * 3. orders 테이블 생성 (구매 기록, 멱등성 + 중복 구매 방지)
 * 4. Partial Index 적용 (쿼리 패턴 기반 최적화)
 */
export class AddMarketplaceSupport1806000000000
  implements MigrationInterface
{
  name = "AddMarketplaceSupport1806000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. posts 테이블에 postType 컬럼 추가 ──
    await queryRunner.query(`
      ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "postType" varchar(20) NOT NULL DEFAULT 'blog'
    `);

    // postType 단일 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_postType"
      ON "posts" ("postType")
    `);

    // Partial Index: product 타입 마켓플레이스 피드용
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_marketplace_feed"
      ON "posts" ("postType", "isPublished", "isDeleted", "createdAt" DESC)
      WHERE "postType" = 'product'
    `);

    // Partial Index: 블로그별 상품 목록 (판매탭)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_posts_blog_products"
      ON "posts" ("blogId", "postType", "createdAt" DESC)
      WHERE "postType" = 'product'
    `);

    // ── 2. product_details 테이블 ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_details" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "postId" uuid NOT NULL UNIQUE,
        "price" integer NOT NULL CHECK ("price" >= 100),
        "currency" varchar(3) NOT NULL DEFAULT 'KRW',
        "productCategory" varchar(50) NOT NULL DEFAULT 'others',
        "previewContent" text,
        "deliveryType" varchar(20) NOT NULL DEFAULT 'content',
        "digitalDeliveryUrl" varchar(500),
        "salesCount" integer NOT NULL DEFAULT 0,
        "totalRevenue" integer NOT NULL DEFAULT 0,
        "commissionRate" decimal(5,2) NOT NULL DEFAULT 20.00,
        "isActive" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_product_details_post" FOREIGN KEY ("postId")
          REFERENCES "posts"("id") ON DELETE CASCADE
      )
    `);

    // Partial Index: 활성 상품만
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_details_category_active"
      ON "product_details" ("productCategory", "isActive")
      WHERE "isActive" = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_details_price_active"
      ON "product_details" ("price", "isActive")
      WHERE "isActive" = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_details_sales"
      ON "product_details" ("salesCount" DESC)
      WHERE "isActive" = true
    `);

    // ── 3. orders 테이블 ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" varchar(64) NOT NULL UNIQUE,
        "buyerId" uuid,
        "sellerId" uuid,
        "productPostId" uuid,
        "amount" integer NOT NULL,
        "platformFee" integer NOT NULL DEFAULT 0,
        "sellerRevenue" integer NOT NULL DEFAULT 0,
        "currency" varchar(3) NOT NULL DEFAULT 'KRW',
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "paymentKey" varchar(255) UNIQUE,
        "receiptUrl" text,
        "refundedAt" timestamptz,
        "refundReason" text,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_orders_buyer" FOREIGN KEY ("buyerId")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_orders_seller" FOREIGN KEY ("sellerId")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_orders_product" FOREIGN KEY ("productPostId")
          REFERENCES "posts"("id") ON DELETE SET NULL
      )
    `);

    // 동일 상품 중복 구매 방지 (활성 주문만 — 환불/취소 후 재구매 허용)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_buyer_product"
      ON "orders" ("buyerId", "productPostId")
      WHERE "status" NOT IN ('cancelled', 'refunded')
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_buyerId"
      ON "orders" ("buyerId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_sellerId"
      ON "orders" ("sellerId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_status"
      ON "orders" ("status")
    `);

    // Partial Index: 구매 여부 확인 (가장 빈번한 쿼리)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_buyer_product_paid"
      ON "orders" ("buyerId", "productPostId", "status")
      WHERE "status" = 'paid'
    `);

    // 판매자 주문 목록
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_seller_created"
      ON "orders" ("sellerId", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // orders 관련
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_seller_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_buyer_product_paid"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_sellerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_buyerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_buyer_product"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);

    // product_details 관련
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_details_sales"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_details_price_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_details_category_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_details"`);

    // posts.postType 관련
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_blog_products"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_marketplace_feed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_postType"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "postType"`);
  }
}
