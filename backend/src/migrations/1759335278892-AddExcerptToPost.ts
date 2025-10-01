import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExcerptToPost1759335278892 implements MigrationInterface {
    name = 'AddExcerptToPost1759335278892'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // excerpt 필드 추가
        await queryRunner.query(`ALTER TABLE "posts" ADD "excerpt" text`);

        // 기존 포스트의 excerpt 필드를 content에서 생성 (HTML 태그 제거 후 200자로 제한)
        await queryRunner.query(`
            UPDATE posts
            SET excerpt = SUBSTRING(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(content, '<[^>]+>', '', 'g'),
                    '\s+', ' ', 'g'
                ),
                1, 200
            )
            WHERE content IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // excerpt 필드 제거
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "excerpt"`);
    }

}
