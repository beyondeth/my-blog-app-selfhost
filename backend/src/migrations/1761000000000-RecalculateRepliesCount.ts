import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 플랫 구조를 위한 repliesCount 재계산
 *
 * @description
 * - 최상위 부모 댓글만 실제 하위 댓글 수를 가짐
 * - 재귀적으로 모든 하위 댓글 카운트
 */
export class RecalculateRepliesCount1761000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 모든 댓글의 repliesCount를 0으로 초기화
    await queryRunner.query(`
      UPDATE comments
      SET "repliesCount" = 0
    `);

    // 최상위 부모 댓글(parentCommentId가 NULL)의 repliesCount만 재계산
    await queryRunner.query(`
      WITH RECURSIVE comment_tree AS (
        -- 모든 최상위 부모 댓글
        SELECT
          id as root_id,
          id
        FROM comments
        WHERE "parentCommentId" IS NULL
          AND "isDeleted" = false

        UNION ALL

        -- 재귀적으로 모든 하위 댓글
        SELECT
          ct.root_id,
          c.id
        FROM comments c
        INNER JOIN comment_tree ct ON c."parentCommentId" = ct.id
        WHERE c."isDeleted" = false
      ),
      reply_counts AS (
        SELECT
          root_id,
          COUNT(*) - 1 as count -- 자기 자신 제외
        FROM comment_tree
        GROUP BY root_id
      )
      UPDATE comments
      SET "repliesCount" = rc.count
      FROM reply_counts rc
      WHERE comments.id = rc.root_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 이전 방식: 직계 자식만 카운트
    await queryRunner.query(`
      UPDATE comments AS parent
      SET "repliesCount" = (
        SELECT COUNT(*)
        FROM comments AS reply
        WHERE reply."parentCommentId" = parent.id
          AND reply."isDeleted" = false
      )
    `);
  }
}