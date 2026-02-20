import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSoftDeleteAndRetentionFields1759500870345
  implements MigrationInterface
{
  name = "AddSoftDeleteAndRetentionFields1759500870345";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookmarks" DROP CONSTRAINT IF EXISTS "FK_bookmark_post"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookmarks" DROP CONSTRAINT IF EXISTS "FK_bookmark_user"`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'bookmarks'
            AND column_name = 'userId'
        ) THEN
          EXECUTE 'ALTER TABLE "bookmarks" RENAME COLUMN "userId" TO "user_id"';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'bookmarks'
            AND column_name = 'postId'
        ) THEN
          EXECUTE 'ALTER TABLE "bookmarks" RENAME COLUMN "postId" TO "post_id"';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'bookmarks'
            AND column_name = 'createdAt'
        ) THEN
          EXECUTE 'ALTER TABLE "bookmarks" RENAME COLUMN "createdAt" TO "created_at"';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`DROP INDEX "public"."idx_posts_search_vector"`);
    await queryRunner.query(`DROP INDEX "public"."idx_posts_published_search"`);
    await queryRunner.query(`DROP INDEX "public"."idx_posts_indexed_at"`);
    await queryRunner.query(
      `CREATE TYPE "public"."user_deletion_logs_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_deletion_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "email" character varying NOT NULL, "username" character varying, "deletedAt" TIMESTAMP NOT NULL, "deletionResult" jsonb, "status" "public"."user_deletion_logs_status_enum" NOT NULL DEFAULT 'pending', "failureReason" text, "retryCount" integer NOT NULL DEFAULT '0', "lastRetryAt" TIMESTAMP, "completedAt" TIMESTAMP, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d4d7610107e487d48701eda2092" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2cbf30f291c2acd976cb5c10ed" ON "user_deletion_logs" ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a207714ade734f4f17e0c6ac75" ON "user_deletion_logs" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8e76a1d16f4aa988051368f5a" ON "user_deletion_logs" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."email_approvals_type_enum" AS ENUM('DATA_RETENTION_NOTICE', 'ACCOUNT_DELETION_NOTICE', 'DORMANT_ACCOUNT_NOTICE', 'MARKETING', 'SYSTEM_UPDATE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."email_approvals_status_enum" AS ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "email_approvals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."email_approvals_type_enum" NOT NULL, "targetCount" integer NOT NULL DEFAULT '0', "targetUserIds" jsonb, "status" "public"."email_approvals_status_enum" NOT NULL DEFAULT 'PENDING_APPROVAL', "scheduledAt" TIMESTAMP NOT NULL, "template" character varying NOT NULL, "metadata" jsonb NOT NULL, "approvedBy" uuid, "approvedAt" TIMESTAMP, "approvalNote" text, "sentCount" integer NOT NULL DEFAULT '0', "failedCount" integer NOT NULL DEFAULT '0', "sentAt" TIMESTAMP, "errors" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a51a3e527f7b18edcb1a4516bda" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9aad522c9e873fef199da595ee" ON "email_approvals" ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9ba84ed44e989d53ab309495b3" ON "email_approvals" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_de105444b03363c393b20efa25" ON "email_approvals" ("status") `,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isDeleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "scheduledDeletionAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "dataRetentionNotifiedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "dataRetentionYears" integer NOT NULL DEFAULT '3'`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "senderDeletedAt" TIMESTAMP WITH TIME ZONE`,
    );
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
    await queryRunner.query(
      `ALTER TABLE "bookmarks" ADD CONSTRAINT "UQ_e1decdf2b2a71358f5acd16f586" UNIQUE ("user_id", "post_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_58a0fbaee65cd8959a870ee678c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_51f539993ae903a927bd44dbe49" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_approvals" ADD CONSTRAINT "FK_f4e1556a9b2e8bc12a20cd78f49" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_approvals" DROP CONSTRAINT "FK_f4e1556a9b2e8bc12a20cd78f49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookmarks" DROP CONSTRAINT "FK_51f539993ae903a927bd44dbe49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookmarks" DROP CONSTRAINT "FK_58a0fbaee65cd8959a870ee678c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookmarks" DROP CONSTRAINT "UQ_e1decdf2b2a71358f5acd16f586"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_history_status_enum_old" AS ENUM('failed', 'partially_refunded', 'pending', 'refunded', 'succeeded')`,
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
      `ALTER TABLE "messages" DROP COLUMN "senderDeletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "dataRetentionYears"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "dataRetentionNotifiedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "scheduledDeletionAt"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isDeleted"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_de105444b03363c393b20efa25"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9ba84ed44e989d53ab309495b3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9aad522c9e873fef199da595ee"`,
    );
    await queryRunner.query(`DROP TABLE "email_approvals"`);
    await queryRunner.query(`DROP TYPE "public"."email_approvals_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."email_approvals_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f8e76a1d16f4aa988051368f5a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a207714ade734f4f17e0c6ac75"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2cbf30f291c2acd976cb5c10ed"`,
    );
    await queryRunner.query(`DROP TABLE "user_deletion_logs"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_deletion_logs_status_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_posts_indexed_at" ON "posts" ("indexed_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_posts_published_search" ON "posts" ("isPublished", "publishedAt") WHERE ("isPublished" = true)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_posts_search_vector" ON "posts" ("search_vector") `,
    );
    await queryRunner.query(
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'bookmarks'
            AND column_name = 'user_id'
        ) THEN
          EXECUTE 'ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_bookmark_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION';
        ELSE
          EXECUTE 'ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_bookmark_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION';
        END IF;
      END
      $$;`,
    );
    await queryRunner.query(
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'bookmarks'
            AND column_name = 'post_id'
        ) THEN
          EXECUTE 'ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_bookmark_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION';
        ELSE
          EXECUTE 'ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_bookmark_post" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION';
        END IF;
      END
      $$;`,
    );
  }
}
