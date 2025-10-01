import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeCacheWarmingQueries1759200000000 implements MigrationInterface {
  name = 'OptimizeCacheWarmingQueries1759200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 캐시 워밍 쿼리 최적화를 위한 인덱스 생성 시작...');

    // 1. 공개된 게시글의 최신순 조회 최적화
    // WHERE isPublished = true ORDER BY createdAt DESC 패턴
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_published_created_desc"
      ON "posts" ("isPublished", "createdAt" DESC)
      WHERE "isPublished" = true
    `);
    console.log('✅ idx_posts_published_created_desc 인덱스 생성 완료');

    // 2. 공개된 게시글의 publishedAt 기준 최신순 조회 최적화
    // WHERE isPublished = true ORDER BY publishedAt DESC 패턴 (실제 쿼리에서 사용)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_published_publishedat_desc"
      ON "posts" ("isPublished", "publishedAt" DESC)
      WHERE "isPublished" = true
    `);
    console.log('✅ idx_posts_published_publishedat_desc 인덱스 생성 완료');

    // 3. 블로그별 공개 게시글 조회 최적화
    // WHERE blogId = ? AND isPublished = true ORDER BY publishedAt DESC 패턴
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_blog_published_publishedat"
      ON "posts" ("blogId", "isPublished", "publishedAt" DESC)
      WHERE "isPublished" = true
    `);
    console.log('✅ idx_posts_blog_published_publishedat 인덱스 생성 완료');

    // 4. 블로그 공개 상태 인덱스
    // WHERE isPublic = true 빠른 필터링
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_blogs_ispublic"
      ON "blogs" ("isPublic")
      WHERE "isPublic" = true
    `);
    console.log('✅ idx_blogs_ispublic 인덱스 생성 완료');

    // 5. UUID IN 절 최적화를 위한 해시 인덱스
    // WHERE id IN (uuid1, uuid2, ...) 패턴 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_id_hash"
      ON "posts" USING hash ("id")
    `);
    console.log('✅ idx_posts_id_hash 인덱스 생성 완료');

    // 6. 작성자별 게시글 조회 최적화 (이미 존재하지만 개선)
    // WHERE authorId = ? ORDER BY publishedAt DESC 패턴
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_author_publishedat"
      ON "posts" ("authorId", "publishedAt" DESC)
    `);
    console.log('✅ idx_posts_author_publishedat 인덱스 생성 완료');

    // 7. 복합 조건 최적화: 공개 블로그의 공개 게시글
    // posts와 blogs 조인 후 WHERE blog.isPublic = true AND post.isPublished = true
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_blogid_for_join"
      ON "posts" ("blogId", "isPublished")
      WHERE "isPublished" = true
    `);
    console.log('✅ idx_posts_blogid_for_join 인덱스 생성 완료');

    // 8. 캐시 키 생성을 위한 카운트 쿼리 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_published_count"
      ON "posts" ("isPublished")
      WHERE "isPublished" = true
    `);
    console.log('✅ idx_posts_published_count 인덱스 생성 완료');

    // 통계 업데이트 (트랜잭션 밖에서 실행되어야 하지만 시도)
    try {
      await queryRunner.query(`ANALYZE "posts"`);
      await queryRunner.query(`ANALYZE "blogs"`);
      await queryRunner.query(`ANALYZE "users"`);
      console.log('📊 테이블 통계 업데이트 완료');
    } catch (error) {
      console.log('⚠️ 통계 업데이트 실패 (수동 실행 필요): ANALYZE posts, blogs, users');
    }

    console.log('🎉 모든 인덱스 생성 완료!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 캐시 워밍 최적화 인덱스 제거 중...');

    // 생성한 인덱스들 제거
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_published_created_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_published_publishedat_desc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_blog_published_publishedat"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_blogs_ispublic"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_id_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_author_publishedat"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_blogid_for_join"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_published_count"`);

    console.log('✅ 모든 인덱스 제거 완료');
  }
}