import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 댓글 답글 개수 컬럼 추가
 *
 * @목적
 * - 부모 댓글의 답글 개수를 미리 계산하여 저장
 * - 매번 COUNT 쿼리 방지로 성능 향상
 * - Post.commentCount와 동일한 패턴 적용
 *
 * @전략
 * 1. repliesCount 컬럼 추가 (default: 0)
 * 2. 기존 데이터의 답글 개수 계산 및 업데이트
 * 3. 이후 답글 생성/삭제 시 increment/decrement로 실시간 동기화
 *
 * @성능_향상
 * - 기존: 답글 개수 조회 시 매번 COUNT 쿼리
 * - 개선: 부모 댓글 조회 시 repliesCount 컬럼 사용
 * - DB 부하 감소: COUNT 쿼리 제거
 */
export class AddRepliesCountToComments1760900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. repliesCount 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "comments"
      ADD COLUMN "repliesCount" integer NOT NULL DEFAULT 0
    `);

    // 2. 기존 데이터의 답글 개수 계산 및 업데이트
    // 부모 댓글별로 삭제되지 않은 답글 개수를 집계하여 업데이트
    await queryRunner.query(`
      UPDATE "comments" AS parent
      SET "repliesCount" = (
        SELECT COUNT(*)
        FROM "comments" AS reply
        WHERE reply."parentCommentId" = parent.id
          AND reply."isDeleted" = false
      )
      WHERE parent."parentCommentId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // repliesCount 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "comments"
      DROP COLUMN "repliesCount"
    `);
  }
}
