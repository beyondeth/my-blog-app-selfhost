import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMcpPostToResourceTypeEnum1759346700756 implements MigrationInterface {
    name = 'AddMcpPostToResourceTypeEnum1759346700756'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_blogs_ispublic"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_blog_published_publishedat"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_id_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_author_publishedat"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_published_created_desc"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_published_publishedat_desc"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_blogid_for_join"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_published_count"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_history_status_enum" RENAME TO "payment_history_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_history_status_enum" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum" USING "status"::"text"::"public"."payment_history_status_enum"`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."payment_history_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "usage_tracking" DROP CONSTRAINT "UQ_cc3efac4d1c6bcf24d6b8fa50fe"`);
        await queryRunner.query(`ALTER TYPE "public"."usage_tracking_resourcetype_enum" RENAME TO "usage_tracking_resourcetype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."usage_tracking_resourcetype_enum" AS ENUM('post', 'mcp_post', 'blog', 'storage', 'views', 'api_calls', 'ai_credits')`);
        await queryRunner.query(`ALTER TABLE "usage_tracking" ALTER COLUMN "resourceType" TYPE "public"."usage_tracking_resourcetype_enum" USING "resourceType"::"text"::"public"."usage_tracking_resourcetype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."usage_tracking_resourcetype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "usage_tracking" ADD CONSTRAINT "UQ_cc3efac4d1c6bcf24d6b8fa50fe" UNIQUE ("userId", "resourceType", "period")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usage_tracking" DROP CONSTRAINT "UQ_cc3efac4d1c6bcf24d6b8fa50fe"`);
        await queryRunner.query(`CREATE TYPE "public"."usage_tracking_resourcetype_enum_old" AS ENUM('ai_credits', 'api_calls', 'posts', 'storage', 'views')`);
        await queryRunner.query(`ALTER TABLE "usage_tracking" ALTER COLUMN "resourceType" TYPE "public"."usage_tracking_resourcetype_enum_old" USING "resourceType"::"text"::"public"."usage_tracking_resourcetype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."usage_tracking_resourcetype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."usage_tracking_resourcetype_enum_old" RENAME TO "usage_tracking_resourcetype_enum"`);
        await queryRunner.query(`ALTER TABLE "usage_tracking" ADD CONSTRAINT "UQ_cc3efac4d1c6bcf24d6b8fa50fe" UNIQUE ("userId", "resourceType", "period")`);
        await queryRunner.query(`CREATE TYPE "public"."payment_history_status_enum_old" AS ENUM('failed', 'partially_refunded', 'pending', 'refunded', 'succeeded')`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum_old" USING "status"::"text"::"public"."payment_history_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."payment_history_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_history_status_enum_old" RENAME TO "payment_history_status_enum"`);
        await queryRunner.query(`CREATE INDEX "idx_posts_published_count" ON "posts" ("isPublished") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_posts_blogid_for_join" ON "posts" ("blogId", "isPublished") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_posts_published_publishedat_desc" ON "posts" ("isPublished", "publishedAt") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_posts_published_created_desc" ON "posts" ("createdAt", "isPublished") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_posts_author_publishedat" ON "posts" ("authorId", "publishedAt") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_id_hash" ON "posts" ("id") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_blog_published_publishedat" ON "posts" ("blogId", "isPublished", "publishedAt") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_blogs_ispublic" ON "blogs" ("isPublic") WHERE ("isPublic" = true)`);
    }

}
