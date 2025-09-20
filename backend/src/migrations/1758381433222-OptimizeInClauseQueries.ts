import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeInClauseQueries1758381433222 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // IN 절 쿼리 최적화를 위한 인덱스 생성
    // ID와 isPublished를 함께 인덱싱하여 IN 절과 WHERE 절을 동시에 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_id_published"
      ON "posts"("id", "isPublished")
      WHERE "isPublished" = true
    `);

    // 블로그 테이블의 isPublic 인덱스 (JOIN 최적화)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_blogs_id_public"
      ON "blogs"("id", "isPublic")
      WHERE "isPublic" = true
    `);

    // posts 테이블의 blogId와 isPublished 복합 인덱스 (JOIN 시 필터링 최적화)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_blog_published"
      ON "posts"("blogId", "isPublished")
      WHERE "isPublished" = true
    `);

    // posts 테이블의 authorId 인덱스 강화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_author_published"
      ON "posts"("authorId", "isPublished")
      WHERE "isPublished" = true
    `);

    // 통계 업데이트 - 쿼리 플래너가 최적의 실행 계획을 선택하도록 도움
    await queryRunner.query(`ANALYZE "posts"`);
    await queryRunner.query(`ANALYZE "blogs"`);
    await queryRunner.query(`ANALYZE "users"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 제거
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_id_published"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_blogs_id_public"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_blog_published"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_author_published"`);
  }
}