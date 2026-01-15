import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Major Refactoring Phase 1-2-3 Migration
 *
 * **Phase 1: User/Post 테이블 분리 (체크포인트 1)**
 * - profiles: User 프로필 정보 분리
 * - subscriptions: 구독/결제 정보 분리
 * - account_settings: 계정 설정 분리
 * - post_stats: 포스트 통계 정보 분리
 * - post_metadata: 포스트 메타데이터 분리
 *
 * **Phase 2: Blog Alias 시스템 (체크포인트 2)**
 * - blogs.alias: 사용자 변경 가능 주소
 * - old_aliases: SEO 보호를 위한 이전 주소 저장
 *
 * **설계 원칙:**
 * - Single Responsibility Principle (단일 책임 원칙)
 * - 1:1 관계 (eager: false로 lazy loading)
 * - UUID v7 사용 (시간순 정렬)
 * - SEO 보호 (301 리다이렉트)
 */
export class MajorRefactoringPhase1231760000000000
  implements MigrationInterface
{
  name = "MajorRefactoringPhase1231760000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===============================================
    // Phase 1: User 테이블 분리
    // ===============================================

    // 1. profiles 테이블 생성 (이미 존재하면 건너뜀)
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "profiles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "name" character varying(100),
                "profileImage" character varying(500),
                "bio" character varying(500),
                "lastLoginProvider" character varying(50),
                "accountVerifiedAt" TIMESTAMP,
                "accountSecurityLevel" character varying(20) NOT NULL DEFAULT 'basic',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_profiles" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_profiles_userId" UNIQUE ("userId"),
                CONSTRAINT "FK_profiles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_profiles_userId" ON "profiles" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_profiles_accountSecurityLevel" ON "profiles" ("accountSecurityLevel")`,
    );

    // 2. user_subscriptions 테이블 생성 (이미 존재하면 건너뜀)
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_subscriptions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "subscriptionTier" character varying(20) NOT NULL DEFAULT 'FREE',
                "subscriptionStatus" character varying(20) NOT NULL DEFAULT 'ACTIVE',
                "subscriptionStartDate" TIMESTAMP,
                "subscriptionEndDate" TIMESTAMP,
                "stripeCustomerId" character varying(255),
                "stripeSubscriptionId" character varying(255),
                "isTrialUsed" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_subscriptions" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_subscriptions_userId" UNIQUE ("userId"),
                CONSTRAINT "FK_user_subscriptions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_subscriptions_userId" ON "user_subscriptions" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_subscriptions_tier" ON "user_subscriptions" ("subscriptionTier")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_subscriptions_status" ON "user_subscriptions" ("subscriptionStatus")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_subscriptions_endDate" ON "user_subscriptions" ("subscriptionEndDate")`,
    );

    // 3. account_settings 테이블 생성 (이미 존재하면 건너뜀)
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "account_settings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "refreshToken" character varying,
                "loginAttempts" integer NOT NULL DEFAULT 0,
                "lockedUntil" TIMESTAMP,
                "termsAcceptedAt" TIMESTAMP,
                "privacyAcceptedAt" TIMESTAMP,
                "marketingOptIn" boolean NOT NULL DEFAULT false,
                "marketingOptInAt" TIMESTAMP,
                "newsletterOptIn" boolean NOT NULL DEFAULT false,
                "gdprDeleteRequestedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_account_settings" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_account_settings_userId" UNIQUE ("userId"),
                CONSTRAINT "FK_account_settings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_account_settings_userId" ON "account_settings" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_account_settings_lockedUntil" ON "account_settings" ("lockedUntil")`,
    );

    // ===============================================
    // Phase 1: Post 테이블 분리
    // ===============================================

    // 4. post_stats 테이블 생성
    await queryRunner.query(`
            CREATE TABLE "post_stats" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "postId" uuid NOT NULL,
                "viewCount" integer NOT NULL DEFAULT 0,
                "likeCount" integer NOT NULL DEFAULT 0,
                "commentCount" integer NOT NULL DEFAULT 0,
                "qualityScore" integer DEFAULT NULL,
                "version" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_post_stats" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_post_stats_postId" UNIQUE ("postId"),
                CONSTRAINT "FK_post_stats_post" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
            )
        `);

    await queryRunner.query(
      `CREATE INDEX "IDX_post_stats_postId" ON "post_stats" ("postId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_stats_viewCount" ON "post_stats" ("viewCount" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_stats_likeCount" ON "post_stats" ("likeCount" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_stats_qualityScore" ON "post_stats" ("qualityScore" DESC)`,
    );

    // 5. post_metadata 테이블 생성
    await queryRunner.query(`
            CREATE TABLE "post_metadata" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "postId" uuid NOT NULL,
                "excerpt" character varying(500),
                "tagList" jsonb NOT NULL DEFAULT '[]',
                "category" character varying(100),
                "content_type" character varying(50) DEFAULT 'html',
                "content_rendered_at" TIMESTAMP,
                "publishedAt" TIMESTAMP,
                "isEditorPick" boolean NOT NULL DEFAULT false,
                "editorPickedAt" TIMESTAMP,
                "processingError" text,
                "processingCompletedAt" TIMESTAMP,
                "codeBlockCount" integer,
                "imageCount" integer,
                "isBackgroundProcessed" boolean NOT NULL DEFAULT false,
                "searchVector" tsvector,
                "indexedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_post_metadata" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_post_metadata_postId" UNIQUE ("postId"),
                CONSTRAINT "FK_post_metadata_post" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
            )
        `);

    await queryRunner.query(
      `CREATE INDEX "IDX_post_metadata_postId" ON "post_metadata" ("postId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_metadata_category" ON "post_metadata" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_metadata_isEditorPick_editorPickedAt" ON "post_metadata" ("isEditorPick", "editorPickedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_metadata_indexedAt" ON "post_metadata" ("indexedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_metadata_searchVector" ON "post_metadata" USING gin ("searchVector")`,
    );

    // ===============================================
    // Phase 2: Blog Alias 시스템
    // ===============================================

    // 6. blogs 테이블에 alias 컬럼 추가 (이미 존재하면 건너뜀)
    await queryRunner.query(
      `ALTER TABLE "blogs" ADD COLUMN IF NOT EXISTS "alias" character varying(100)`,
    );
    await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "blogs" ADD CONSTRAINT "UQ_blogs_alias" UNIQUE ("alias");
            EXCEPTION
                WHEN duplicate_table THEN NULL;
                WHEN duplicate_object THEN NULL;
            END $$;
        `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_blogs_alias" ON "blogs" ("alias")`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blogs"."alias" IS '사용자 변경 가능 주소 (@username 형식)'`,
    );

    // 7. old_aliases 테이블 생성 (이미 존재하면 건너뜀)
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "old_aliases" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "blogId" uuid NOT NULL,
                "oldAlias" character varying(100) NOT NULL,
                "changedAt" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_old_aliases" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_old_aliases_oldAlias" UNIQUE ("oldAlias"),
                CONSTRAINT "FK_old_aliases_blog" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE
            )
        `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_old_aliases_oldAlias" ON "old_aliases" ("oldAlias")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_old_aliases_blogId" ON "old_aliases" ("blogId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_old_aliases_changedAt" ON "old_aliases" ("changedAt")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "old_aliases" IS '이전 alias 보관 (SEO 301 리다이렉트용)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Phase 2: Blog Alias 시스템 제거
    await queryRunner.query(`DROP INDEX "public"."IDX_old_aliases_changedAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_old_aliases_blogId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_old_aliases_oldAlias"`);
    await queryRunner.query(`DROP TABLE "old_aliases"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_blogs_alias"`);
    await queryRunner.query(
      `ALTER TABLE "blogs" DROP CONSTRAINT "UQ_blogs_alias"`,
    );
    await queryRunner.query(`ALTER TABLE "blogs" DROP COLUMN "alias"`);

    // Phase 1: Post 테이블 분리 제거
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_metadata_searchVector"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_metadata_indexedAt"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_metadata_isEditorPick_editorPickedAt"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_post_metadata_category"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_post_metadata_postId"`);
    await queryRunner.query(`DROP TABLE "post_metadata"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_stats_qualityScore"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_post_stats_likeCount"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_post_stats_viewCount"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_post_stats_postId"`);
    await queryRunner.query(`DROP TABLE "post_stats"`);

    // Phase 1: User 테이블 분리 제거
    await queryRunner.query(
      `DROP INDEX "public"."IDX_account_settings_lockedUntil"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_account_settings_userId"`,
    );
    await queryRunner.query(`DROP TABLE "account_settings"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_subscriptions_endDate"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_subscriptions_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_subscriptions_tier"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_subscriptions_userId"`,
    );
    await queryRunner.query(`DROP TABLE "user_subscriptions"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_profiles_accountSecurityLevel"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_profiles_userId"`);
    await queryRunner.query(`DROP TABLE "profiles"`);
  }
}
