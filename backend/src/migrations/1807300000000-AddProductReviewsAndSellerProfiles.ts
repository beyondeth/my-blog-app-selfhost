import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 4: 마케팅 기능 — 리뷰/평점 + 판매자 프로필
 *
 * - product_reviews: 구매 인증 리뷰 (별점 1-5, UNIQUE per buyer+product)
 * - seller_profiles: 판매자 신뢰 지표 (1:1 User)
 * - product_details 확장: averageRating, reviewCount
 * - 기존 판매자 데이터로 seller_profiles 시드
 */
export class AddProductReviewsAndSellerProfiles1807300000000
  implements MigrationInterface
{
  name = "AddProductReviewsAndSellerProfiles1807300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. product_reviews 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "productPostId" uuid NOT NULL,
        "buyerId" uuid,
        "orderId" uuid NOT NULL,
        "rating" integer NOT NULL,
        "content" text,
        "images" jsonb DEFAULT '[]',
        "isVerifiedPurchase" boolean NOT NULL DEFAULT true,
        "sellerResponse" text,
        "sellerRespondedAt" timestamptz,
        "isHidden" boolean NOT NULL DEFAULT false,
        "hiddenReason" text,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_product_reviews_post" FOREIGN KEY ("productPostId")
          REFERENCES "posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_reviews_buyer" FOREIGN KEY ("buyerId")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_product_reviews_order" FOREIGN KEY ("orderId")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_product_reviews_rating"
          CHECK ("rating" >= 1 AND "rating" <= 5)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_reviews_buyer_product"
      ON "product_reviews" ("productPostId", "buyerId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_reviews_product_date"
      ON "product_reviews" ("productPostId", "createdAt" DESC)
      WHERE "isHidden" = false
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_reviews_buyer"
      ON "product_reviews" ("buyerId")
    `);

    // 2. seller_profiles 테이블
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "seller_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL UNIQUE,
        "isVerified" boolean NOT NULL DEFAULT false,
        "verifiedAt" timestamptz,
        "verificationLevel" varchar(20) NOT NULL DEFAULT 'none',
        "totalSales" integer NOT NULL DEFAULT 0,
        "totalProducts" integer NOT NULL DEFAULT 0,
        "averageRating" decimal(3,2) NOT NULL DEFAULT 0.00,
        "totalReviews" integer NOT NULL DEFAULT 0,
        "averageResponseTimeMinutes" integer,
        "responseRate" decimal(5,2),
        "displayBadges" jsonb DEFAULT '[]',
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_seller_profiles_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_seller_profiles_rating"
      ON "seller_profiles" ("averageRating" DESC) WHERE "totalSales" > 0
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_seller_profiles_sales"
      ON "seller_profiles" ("totalSales" DESC)
    `);

    // 3. product_details 확장
    await queryRunner.query(`
      ALTER TABLE "product_details"
      ADD COLUMN IF NOT EXISTS "averageRating" decimal(3,2) NOT NULL DEFAULT 0.00
    `);
    await queryRunner.query(`
      ALTER TABLE "product_details"
      ADD COLUMN IF NOT EXISTS "reviewCount" integer NOT NULL DEFAULT 0
    `);

    // 4. 기존 판매자 데이터로 seller_profiles 시드
    await queryRunner.query(`
      INSERT INTO "seller_profiles" ("userId", "totalSales", "totalProducts")
      SELECT DISTINCT p."authorId",
        COALESCE(sales."cnt", 0),
        COALESCE(products."cnt", 0)
      FROM "posts" p
      LEFT JOIN (
        SELECT "sellerId", COUNT(*) as "cnt"
        FROM "orders" WHERE "status" = 'paid' GROUP BY "sellerId"
      ) sales ON sales."sellerId" = p."authorId"
      LEFT JOIN (
        SELECT "authorId", COUNT(*) as "cnt"
        FROM "posts"
        WHERE "postType" = 'product' AND "isPublished" = true AND "isDeleted" = false
        GROUP BY "authorId"
      ) products ON products."authorId" = p."authorId"
      WHERE p."postType" = 'product'
        AND p."isPublished" = true
        AND p."isDeleted" = false
      ON CONFLICT ("userId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(
        `ALTER TABLE "product_details" DROP COLUMN IF EXISTS "reviewCount"`,
      );
      await queryRunner.query(
        `ALTER TABLE "product_details" DROP COLUMN IF EXISTS "averageRating"`,
      );
      await queryRunner.query(`DROP TABLE IF EXISTS "seller_profiles"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "product_reviews"`);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }
}
