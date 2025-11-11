import { MigrationInterface, QueryRunner } from "typeorm";

export class OptimizeDeletedPostsIndex1770000000000 implements MigrationInterface {
  name = 'OptimizeDeletedPostsIndex1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 기존 인덱스 확인 후 생성
    const indexExists = await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE indexname = 'idx_posts_deleted_published_publishedat'
    `);

    if (indexExists.length === 0) {
      // 삭제된 포스트 처리를 위한 복합 인덱스 생성
      await queryRunner.query(`
        CREATE INDEX idx_posts_deleted_published_publishedat
        ON posts("isDeleted", "isPublished", "publishedAt" DESC);
      `);
      console.log('✅ Created idx_posts_deleted_published_publishedat');
    }

    // 홈 피드 조회 최적화를 위한 인덱스
    const homeFeedIndexExists = await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE indexname = 'idx_posts_home_feed'
    `);

    if (homeFeedIndexExists.length === 0) {
      await queryRunner.query(`
        CREATE INDEX idx_posts_home_feed
        ON posts("isPublished", "status", "isDeleted", "publishedAt" DESC)
        WHERE "isPublished" = true AND status = 'published';
      `);
      console.log('✅ Created idx_posts_home_feed');
    }

    // 블로그별 포스트 조회 최적화 인덱스
    const blogPostsIndexExists = await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE indexname = 'idx_posts_blog_published_deleted'
    `);

    if (blogPostsIndexExists.length === 0) {
      await queryRunner.query(`
        CREATE INDEX idx_posts_blog_published_deleted
        ON posts("blogId", "isDeleted", "publishedAt" DESC)
        WHERE "isDeleted" = false;
      `);
      console.log('✅ Created idx_posts_blog_published_deleted');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 생성된 인덱스 삭제
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_deleted_published_publishedat`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_home_feed`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_blog_published_deleted`);
    console.log('✅ Dropped optimization indexes');
  }
}