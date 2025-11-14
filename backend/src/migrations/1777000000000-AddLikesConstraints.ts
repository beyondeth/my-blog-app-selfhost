import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLikesConstraints1777000000000 implements MigrationInterface {
    name = 'AddLikesConstraints1777000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. post_likes 테이블에 유니크 제약조건 추가 (같은 사용자가 같은 포스트에 여러 번 좋아요 방지)
        await queryRunner.query(`
            ALTER TABLE post_likes
            ADD CONSTRAINT "UQ_post_likes_user_post"
            UNIQUE ("postId", "userId")
        `);

        // 2. post_stats 테이블의 likeCount에 음수 방지 CHECK 제약조건 추가
        await queryRunner.query(`
            ALTER TABLE post_stats
            ADD CONSTRAINT "CHK_post_stats_likeCount_non_negative"
            CHECK ("likeCount" >= 0)
        `);

        // 3. post_stats 테이블의 likeCount 값 정리 (음수인 경우 0으로 수정)
        await queryRunner.query(`
            UPDATE post_stats
            SET "likeCount" = 0
            WHERE "likeCount" < 0
        `);

        // 5. 인덱스 추가 (성능 최적화)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_post_likes_user_post"
            ON post_likes ("userId", "postId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 제약조건 제거
        await queryRunner.query(`DROP INDEX "IDX_post_likes_user_post"`);
        await queryRunner.query(`ALTER TABLE post_stats DROP CONSTRAINT "CHK_post_stats_likeCount_non_negative"`);
        await queryRunner.query(`ALTER TABLE post_likes DROP CONSTRAINT "UQ_post_likes_user_post"`);
    }
}