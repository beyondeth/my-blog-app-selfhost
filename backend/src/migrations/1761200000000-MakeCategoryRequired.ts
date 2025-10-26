import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 카테고리 필드 필수화 마이그레이션
 *
 * 작업 내용:
 * 1. category가 NULL인 기존 포스트를 '미분류'로 업데이트
 * 2. category 컬럼에 NOT NULL 제약 추가
 * 3. DEFAULT 값을 '기타'로 설정
 */
export class MakeCategoryRequired1761200000000 implements MigrationInterface {
    name = 'MakeCategoryRequired1761200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. category가 NULL인 기존 포스트를 '미분류'로 업데이트
        await queryRunner.query(`
            UPDATE posts
            SET category = '미분류'
            WHERE category IS NULL
        `);

        // 2. category 컬럼에 NOT NULL 제약 추가
        await queryRunner.query(`
            ALTER TABLE "posts"
            ALTER COLUMN "category" SET NOT NULL
        `);

        // 3. DEFAULT 값을 '기타'로 설정
        await queryRunner.query(`
            ALTER TABLE "posts"
            ALTER COLUMN "category" SET DEFAULT '기타'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. DEFAULT 값 제거
        await queryRunner.query(`
            ALTER TABLE "posts"
            ALTER COLUMN "category" DROP DEFAULT
        `);

        // 2. NOT NULL 제약 제거
        await queryRunner.query(`
            ALTER TABLE "posts"
            ALTER COLUMN "category" DROP NOT NULL
        `);
    }
}
