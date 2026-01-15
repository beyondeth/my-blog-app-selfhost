import { MigrationInterface, QueryRunner } from "typeorm";

export class FixPostStatsIndexes1776000000000 implements MigrationInterface {
  name = "FixPostStatsIndexes1776000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostStats 테이블에 인덱스 추가
    // 복합 인덱스: 인기도 점수 계산을 위한 필드들
    await queryRunner.query(`
            CREATE INDEX "IDX_post_stats_popularity"
            ON "post_stats" ("likeCount" DESC, "commentCount" DESC, "viewCount" DESC)
        `);

    // postId를 위한 고유 인덱스 (있어야 함)
    await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_post_stats_postId_unique"
            ON "post_stats" ("postId")
        `);

    // 개별 카운트 필드 인덱스 (정렬용) - 이미 존재하면 건너뛰기
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_post_stats_likeCount"
            ON "post_stats" ("likeCount" DESC)
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_post_stats_commentCount"
            ON "post_stats" ("commentCount" DESC)
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_post_stats_viewCount"
            ON "post_stats" ("viewCount" DESC)
        `);

    // Post와 PostStats 조인을 위한 인덱스
    // materialized view나 복잡한 쿼리에서 사용될 수 있음
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_post_stats_viewCount"`);
    await queryRunner.query(`DROP INDEX "IDX_post_stats_commentCount"`);
    await queryRunner.query(`DROP INDEX "IDX_post_stats_likeCount"`);
    // postId 고유 인덱스는 외래 키이므로 삭제하지 않음
    await queryRunner.query(`DROP INDEX "IDX_post_stats_popularity"`);
  }
}
