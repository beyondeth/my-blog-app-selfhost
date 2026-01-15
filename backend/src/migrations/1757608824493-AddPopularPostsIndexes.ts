import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPopularPostsIndexes1757608824493 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 복합 인덱스: 인기도 점수 계산을 위한 필드들
    await queryRunner.query(`
            CREATE INDEX "IDX_post_popularity" 
            ON "posts" ("isPublished", "viewCount" DESC, "likeCount" DESC, "commentCount" DESC)
            WHERE "isPublished" = true
        `);

    // 기간별 인기 포스트용 인덱스 (날짜와 인기도 지표)
    await queryRunner.query(`
            CREATE INDEX "IDX_post_date_popularity" 
            ON "posts" ("publishedAt" DESC, "viewCount" DESC, "likeCount" DESC, "commentCount" DESC)
            WHERE "isPublished" = true
        `);

    // 조회수 업데이트 성능 개선을 위한 인덱스
    await queryRunner.query(`
            CREATE INDEX "IDX_post_view_update" 
            ON "posts" ("id", "viewCount")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_post_view_update"`);
    await queryRunner.query(`DROP INDEX "IDX_post_date_popularity"`);
    await queryRunner.query(`DROP INDEX "IDX_post_popularity"`);
  }
}
