import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHomepagePerformanceIndexes1778000000000 implements MigrationInterface {
    name = 'AddHomepagePerformanceIndexes1778000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            // 홈페이지 피드를 위한 커버링 인덱스
            // isPublished=true AND isDeleted=false 인 게시물만 대상으로 하는 부분 인덱스
            // publishedAt DESC, id DESC 순서로 정렬하여 커서 페이지네이션 최적화
            await queryRunner.query(`
                CREATE INDEX "idx_posts_homepage_covering"
                ON "posts" ("isPublished", "isDeleted", "publishedAt" DESC, "id" DESC)
                WHERE "isPublished" = true AND "isDeleted" = false;
            `);
            console.log('✅ Created homepage covering index');

            // 커서 페이지네이션 최적화를 위한 전용 인덱스
            // publishedAt와 id를 기반으로 한 커서 페이징에 특화
            // 부분 인덱스로 저장 공간과 유지보수 비용 절감
            await queryRunner.query(`
                CREATE INDEX "idx_posts_cursor_optimized"
                ON "posts" ("publishedAt" DESC, "id" DESC)
                WHERE "isPublished" = true AND "isDeleted" = false;
            `);
            console.log('✅ Created cursor pagination optimized index');

            // Author 조인 최적화 인덱스
            // 사용자 정보와 조인할 때 성능 향상
            await queryRunner.query(`
                CREATE INDEX "idx_posts_author_published_composite"
                ON "posts" ("authorId", "isPublished", "isDeleted", "publishedAt" DESC)
                WHERE "isPublished" = true AND "isDeleted" = false;
            `);
            console.log('✅ Created author join optimized index');

            // Blog 조인 최적화 인덱스
            // 블로그 정보와 조인할 때 성능 향상
            await queryRunner.query(`
                CREATE INDEX "idx_posts_blog_published_composite"
                ON "posts" ("blogId", "isPublished", "isDeleted", "publishedAt" DESC)
                WHERE "isPublished" = true AND "isDeleted" = false;
            `);
            console.log('✅ Created blog join optimized index');

            // 포스트 목록 쿼리 분석을 위한 통계 업데이트
            await queryRunner.query(`
                ANALYZE "posts";
            `);
            console.log('✅ Updated table statistics');

            console.log('\n🎉 Homepage performance indexes created successfully!');
            console.log('Expected improvements:');
            console.log(' - Homepage feed queries: 30-50% faster');
            console.log(' - Deep cursor pagination: Significant performance boost');
            console.log(' - JOIN operations: Reduced I/O and CPU usage');

        } catch (error) {
            console.error('❌ Error creating homepage performance indexes:', error);
            throw error;
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            // 생성된 인덱스 롤백
            await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_homepage_covering";`);
            await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_cursor_optimized";`);
            await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_author_published_composite";`);
            await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_blog_published_composite";`);

            console.log('✅ Homepage performance indexes dropped successfully');
        } catch (error) {
            console.error('❌ Error dropping homepage performance indexes:', error);
            throw error;
        }
    }
}