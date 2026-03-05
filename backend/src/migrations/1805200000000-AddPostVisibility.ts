import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostVisibility1805200000000 implements MigrationInterface {
  name = "AddPostVisibility1805200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) nullable 컬럼 추가 (zero-downtime)
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN IF NOT EXISTS "visibility" character varying(20)
    `);

    // 2) 기존 데이터 백필
    await queryRunner.query(`
      UPDATE "posts"
      SET "visibility" = 'public'
      WHERE "visibility" IS NULL
    `);

    // 3) 제약/기본값 적용
    await queryRunner.query(`
      ALTER TABLE "posts"
      ALTER COLUMN "visibility" SET DEFAULT 'public'
    `);

    await queryRunner.query(`
      ALTER TABLE "posts"
      ALTER COLUMN "visibility" SET NOT NULL
    `);

    // 4) 조회 성능 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_visibility"
      ON "posts" ("visibility")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_public_feed_visibility"
      ON "posts" ("publishedAt" DESC, "id" DESC)
      WHERE "isPublished" = true
        AND "isDeleted" = false
        AND "status" = 'published'
        AND "visibility" = 'public'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_blog_public_visibility"
      ON "posts" ("blogId", "publishedAt" DESC, "id" DESC)
      WHERE "isPublished" = true
        AND "isDeleted" = false
        AND "status" = 'published'
        AND "visibility" = 'public'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_posts_blog_public_visibility"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_posts_public_feed_visibility"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_visibility"`);

    await queryRunner.query(`
      ALTER TABLE "posts"
      DROP COLUMN IF EXISTS "visibility"
    `);
  }
}
