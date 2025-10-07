import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEditorPickToPost1759838167248 implements MigrationInterface {
    name = 'AddEditorPickToPost1759838167248'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_comments_post"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_search_published"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_blog"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_published_date"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_search_vector"`);
        await queryRunner.query(`DROP INDEX "public"."idx_posts_author"`);
        await queryRunner.query(`ALTER TABLE "posts" ADD "isEditorPick" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "posts" ADD "editorPickedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TYPE "public"."payment_history_status_enum" RENAME TO "payment_history_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_history_status_enum" AS ENUM('pending', 'succeeded', 'succeeded', 'failed', 'refunded', 'partially_refunded')`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum" USING "status"::"text"::"public"."payment_history_status_enum"`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."payment_history_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_c63b5acddc521623c55af299ac" ON "posts" ("isEditorPick", "editorPickedAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c63b5acddc521623c55af299ac"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_history_status_enum_old" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum_old" USING "status"::"text"::"public"."payment_history_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."payment_history_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_history_status_enum_old" RENAME TO "payment_history_status_enum"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "editorPickedAt"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "isEditorPick"`);
        await queryRunner.query(`CREATE INDEX "idx_posts_author" ON "posts" ("authorId", "createdAt", "isPublished") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_search_vector" ON "posts" ("search_vector") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_published_date" ON "posts" ("isPublished", "publishedAt") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_posts_blog" ON "posts" ("blogId", "isPublished", "publishedAt") `);
        await queryRunner.query(`CREATE INDEX "idx_posts_search_published" ON "posts" ("search_vector") WHERE ("isPublished" = true)`);
        await queryRunner.query(`CREATE INDEX "idx_comments_post" ON "comments" ("createdAt", "isDeleted", "postId") `);
    }

}
