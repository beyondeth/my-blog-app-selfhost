import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostStatusFields1760443427308 implements MigrationInterface {
  name = "AddPostStatusFields1760443427308";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 존재하지 않을 수 있는 인덱스들 DROP (IF EXISTS 처리)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_comments_post"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_posts_search_published"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_posts_blog"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_posts_published_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_posts_search_vector"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_posts_author"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_POSTS_EDITOR_PICK"`,
    );

    // 필드가 이미 존재할 수 있으므로 체크
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "status" character varying NOT NULL DEFAULT 'published'`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "processing_error" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "processing_completed_at" TIMESTAMP`,
    );

    // tagList NOT NULL 설정은 이미 되어있을 수 있으므로 체크 후 실행
    const hasColumn = await queryRunner.query(`
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'posts' AND column_name = 'tagList'
        `);
    if (hasColumn.length > 0 && hasColumn[0].is_nullable === "YES") {
      await queryRunner.query(
        `ALTER TABLE "posts" ALTER COLUMN "tagList" SET NOT NULL`,
      );
    }
    // ENUM 타입이 이미 변경되었는지 체크
    const enumCheck = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'payment_history_status_enum_old'
            ) as has_old_enum
        `);

    // 구버전 ENUM이 없다면 타입 변경이 필요
    if (!enumCheck[0].has_old_enum) {
      // 현재 ENUM 값 확인
      const currentEnum = await queryRunner.query(`
                SELECT enumlabel FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'payment_history_status_enum'
                ORDER BY e.enumsortorder
            `);

      const hasPartiallyRefunded = currentEnum.some(
        (row: any) => row.enumlabel === "partially_refunded",
      );

      // partially_refunded가 없으면 ENUM 타입 업데이트 필요
      if (!hasPartiallyRefunded) {
        await queryRunner.query(
          `ALTER TYPE "public"."payment_history_status_enum" RENAME TO "payment_history_status_enum_old"`,
        );
        await queryRunner.query(
          `CREATE TYPE "public"."payment_history_status_enum" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')`,
        );
        await queryRunner.query(
          `ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`,
        );
        await queryRunner.query(
          `ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum" USING "status"::"text"::"public"."payment_history_status_enum"`,
        );
        await queryRunner.query(
          `ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`,
        );
        await queryRunner.query(
          `DROP TYPE "public"."payment_history_status_enum_old"`,
        );
      }
    }

    // 인덱스가 이미 존재하는지 체크하고 생성
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_a69d9e2ae78ef7d100f8317ae0" ON "posts" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_c63b5acddc521623c55af299ac" ON "posts" ("isEditorPick", "editorPickedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c63b5acddc521623c55af299ac"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a69d9e2ae78ef7d100f8317ae0"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_history_status_enum_old" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" TYPE "public"."payment_history_status_enum_old" USING "status"::"text"::"public"."payment_history_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_history" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."payment_history_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payment_history_status_enum_old" RENAME TO "payment_history_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ALTER COLUMN "tagList" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" DROP COLUMN "processing_completed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" DROP COLUMN "processing_error"`,
    );
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "status"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_POSTS_EDITOR_PICK" ON "posts" ("editorPickedAt", "isEditorPick") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_posts_author" ON "posts" ("authorId", "createdAt", "isPublished") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_posts_search_vector" ON "posts" ("search_vector") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_posts_published_date" ON "posts" ("isPublished", "publishedAt") WHERE ("isPublished" = true)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_posts_blog" ON "posts" ("blogId", "isPublished", "publishedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_posts_search_published" ON "posts" ("search_vector") WHERE ("isPublished" = true)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_comments_post" ON "comments" ("createdAt", "isDeleted", "postId") `,
    );
  }
}
