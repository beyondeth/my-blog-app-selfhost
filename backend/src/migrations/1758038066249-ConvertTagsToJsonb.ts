import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertTagsToJsonb1758038066249 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. tagList 컬럼이 없다면 추가 (JSONB 타입)
        const hasTagList = await queryRunner.hasColumn('posts', 'tagList');
        if (!hasTagList) {
            await queryRunner.query(`
                ALTER TABLE "posts"
                ADD COLUMN "tagList" jsonb DEFAULT '[]'::jsonb
            `);
        }

        // 2. 기존 tag 관계 데이터를 JSONB로 마이그레이션
        // post_tags 테이블이 존재하는 경우에만 실행
        const hasPostTagsTable = await queryRunner.hasTable('post_tags');
        if (hasPostTagsTable) {
            await queryRunner.query(`
                UPDATE posts p
                SET "tagList" = COALESCE(
                    (
                        SELECT jsonb_agg(DISTINCT t.name ORDER BY t.name)
                        FROM post_tags pt
                        JOIN tags t ON pt."tagId" = t.id
                        WHERE pt."postId" = p.id
                    ),
                    '[]'::jsonb
                )
            `);
        }

        // 3. 인덱스 추가 (JSONB 검색 성능 향상)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_posts_tagList"
            ON "posts" USING GIN ("tagList");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. 인덱스 제거
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_tagList"`);

        // 2. tagList 컬럼 제거
        const hasTagList = await queryRunner.hasColumn('posts', 'tagList');
        if (hasTagList) {
            await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "tagList"`);
        }

        // Note: 원본 tag 관계 복원은 데이터 손실 방지를 위해 수행하지 않음
        // 필요 시 백업에서 복원해야 함
    }

}
