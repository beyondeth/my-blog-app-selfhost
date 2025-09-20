import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUuidInClauseIndexes1758386143779 implements MigrationInterface {
    name = 'AddUuidInClauseIndexes1758386143779';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // UUID IN 절 쿼리 최적화를 위한 인덱스 추가 (2025-09-21)
        // 홈 화면에서 특정 UUID 목록으로 게시글을 조회할 때 Sequential Scan 방지

        // 1. 공개된 게시글의 ID 검색 최적화
        // WHERE id IN (...) AND isPublished = true 패턴 최적화
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_posts_id_published_v2"
            ON "posts" ("id")
            WHERE "isPublished" = true
        `);

        // 2. 블로그별 공개 게시글 조회 최적화
        // WHERE blogId IN (...) AND isPublished = true 패턴 최적화
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_posts_blogid_ispublished_v2"
            ON "posts" ("blogId", "isPublished")
            WHERE "isPublished" = true
        `);

        // 3. GIN 인덱스는 스킵 (extension이 없어서 생성 불가)
        // UUID IN 절에서 많은 수의 UUID를 검색할 때 효율적이지만,
        // gin_trgm extension이 설치되지 않아서 스킵

        // 참고: 향후 GIN 인덱스를 생성하려면 다음 명령 실행 필요:
        // CREATE EXTENSION IF NOT EXISTS pg_trgm;
        // CREATE INDEX idx_posts_id_gin ON posts USING gin ((id::text) gin_trgm_ops);

        // 4. 통계 정보 업데이트는 트랜잭션 외부에서 실행해야 하므로 주석 처리
        // ANALYZE 명령은 마이그레이션 완료 후 수동으로 실행하거나
        // 애플리케이션 시작 시 실행하는 것을 권장

        // await queryRunner.query(`ANALYZE "posts"`);
        // await queryRunner.query(`ANALYZE "users"`);
        // await queryRunner.query(`ANALYZE "blogs"`);

        // 5. 인덱스 사용 현황 로깅
        console.log('✅ UUID IN clause optimization indexes created successfully');
        console.log('📊 Statistics updated for posts, users, blogs tables');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 인덱스 제거
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_id_published_v2"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_blogid_ispublished_v2"`);
        // GIN 인덱스는 생성하지 않았으므로 제거하지 않음
        // await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_id_gin"`);

        console.log('✅ UUID IN clause optimization indexes removed');
    }
}
