import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Like → Upvote/Downvote 시스템 변환 마이그레이션
 *
 * @description
 * Reddit 스타일의 업보트/다운보트 시스템 도입
 *
 * **변경 사항:**
 * 1. post_stats: upvoteCount, downvoteCount 컬럼 추가
 * 2. community_posts: upvoteCount, downvoteCount 컬럼 추가
 * 3. post_likes: type enum 값 변환 (like→upvote, dislike→downvote)
 * 4. community_post_likes: type 컬럼 추가
 *
 * **데이터 마이그레이션:**
 * - 기존 likeCount → upvoteCount로 복사
 * - 기존 like type → upvote로 변환
 * - downvoteCount는 0으로 초기화
 *
 * @note likeCount 컬럼은 하위 호환성을 위해 유지 (추후 제거 예정)
 */
export class ConvertLikeToUpvoteDownvote1783000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // 1. post_stats 테이블 수정
    // =====================================================

    // 1.1. upvoteCount, downvoteCount 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "post_stats"
        ADD COLUMN IF NOT EXISTS "upvoteCount" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "downvoteCount" INTEGER NOT NULL DEFAULT 0
    `);

    // 1.2. 기존 likeCount를 upvoteCount로 복사
    await queryRunner.query(`
      UPDATE "post_stats"
      SET "upvoteCount" = "likeCount"
      WHERE "upvoteCount" = 0 AND "likeCount" > 0
    `);

    // 1.3. 인덱스 추가 (정렬 최적화)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_post_stats_upvoteCount"
      ON "post_stats" ("upvoteCount")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_post_stats_downvoteCount"
      ON "post_stats" ("downvoteCount")
    `);

    // =====================================================
    // 2. community_posts 테이블 수정
    // =====================================================

    // 2.1. upvoteCount, downvoteCount 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "community_posts"
        ADD COLUMN IF NOT EXISTS "upvoteCount" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "downvoteCount" INTEGER NOT NULL DEFAULT 0
    `);

    // 2.2. 기존 likeCount를 upvoteCount로 복사
    await queryRunner.query(`
      UPDATE "community_posts"
      SET "upvoteCount" = "likeCount"
      WHERE "upvoteCount" = 0 AND "likeCount" > 0
    `);

    // 2.3. 기존 인덱스 삭제 후 새 인덱스 생성
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_community_posts_likeCount_commentCount"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_posts_upvoteCount"
      ON "community_posts" ("communityId", "upvoteCount", "commentCount")
    `);

    // =====================================================
    // 3. post_likes 테이블 - type enum 값 변환
    // =====================================================

    // 3.1. 새로운 vote_type enum 생성
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vote_type_enum') THEN
          CREATE TYPE "vote_type_enum" AS ENUM ('upvote', 'downvote');
        END IF;
      END$$
    `);

    // 3.2. 기존 like_type_enum 데이터를 새 enum으로 변환
    // 임시 컬럼 생성 → 데이터 변환 → 컬럼 교체
    await queryRunner.query(`
      ALTER TABLE "post_likes"
      ADD COLUMN IF NOT EXISTS "type_new" "vote_type_enum"
    `);

    // 3.3. 기존 데이터 변환 (like→upvote, dislike→downvote)
    await queryRunner.query(`
      UPDATE "post_likes"
      SET "type_new" = CASE
        WHEN "type"::text = 'like' THEN 'upvote'::"vote_type_enum"
        WHEN "type"::text = 'dislike' THEN 'downvote'::"vote_type_enum"
        ELSE 'upvote'::"vote_type_enum"
      END
      WHERE "type_new" IS NULL
    `);

    // 3.4. 기존 type 컬럼 삭제 및 새 컬럼으로 교체
    await queryRunner.query(`
      ALTER TABLE "post_likes"
      DROP COLUMN IF EXISTS "type"
    `);

    await queryRunner.query(`
      ALTER TABLE "post_likes"
      RENAME COLUMN "type_new" TO "type"
    `);

    // 3.5. NOT NULL 제약 및 기본값 설정
    await queryRunner.query(`
      ALTER TABLE "post_likes"
      ALTER COLUMN "type" SET NOT NULL,
      ALTER COLUMN "type" SET DEFAULT 'upvote'::"vote_type_enum"
    `);

    // 3.6. 기존 unique 제약 조건 재생성
    // (userId, postId) unique - type은 제외 (사용자당 1투표만)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_post_likes_userId_postId_type"
    `);

    // userId, postId 유니크 제약 (type 제외)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_post_likes_user_post'
        ) THEN
          ALTER TABLE "post_likes"
          ADD CONSTRAINT "UQ_post_likes_user_post" UNIQUE ("userId", "postId");
        END IF;
      EXCEPTION WHEN duplicate_object THEN
        -- 이미 존재하면 무시
      END$$
    `);

    // =====================================================
    // 4. community_post_likes 테이블 - type 컬럼 추가
    // =====================================================

    // 4.1. type 컬럼 추가 (vote_type_enum 재사용)
    await queryRunner.query(`
      ALTER TABLE "community_post_likes"
      ADD COLUMN IF NOT EXISTS "type" "vote_type_enum" NOT NULL DEFAULT 'upvote'::"vote_type_enum"
    `);

    // 4.2. 기존 좋아요를 upvote로 처리 (이미 default로 설정됨)
    // 추가 작업 불필요

    // =====================================================
    // 5. downvoteCount 계산 (기존 dislike 데이터 반영)
    // =====================================================

    // 5.1. post_stats의 downvoteCount 계산
    await queryRunner.query(`
      UPDATE "post_stats" ps
      SET "downvoteCount" = (
        SELECT COUNT(*)
        FROM "post_likes" pl
        WHERE pl."postId" = ps."postId"
          AND pl."type" = 'downvote'::"vote_type_enum"
      )
    `);

    // 5.2. community_posts의 downvoteCount는 0 유지 (기존에 type 없었음)

    // =====================================================
    // 6. 기존 like_type_enum 정리 (선택적)
    // =====================================================
    // 기존 enum은 유지 (다른 곳에서 사용 중일 수 있음)
    // DROP TYPE IF EXISTS "post_likes_type_enum" CASCADE; -- 주의 필요
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // 롤백: 역순으로 변경 사항 되돌리기
    // =====================================================

    // 1. community_post_likes - type 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "community_post_likes"
      DROP COLUMN IF EXISTS "type"
    `);

    // 2. post_likes - enum 복원
    // 2.1. 기존 like_type_enum 복원
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_likes_type_enum') THEN
          CREATE TYPE "post_likes_type_enum" AS ENUM ('like', 'dislike');
        END IF;
      END$$
    `);

    // 2.2. 새 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "post_likes"
      ADD COLUMN IF NOT EXISTS "type_old" "post_likes_type_enum"
    `);

    // 2.3. 데이터 역변환
    await queryRunner.query(`
      UPDATE "post_likes"
      SET "type_old" = CASE
        WHEN "type"::text = 'upvote' THEN 'like'::"post_likes_type_enum"
        WHEN "type"::text = 'downvote' THEN 'dislike'::"post_likes_type_enum"
        ELSE 'like'::"post_likes_type_enum"
      END
      WHERE "type_old" IS NULL
    `);

    // 2.4. 컬럼 교체
    await queryRunner.query(`
      ALTER TABLE "post_likes"
      DROP COLUMN IF EXISTS "type"
    `);

    await queryRunner.query(`
      ALTER TABLE "post_likes"
      RENAME COLUMN "type_old" TO "type"
    `);

    await queryRunner.query(`
      ALTER TABLE "post_likes"
      ALTER COLUMN "type" SET NOT NULL,
      ALTER COLUMN "type" SET DEFAULT 'like'::"post_likes_type_enum"
    `);

    // 3. 인덱스 제거
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_post_stats_upvoteCount"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_post_stats_downvoteCount"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_community_posts_upvoteCount"
    `);

    // 4. community_posts - 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "community_posts"
      DROP COLUMN IF EXISTS "upvoteCount",
      DROP COLUMN IF EXISTS "downvoteCount"
    `);

    // 5. post_stats - 컬럼 제거
    await queryRunner.query(`
      ALTER TABLE "post_stats"
      DROP COLUMN IF EXISTS "upvoteCount",
      DROP COLUMN IF EXISTS "downvoteCount"
    `);

    // 6. vote_type_enum 제거
    await queryRunner.query(`
      DROP TYPE IF EXISTS "vote_type_enum"
    `);
  }
}
