import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostStatusFields1760443427308 implements MigrationInterface {
    name = 'AddPostStatusFields1760443427308'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_comments_post"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_search_published"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_blog"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_published_date"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_search_vector"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_author"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_POSTS_EDITOR_PICK"`);
        await queryRunner.query(`ALTER TABLE "posts" ADD "status" character varying NOT NULL DEFAULT 'published'`);
        await queryRunner.query(`ALTER TABLE "posts" ADD "processing_error" text`);
        await queryRunner.query(`ALTER TABLE "posts" ADD "processing_completed_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "tagList" SET NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."payment_history_status_enum" RENAME TO "payment_history_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_history_status_enum" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum" USING "status"::"text"::"public"."payment_history_status_enum"`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."payment_history_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_a69d9e2ae78ef7d100f8317ae0" ON "posts" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_c63b5acddc521623c55af299ac" ON "posts" ("isEditorPick", "editorPickedAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c63b5acddc521623c55af299ac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a69d9e2ae78ef7d100f8317ae0"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_history_status_enum_old" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum_old" USING "status"::"text"::"public"."payment_history_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."payment_history_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_history_status_enum_old" RENAME TO "payment_history_status_enum"`);
        await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "tagList" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "processing_completed_at"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "processing_error"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE INDEX "IDX_POSTS_EDITOR_PICK" ON "posts" ("editorPickedAt", "isEditorPick") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_author" ON "posts" ("authorId", "createdAt", "isPublished") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_search_vector" ON "posts" ("search_vector") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_published_date" ON "posts" ("isPublished", "publishedAt") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_posts_blog" ON "posts" ("blogId", "isPublished", "publishedAt") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_search_published" ON "posts" ("search_vector") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_comments_post" ON "comments" ("createdAt", "isDeleted", "postId") `);
    }

}
