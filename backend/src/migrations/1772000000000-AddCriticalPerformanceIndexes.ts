import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCriticalPerformanceIndexes1772000000000
  implements MigrationInterface
{
  name = "AddCriticalPerformanceIndexes1772000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Posts 테이블 인덱스 추가

    // 1. 태그 검색 최적화 (JSONB 배열 contains 쿼리용)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_tag_search
            ON posts USING GIN (tags)
        `);

    // 2. 태그 검색 + 퍼블리싱 복합 인덱스
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_tag_pub_date
            ON posts(tags, "isPublished", "publishedAt" DESC)
            WHERE "isPublished" = true
        `);

    // 3. 에디터픽 최적화 (에디터 추천 콘텐트)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_editor_pick
            ON posts("isPublished", "isEditorPick", "editorPickedAt" DESC)
            WHERE "isPublished" = true AND "isEditorPick" = true
        `);

    // 4. 에디터픽 + 카테고리 조합 (에디터픽 카테고리 페이지)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_editor_category
            ON posts("isPublished", "isEditorPick", "category", "editorPickedAt" DESC)
            WHERE "isPublished" = true AND "isEditorPick" = true
        `);

    // Comments 테이블 인덱스 추가

    // 5. 댓글 카운트 최적화 (N+1 문제 해결)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_comments_post_count
            ON comments("postId", "isDeleted", "createdAt" DESC)
            WHERE "isDeleted" = false
        `);

    // 6. 댓글 스레딩을 위한 부모-자식 관계 인덱스
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_comments_parent_thread
            ON comments("parentCommentId", "createdAt" DESC)
            WHERE "parentCommentId" IS NOT NULL AND "isDeleted" = false
        `);

    // 7. 댓글 답글 정렬용 (최신 답글부터)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_comments_replies
            ON comments("postId", "parentCommentId", "createdAt" DESC)
            WHERE "parentCommentId" IS NOT NULL AND "isDeleted" = false
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제 (역순)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_comments_replies`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_comments_parent_thread`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_comments_post_count`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_editor_category`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_editor_pick`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_tag_pub_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_tag_search`);
  }
}
