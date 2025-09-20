import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatabaseOptimization1758384083910 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 1: 새로운 복합 인덱스 생성 (성능 최적화)
    // posts 테이블 - ID와 isPublished, blogId를 함께 검색하는 쿼리 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_id_ispublished_blogid
      ON posts(id, "isPublished", "blogId")
    `);

    // blogs 테이블 - ID와 isPublic을 함께 검색하는 쿼리 최적화
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_blogs_id_ispublic
      ON blogs(id, "isPublic")
    `);

    // Phase 2: 중복 인덱스 제거
    // conversations 테이블
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user1Id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversations_user1_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user2Id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversations_user2_id`);

    // messages 테이블
    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_conversation_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_conversation_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_sender_id`);

    // 기타 테이블 중복 인덱스
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_54b5dc2739f2dea57900933db6"`); // follows
    await queryRunner.query(`DROP INDEX IF EXISTS idx_post_files_post_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_a12706e0fd90132ab2ffa9b0b1"`); // post_files
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_6999d13aca25e33515210abaf1"`); // post_likes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_c5a322ad12a7bf95460c958e80"`); // posts - authorId 중복

    // Phase 3: 사용되지 않는 인덱스 제거 (posts 테이블)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_category_published`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_blog_published`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_id_published`);

    // Phase 4: 모니터링 확장 설치
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS hypopg`);

    // Phase 5: 통계 업데이트
    await queryRunner.query(`ANALYZE posts`);
    await queryRunner.query(`ANALYZE blogs`);
    await queryRunner.query(`ANALYZE users`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 새로 생성한 인덱스 제거
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_id_ispublished_blogid`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_blogs_id_ispublic`);

    // 삭제했던 인덱스들 복원 (필요한 경우)
    // conversations 테이블
    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_user1Id"
      ON conversations("user1Id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_user2Id"
      ON conversations("user2Id")
    `);

    // messages 테이블
    await queryRunner.query(`
      CREATE INDEX idx_messages_conversation_id
      ON messages("conversationId")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_messages_sender_id
      ON messages("senderId")
    `);

    // posts 테이블
    await queryRunner.query(`
      CREATE INDEX "IDX_c5a322ad12a7bf95460c958e80"
      ON posts("authorId")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_posts_category_published
      ON posts(category, "isPublished", "publishedAt" DESC)
      WHERE category IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_posts_blog_published
      ON posts("blogId", "isPublished", "publishedAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_posts_id_published
      ON posts(id, "isPublished")
      WHERE "isPublished" = true
    `);

    // 확장 제거 (선택적)
    // await queryRunner.query(`DROP EXTENSION IF EXISTS pg_stat_statements`);
    // await queryRunner.query(`DROP EXTENSION IF EXISTS hypopg`);
  }
}