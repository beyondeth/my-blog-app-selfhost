import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 신고 및 삭제 사유 시스템 마이그레이션
 *
 * 생성되는 테이블:
 * 1. community_reports - 게시물/댓글 신고
 * 2. community_removal_reasons - 삭제 사유 템플릿
 *
 * 기존 테이블 수정:
 * - community_posts: 삭제 추적 필드 추가
 * - community_comments: 삭제 추적 필드 추가
 *
 * 설계 원칙:
 * - 신고는 커뮤니티 모더레이터 + 사이트 관리자가 처리
 * - 에스컬레이션: 커뮤니티 모더레이터 → 사이트 관리자
 * - 소프트 삭제: 모더레이터는 콘텐츠를 숨기기만, DB에서 삭제하지 않음
 */
export class AddReportAndRemovalReasonTables1782000000000
  implements MigrationInterface
{
  name = "AddReportAndRemovalReasonTables1782000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // 1. ENUM 타입 생성 (멱등성 보장: 이미 존재하면 건너뜀)
    // =====================================================
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_reason_enum" AS ENUM (
          'spam',
          'harassment',
          'hate_speech',
          'violence',
          'misinformation',
          'rule_violation',
          'copyright',
          'privacy',
          'other'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_target_type_enum" AS ENUM ('post', 'comment');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "report_status_enum" AS ENUM (
          'pending',
          'resolved',
          'dismissed',
          'escalated'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    // =====================================================
    // 2. community_removal_reasons 테이블 생성 (멱등성 보장)
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_removal_reasons" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "title" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "displayOrder" INTEGER DEFAULT 0,
        "notifyUser" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "fk_removal_reasons_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE
      )
    `);

    // community_removal_reasons 인덱스 (멱등성 보장)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_removal_reasons_order"
      ON "community_removal_reasons"("communityId", "displayOrder")
    `);

    // =====================================================
    // 3. community_reports 테이블 생성 (멱등성 보장)
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_reports" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "reporterId" UUID NOT NULL,
        "targetType" "report_target_type_enum" NOT NULL,
        "targetPostId" UUID,
        "targetCommentId" UUID,
        "reason" "report_reason_enum" NOT NULL,
        "violatedRuleId" UUID,
        "description" TEXT,
        "status" "report_status_enum" DEFAULT 'pending',
        "resolvedById" UUID,
        "resolvedAt" TIMESTAMPTZ,
        "moderatorNote" TEXT,
        "isEscalated" BOOLEAN DEFAULT false,
        "escalatedAt" TIMESTAMPTZ,
        "escalatedById" UUID,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "fk_reports_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reports_reporter" FOREIGN KEY ("reporterId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reports_post" FOREIGN KEY ("targetPostId")
          REFERENCES "community_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reports_comment" FOREIGN KEY ("targetCommentId")
          REFERENCES "community_comments"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reports_rule" FOREIGN KEY ("violatedRuleId")
          REFERENCES "community_rules"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_reports_resolved_by" FOREIGN KEY ("resolvedById")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_reports_escalated_by" FOREIGN KEY ("escalatedById")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // community_reports 인덱스 (멱등성 보장)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reports_status"
      ON "community_reports"("communityId", "status", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reports_post"
      ON "community_reports"("targetType", "targetPostId", "reporterId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reports_comment"
      ON "community_reports"("targetType", "targetCommentId", "reporterId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reports_escalated"
      ON "community_reports"("isEscalated", "status")
      WHERE "isEscalated" = true
    `);

    // =====================================================
    // 4. community_posts 테이블에 삭제 추적 컬럼 추가 (멱등성 보장)
    // =====================================================
    // 각 컬럼을 개별적으로 추가 (이미 존재하면 건너뜀)
    await queryRunner.query(`
      ALTER TABLE "community_posts"
      ADD COLUMN IF NOT EXISTS "removalReasonId" UUID,
      ADD COLUMN IF NOT EXISTS "removedById" UUID,
      ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "upvoteCount" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "downvoteCount" INTEGER DEFAULT 0
    `);

    // 외래 키 제약조건 추가 (이미 존재하면 건너뜀)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "community_posts"
          ADD CONSTRAINT "fk_posts_removal_reason" FOREIGN KEY ("removalReasonId")
            REFERENCES "community_removal_reasons"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "community_posts"
          ADD CONSTRAINT "fk_posts_removed_by" FOREIGN KEY ("removedById")
            REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    // =====================================================
    // 5. community_comments 테이블에 삭제 추적 컬럼 추가 (멱등성 보장)
    // =====================================================
    await queryRunner.query(`
      ALTER TABLE "community_comments"
      ADD COLUMN IF NOT EXISTS "removalReason" TEXT,
      ADD COLUMN IF NOT EXISTS "removalReasonId" UUID,
      ADD COLUMN IF NOT EXISTS "removedById" UUID,
      ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "dislikeCount" INTEGER DEFAULT 0
    `);

    // 외래 키 제약조건 추가 (이미 존재하면 건너뜀)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "community_comments"
          ADD CONSTRAINT "fk_comments_removal_reason" FOREIGN KEY ("removalReasonId")
            REFERENCES "community_removal_reasons"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "community_comments"
          ADD CONSTRAINT "fk_comments_removed_by" FOREIGN KEY ("removedById")
            REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // community_comments 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE "community_comments"
      DROP CONSTRAINT IF EXISTS "fk_comments_removal_reason",
      DROP CONSTRAINT IF EXISTS "fk_comments_removed_by",
      DROP COLUMN IF EXISTS "removalReason",
      DROP COLUMN IF EXISTS "removalReasonId",
      DROP COLUMN IF EXISTS "removedById",
      DROP COLUMN IF EXISTS "removedAt",
      DROP COLUMN IF EXISTS "dislikeCount"
    `);

    // community_posts 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE "community_posts"
      DROP CONSTRAINT IF EXISTS "fk_posts_removal_reason",
      DROP CONSTRAINT IF EXISTS "fk_posts_removed_by",
      DROP COLUMN IF EXISTS "removalReasonId",
      DROP COLUMN IF EXISTS "removedById",
      DROP COLUMN IF EXISTS "removedAt",
      DROP COLUMN IF EXISTS "upvoteCount",
      DROP COLUMN IF EXISTS "downvoteCount"
    `);

    // 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS "community_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_removal_reasons"`);

    // ENUM 타입 삭제
    await queryRunner.query(`DROP TYPE IF EXISTS "report_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_target_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_reason_enum"`);
  }
}
