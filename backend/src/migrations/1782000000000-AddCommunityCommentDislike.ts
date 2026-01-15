import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 커뮤니티 댓글 좋아요/싫어요 시스템 마이그레이션
 *
 * 변경 사항:
 * 1. community_comments 테이블에 dislikeCount 컬럼 추가
 * 2. community_comment_likes 테이블 생성 (좋아요/싫어요 추적)
 *
 * 설계 원칙:
 * - Reddit 스타일 업보트/다운보트 시스템
 * - 상호배타 로직: 좋아요/싫어요 동시 불가
 * - 블로그 댓글 시스템(comment-like.entity.ts)과 동일한 패턴
 */
export class AddCommunityCommentDislike1782000000000
  implements MigrationInterface
{
  name = "AddCommunityCommentDislike1782000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // 1. community_comments 테이블에 dislikeCount 컬럼 추가
    // =====================================================
    await queryRunner.query(`
      ALTER TABLE "community_comments"
      ADD COLUMN IF NOT EXISTS "dislikeCount" INTEGER DEFAULT 0
    `);

    // =====================================================
    // 2. community_comment_like_type_enum 생성
    // =====================================================
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "community_comment_like_type_enum" AS ENUM ('like', 'dislike');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // =====================================================
    // 3. community_comment_likes 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_comment_likes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "commentId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "type" "community_comment_like_type_enum" NOT NULL,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "uq_community_comment_likes" UNIQUE ("commentId", "userId"),
        CONSTRAINT "fk_community_comment_likes_comment" FOREIGN KEY ("commentId")
          REFERENCES "community_comments"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_comment_likes_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // community_comment_likes 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_community_comment_likes_user" ON "community_comment_likes"("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_community_comment_likes_comment" ON "community_comment_likes"("commentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_community_comment_likes_comment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_community_comment_likes_user"`,
    );

    // 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS "community_comment_likes"`);

    // ENUM 타입 삭제
    await queryRunner.query(
      `DROP TYPE IF EXISTS "community_comment_like_type_enum"`,
    );

    // 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE "community_comments"
      DROP COLUMN IF EXISTS "dislikeCount"
    `);
  }
}
