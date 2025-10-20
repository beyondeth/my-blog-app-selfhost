import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 댓글 페이지네이션 최적화 인덱스 추가
 *
 * @목적
 * - 5,000명+ 커뮤니티 규모에서 댓글 시스템 최적화
 * - 부모 댓글 페이지네이션 (최신순/인기순 정렬 지원)
 * - 답글 페이지네이션
 *
 * @인덱스_전략
 * 1. 최신순 정렬 인덱스 (createdAt DESC, id DESC)
 *    - 부모 댓글: postId + parentCommentId IS NULL + 정렬 컬럼
 *    - 답글: parentCommentId + 정렬 컬럼
 *
 * 2. 인기순 정렬 인덱스 (likesCount DESC, createdAt DESC, id DESC)
 *    - 좋아요 수 우선, 동일 시 최신순
 *
 * @복합_커서_구조
 * - 최신순: { createdAt, id }
 * - 인기순: { likesCount, createdAt, id }
 *
 * @성능_예상
 * - 기존 (전체 로드): 1,000~1,500ms
 * - 개선 (페이징): 150~250ms (85% 개선)
 */
export class AddCommentPaginationIndexes1760800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 최신순 정렬용 복합 인덱스 (부모 댓글)
    // postId별로 삭제되지 않은 부모 댓글만 최신순으로 빠르게 조회
    await queryRunner.query(`
      CREATE INDEX "idx_comments_recent_parent"
      ON "comments" ("postId", "createdAt" DESC, "id" DESC)
      WHERE "parentCommentId" IS NULL AND "isDeleted" = false
    `);

    // 2. 인기순 정렬용 복합 인덱스 (부모 댓글)
    // 좋아요 수 + 최신순 복합 정렬
    await queryRunner.query(`
      CREATE INDEX "idx_comments_popular_parent"
      ON "comments" ("postId", "likesCount" DESC, "createdAt" DESC, "id" DESC)
      WHERE "parentCommentId" IS NULL AND "isDeleted" = false
    `);

    // 3. 답글 최신순 정렬용 인덱스
    // 특정 부모 댓글의 답글을 최신순으로 조회
    await queryRunner.query(`
      CREATE INDEX "idx_comments_replies_recent"
      ON "comments" ("parentCommentId", "createdAt" ASC, "id" ASC)
      WHERE "parentCommentId" IS NOT NULL AND "isDeleted" = false
    `);

    // 4. 답글 인기순 정렬용 인덱스
    await queryRunner.query(`
      CREATE INDEX "idx_comments_replies_popular"
      ON "comments" ("parentCommentId", "likesCount" DESC, "createdAt" DESC, "id" DESC)
      WHERE "parentCommentId" IS NOT NULL AND "isDeleted" = false
    `);

    // 5. 전체 댓글 개수 집계용 인덱스 (통계)
    // COUNT 쿼리 최적화
    await queryRunner.query(`
      CREATE INDEX "idx_comments_count"
      ON "comments" ("postId", "isDeleted")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_comments_recent_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_comments_popular_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_comments_replies_recent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_comments_replies_popular"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_comments_count"`);
  }
}
