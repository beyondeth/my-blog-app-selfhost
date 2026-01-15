import { MigrationInterface, QueryRunner } from "typeorm";

export class OptimizePostsTableIndexes1758378537468
  implements MigrationInterface
{
  name = "OptimizePostsTableIndexes1758378537468";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 홈화면 쿼리 최적화를 위한 복합 인덱스
    // isPublished = true인 게시글을 publishedAt DESC로 정렬할 때 사용
    // Partial 인덱스를 사용하여 isPublished = true인 레코드만 인덱싱
    await queryRunner.query(`
            CREATE INDEX "idx_posts_published_at_desc"
            ON "posts"("isPublished", "publishedAt" DESC)
            WHERE "isPublished" = true
        `);

    // 블로그별 게시글 조회 최적화를 위한 복합 인덱스
    // 특정 블로그의 게시글을 조회할 때 사용
    await queryRunner.query(`
            CREATE INDEX "idx_posts_blog_published"
            ON "posts"("blogId", "isPublished", "publishedAt" DESC)
        `);

    // post_files 테이블의 조인 성능 개선을 위한 인덱스
    // posts와 files 테이블 조인 시 성능 향상
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_post_files_post_id"
            ON "post_files"("postId")
        `);

    // 블로그 테이블의 공개 여부 조회 최적화
    // isPublic 필터링 성능 향상
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_blogs_is_public"
            ON "blogs"("isPublic")
            WHERE "isPublic" = true
        `);

    // 작성자별 게시글 조회 최적화
    // 이미 존재하는 인덱스가 있지만 publishedAt 추가로 성능 향상
    await queryRunner.query(`
            CREATE INDEX "idx_posts_author_published"
            ON "posts"("authorId", "isPublished", "publishedAt" DESC)
        `);

    // 카테고리별 게시글 조회 최적화 (기존 인덱스 개선)
    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_c81be77ac4b528ea4f2c94fcfb"
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_posts_category_published"
            ON "posts"("category", "isPublished", "publishedAt" DESC)
            WHERE "category" IS NOT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 생성한 인덱스들을 역순으로 제거
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_posts_category_published"`,
    );

    // 기존 카테고리 인덱스 복원
    await queryRunner.query(`
            CREATE INDEX "IDX_c81be77ac4b528ea4f2c94fcfb"
            ON "posts"("category")
        `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_posts_author_published"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_blogs_is_public"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_post_files_post_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_blog_published"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_posts_published_at_desc"`,
    );
  }
}
