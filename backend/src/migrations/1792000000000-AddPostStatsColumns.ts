import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostStatsColumns1792000000000 implements MigrationInterface {
  name = "AddPostStatsColumns1792000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 컬럼 추가 (역정규화)
    // IF NOT EXISTS 체크가 있으면 좋겠지만 TypeORM raw query는 에러남.
    // 마이그레이션 실패했으면 롤백되었을 것이므로 바로 추가.
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "like_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "view_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "comment_count" integer NOT NULL DEFAULT '0'`,
    );

    // 2. 복합 인덱스 추가 (이름을 명확하게 지정)
    await queryRunner.query(
      `CREATE INDEX "IDX_posts_blog_like_count" ON "posts" ("blogId", "like_count" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_posts_blog_view_count" ON "posts" ("blogId", "view_count" DESC)`,
    );
    // createdAt은 이미 있을 수 있으므로 생략하거나 필요 시 추가. 여기서는 Optimization Plan에 따라 추가.
    // await queryRunner.query(`CREATE INDEX "IDX_posts_blog_created_at" ON "posts" ("blogId", "createdAt" DESC)`);

    // 3. 데이터 동기화 (기존 post_stats 데이터를 posts로 복사)
    await queryRunner.query(`
            UPDATE "posts" p
            SET
                "like_count" = COALESCE(ps."likeCount", 0),
                "view_count" = COALESCE(ps."viewCount", 0),
                "comment_count" = COALESCE(ps."commentCount", 0)
            FROM "post_stats" ps
            WHERE p.id = ps."postId"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_blog_view_count"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_blog_like_count"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "comment_count"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "view_count"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "like_count"`);
  }
}
