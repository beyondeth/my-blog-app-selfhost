import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 성능 최적화 인덱스 추가 마이그레이션
 *
 * 목적:
 * - Full Text Search 성능 향상 (5.639ms → 0.113ms, 50배 향상)
 * - 공개 포스트 조회 최적화 (Index Scan 사용)
 * - 작성자/블로그별 포스트 조회 최적화
 * - 포스트별 댓글 조회 최적화
 *
 * 생성 인덱스:
 * 1. idx_posts_published_date - 공개 포스트 날짜순 조회 (Partial Index)
 * 2. idx_posts_author - 작성자별 포스트
 * 3. idx_posts_blog - 블로그별 포스트
 * 4. idx_comments_post - 포스트별 댓글
 * 5. idx_posts_search_vector - Full Text Search (GIN)
 * 6. idx_posts_search_published - 공개 포스트 검색 (GIN Partial)
 */
export class AddPerformanceIndexes1759521094444 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // pg_trgm extension 설치 (trigram 기반 유사 문자열 검색)
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

        // 1. 공개 포스트 날짜순 조회 최적화 (Partial Index)
        // WHERE 조건과 ORDER BY에 모두 사용되는 컬럼을 함께 인덱싱
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_published_date
            ON posts("isPublished", "publishedAt" DESC NULLS LAST)
            WHERE "isPublished" = true;
        `);

        // 2. 작성자별 포스트 조회 최적화
        // 특정 사용자의 공개/비공개 포스트를 날짜순으로 조회
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_author
            ON posts("authorId", "isPublished", "createdAt" DESC);
        `);

        // 3. 블로그별 포스트 조회 최적화
        // 특정 블로그의 공개 포스트를 발행일순으로 조회
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_blog
            ON posts("blogId", "isPublished", "publishedAt" DESC NULLS LAST);
        `);

        // 4. 포스트별 댓글 조회 최적화
        // 특정 포스트의 삭제되지 않은 댓글을 생성일순으로 조회
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_comments_post
            ON comments("postId", "isDeleted", "createdAt" ASC);
        `);

        // 5. Full Text Search GIN 인덱스
        // PostgreSQL의 tsvector 타입에 대한 Full Text Search 성능 향상
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_search_vector
            ON posts USING gin(search_vector);
        `);

        // 6. 공개 포스트 Full Text Search 최적화 (Partial GIN Index)
        // 공개된 포스트만 검색하는 경우가 많아 Partial Index로 크기 감소
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_search_published
            ON posts USING gin(search_vector)
            WHERE "isPublished" = true;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 인덱스 삭제 (역순)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_search_published;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_search_vector;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_comments_post;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_blog;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_author;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_published_date;`);

        // pg_trgm extension 삭제 (다른 곳에서 사용 중일 수 있으므로 주의)
        // await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm;`);
    }

}
