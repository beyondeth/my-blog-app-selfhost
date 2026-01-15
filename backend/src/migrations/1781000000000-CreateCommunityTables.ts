import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 커뮤니티 시스템 마이그레이션
 *
 * 생성되는 테이블:
 * 1. communities - 커뮤니티 기본 정보
 * 2. community_members - 멤버십 (역할 포함)
 * 3. community_posts - 커뮤니티 게시물
 * 4. community_comments - 커뮤니티 댓글
 * 5. community_post_likes - 게시물 좋아요
 * 6. community_rules - 커뮤니티 규칙
 * 7. community_flairs - 플레어 (게시물/사용자)
 * 8. community_bans - 밴 기록
 * 9. community_mod_logs - 모더레이션 로그
 *
 * 설계 원칙:
 * - UUID v7 사용 (시간 순서 정렬 지원)
 * - 적절한 인덱스로 쿼리 성능 최적화
 * - CASCADE 삭제로 데이터 무결성 보장
 * - soft delete 지원 (deletedAt)
 */
export class CreateCommunityTables1781000000000 implements MigrationInterface {
  name = "CreateCommunityTables1781000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid-ossp 확장 확인 (uuid_generate_v7 대신 gen_random_uuid 사용)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // =====================================================
    // 1. communities 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TYPE "community_join_policy_enum" AS ENUM ('open', 'restricted', 'private')
    `);

    await queryRunner.query(`
      CREATE TABLE "communities" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "iconUrl" VARCHAR(500),
        "bannerUrl" VARCHAR(500),
        "creatorId" UUID,
        "isPublic" BOOLEAN DEFAULT true,
        "joinPolicy" "community_join_policy_enum" DEFAULT 'open',
        "isNsfw" BOOLEAN DEFAULT false,
        "memberCount" INTEGER DEFAULT 0,
        "postCount" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ,
        CONSTRAINT "fk_communities_creator" FOREIGN KEY ("creatorId")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // communities 인덱스
    await queryRunner.query(
      `CREATE INDEX "idx_communities_slug" ON "communities"("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_communities_creator" ON "communities"("creatorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_communities_public" ON "communities"("isPublic") WHERE "isPublic" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_communities_member_count" ON "communities"("memberCount" DESC)`,
    );

    // =====================================================
    // 2. community_members 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TYPE "community_role_enum" AS ENUM ('owner', 'moderator', 'member')
    `);

    await queryRunner.query(`
      CREATE TYPE "membership_status_enum" AS ENUM ('active', 'pending', 'banned')
    `);

    await queryRunner.query(`
      CREATE TABLE "community_members" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "role" "community_role_enum" DEFAULT 'member',
        "status" "membership_status_enum" DEFAULT 'active',
        "userFlairId" UUID,
        "notificationsEnabled" BOOLEAN DEFAULT true,
        "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "uq_community_members" UNIQUE ("communityId", "userId"),
        CONSTRAINT "fk_community_members_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_members_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // community_members 인덱스
    await queryRunner.query(
      `CREATE INDEX "idx_community_members_user" ON "community_members"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_members_role" ON "community_members"("communityId", "role")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_members_status" ON "community_members"("communityId", "status")`,
    );

    // =====================================================
    // 3. community_rules 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE "community_rules" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "title" VARCHAR(100) NOT NULL,
        "description" TEXT NOT NULL,
        "displayOrder" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "fk_community_rules_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE
      )
    `);

    // community_rules 인덱스
    await queryRunner.query(
      `CREATE INDEX "idx_community_rules_order" ON "community_rules"("communityId", "displayOrder")`,
    );

    // =====================================================
    // 4. community_flairs 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TYPE "flair_type_enum" AS ENUM ('post', 'user')
    `);

    await queryRunner.query(`
      CREATE TABLE "community_flairs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "name" VARCHAR(64) NOT NULL,
        "backgroundColor" VARCHAR(7),
        "textColor" VARCHAR(7),
        "type" "flair_type_enum" DEFAULT 'post',
        "isEnabled" BOOLEAN DEFAULT true,
        "isModOnly" BOOLEAN DEFAULT false,
        "displayOrder" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "fk_community_flairs_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE
      )
    `);

    // community_flairs 인덱스
    await queryRunner.query(
      `CREATE INDEX "idx_community_flairs_type" ON "community_flairs"("communityId", "type")`,
    );

    // =====================================================
    // 5. community_posts 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TYPE "community_post_status_enum" AS ENUM ('draft', 'published', 'removed', 'spam')
    `);

    await queryRunner.query(`
      CREATE TABLE "community_posts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(300) NOT NULL,
        "slug" VARCHAR(100) NOT NULL UNIQUE,
        "content" TEXT NOT NULL,
        "content_markdown" TEXT,
        "communityId" UUID NOT NULL,
        "authorId" UUID NOT NULL,
        "flairId" UUID,
        "thumbnailImageId" UUID,
        "isPinned" BOOLEAN DEFAULT false,
        "isLocked" BOOLEAN DEFAULT false,
        "isNsfw" BOOLEAN DEFAULT false,
        "isSpoiler" BOOLEAN DEFAULT false,
        "likeCount" INTEGER DEFAULT 0,
        "commentCount" INTEGER DEFAULT 0,
        "viewCount" INTEGER DEFAULT 0,
        "tags" JSONB DEFAULT '[]',
        "status" "community_post_status_enum" DEFAULT 'published',
        "removalReason" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ,
        CONSTRAINT "fk_community_posts_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_posts_author" FOREIGN KEY ("authorId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_posts_flair" FOREIGN KEY ("flairId")
          REFERENCES "community_flairs"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_community_posts_thumbnail" FOREIGN KEY ("thumbnailImageId")
          REFERENCES "files"("id") ON DELETE SET NULL
      )
    `);

    // community_posts 인덱스 (성능 최적화)
    await queryRunner.query(
      `CREATE INDEX "idx_community_posts_slug" ON "community_posts"("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_posts_author" ON "community_posts"("authorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_posts_feed" ON "community_posts"("communityId", "status", "createdAt" DESC) WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_posts_pinned" ON "community_posts"("communityId", "isPinned", "createdAt" DESC) WHERE "isPinned" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_posts_hot" ON "community_posts"("communityId", "likeCount" DESC, "commentCount" DESC) WHERE "status" = 'published'`,
    );

    // =====================================================
    // 6. community_comments 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE "community_comments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "content" TEXT NOT NULL,
        "postId" UUID NOT NULL,
        "authorId" UUID NOT NULL,
        "parentCommentId" UUID,
        "likeCount" INTEGER DEFAULT 0,
        "replyCount" INTEGER DEFAULT 0,
        "isDeleted" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "fk_community_comments_post" FOREIGN KEY ("postId")
          REFERENCES "community_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_comments_author" FOREIGN KEY ("authorId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_comments_parent" FOREIGN KEY ("parentCommentId")
          REFERENCES "community_comments"("id") ON DELETE CASCADE
      )
    `);

    // community_comments 인덱스
    await queryRunner.query(
      `CREATE INDEX "idx_community_comments_post" ON "community_comments"("postId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_comments_author" ON "community_comments"("authorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_community_comments_parent" ON "community_comments"("parentCommentId")`,
    );

    // =====================================================
    // 7. community_post_likes 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE "community_post_likes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "postId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "uq_community_post_likes" UNIQUE ("postId", "userId"),
        CONSTRAINT "fk_community_post_likes_post" FOREIGN KEY ("postId")
          REFERENCES "community_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_post_likes_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // community_post_likes 인덱스
    await queryRunner.query(
      `CREATE INDEX "idx_community_post_likes_user" ON "community_post_likes"("userId")`,
    );

    // =====================================================
    // 8. community_bans 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE "community_bans" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "bannedById" UUID NOT NULL,
        "reason" TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "fk_community_bans_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_bans_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_bans_banned_by" FOREIGN KEY ("bannedById")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // community_bans 인덱스
    await queryRunner.query(
      `CREATE INDEX "idx_community_bans_lookup" ON "community_bans"("communityId", "userId") WHERE "isActive" = true`,
    );

    // =====================================================
    // 9. community_mod_logs 테이블 생성
    // =====================================================
    await queryRunner.query(`
      CREATE TABLE "community_mod_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" UUID NOT NULL,
        "moderatorId" UUID NOT NULL,
        "action" VARCHAR(50) NOT NULL,
        "targetUserId" UUID,
        "targetPostId" UUID,
        "reason" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "fk_community_mod_logs_community" FOREIGN KEY ("communityId")
          REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_community_mod_logs_moderator" FOREIGN KEY ("moderatorId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // community_mod_logs 인덱스
    await queryRunner.query(
      `CREATE INDEX "idx_community_mod_logs_time" ON "community_mod_logs"("communityId", "createdAt" DESC)`,
    );

    // =====================================================
    // userFlairId FK 추가 (community_flairs 테이블 생성 후)
    // =====================================================
    await queryRunner.query(`
      ALTER TABLE "community_members"
      ADD CONSTRAINT "fk_community_members_flair"
      FOREIGN KEY ("userFlairId") REFERENCES "community_flairs"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // FK 제약조건 먼저 삭제
    await queryRunner.query(
      `ALTER TABLE "community_members" DROP CONSTRAINT IF EXISTS "fk_community_members_flair"`,
    );

    // 테이블 삭제 (역순)
    await queryRunner.query(`DROP TABLE IF EXISTS "community_mod_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_bans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_post_likes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_posts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_flairs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "communities"`);

    // ENUM 타입 삭제
    await queryRunner.query(`DROP TYPE IF EXISTS "community_post_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "flair_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "membership_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "community_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "community_join_policy_enum"`);
  }
}
