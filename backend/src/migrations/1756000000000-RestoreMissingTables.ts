import { MigrationInterface, QueryRunner } from "typeorm";

export class RestoreMissingTables1756000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if users table exists, if not create it
        const hasUsersTable = await queryRunner.hasTable('users');
        if (!hasUsersTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "users" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "email" character varying NOT NULL,
                    "username" character varying NOT NULL,
                    "password" character varying NOT NULL,
                    "displayName" character varying(100),
                    "profileImage" character varying,
                    "coverImage" character varying,
                    "bio" text,
                    "website" character varying,
                    "location" character varying,
                    "role" character varying NOT NULL DEFAULT 'user',
                    "authProvider" character varying NOT NULL DEFAULT 'local',
                    "providerId" character varying,
                    "emailVerified" boolean NOT NULL DEFAULT false,
                    "lastLoginAt" TIMESTAMP,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_users" PRIMARY KEY ("id"),
                    CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                    CONSTRAINT "UQ_users_username" UNIQUE ("username")
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
            await queryRunner.query(`CREATE INDEX "IDX_users_username" ON "users" ("username")`);
        }

        // Create blogs table
        const hasBlogsTable = await queryRunner.hasTable('blogs');
        if (!hasBlogsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "blogs" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "name" character varying NOT NULL,
                    "slug" character varying NOT NULL,
                    "description" text,
                    "user_id" uuid NOT NULL,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_blogs" PRIMARY KEY ("id"),
                    CONSTRAINT "UQ_blogs_slug" UNIQUE ("slug"),
                    CONSTRAINT "UQ_blogs_user_id" UNIQUE ("user_id"),
                    CONSTRAINT "FK_blogs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_blogs_slug" ON "blogs" ("slug")`);
            await queryRunner.query(`CREATE INDEX "IDX_blogs_user_id" ON "blogs" ("user_id")`);
        }

        // Create posts table
        const hasPostsTable = await queryRunner.hasTable('posts');
        if (!hasPostsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "posts" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "title" character varying NOT NULL,
                    "slug" character varying NOT NULL,
                    "content" text,
                    "contentMarkdown" text,
                    "excerpt" character varying(500),
                    "published" boolean NOT NULL DEFAULT false,
                    "publishedAt" TIMESTAMP,
                    "featuredImage" character varying,
                    "viewCount" integer NOT NULL DEFAULT 0,
                    "version" integer NOT NULL DEFAULT 1,
                    "blog_id" uuid NOT NULL,
                    "author_id" uuid NOT NULL,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_posts" PRIMARY KEY ("id"),
                    CONSTRAINT "UQ_posts_blog_slug" UNIQUE ("blog_id", "slug"),
                    CONSTRAINT "FK_posts_blog" FOREIGN KEY ("blog_id") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                    CONSTRAINT "FK_posts_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_posts_slug" ON "posts" ("slug")`);
            await queryRunner.query(`CREATE INDEX "IDX_posts_blog_id" ON "posts" ("blog_id")`);
            await queryRunner.query(`CREATE INDEX "IDX_posts_author_id" ON "posts" ("author_id")`);
            await queryRunner.query(`CREATE INDEX "IDX_posts_published" ON "posts" ("published")`);
        }

        // Create comments table
        const hasCommentsTable = await queryRunner.hasTable('comments');
        if (!hasCommentsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "comments" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "content" text NOT NULL,
                    "user_id" uuid NOT NULL,
                    "post_id" uuid NOT NULL,
                    "parent_id" uuid,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_comments" PRIMARY KEY ("id"),
                    CONSTRAINT "FK_comments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                    CONSTRAINT "FK_comments_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                    CONSTRAINT "FK_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_comments_user_id" ON "comments" ("user_id")`);
            await queryRunner.query(`CREATE INDEX "IDX_comments_post_id" ON "comments" ("post_id")`);
            await queryRunner.query(`CREATE INDEX "IDX_comments_parent_id" ON "comments" ("parent_id")`);
        }

        // Create tags table
        const hasTagsTable = await queryRunner.hasTable('tags');
        if (!hasTagsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "tags" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "name" character varying NOT NULL,
                    "slug" character varying NOT NULL,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_tags" PRIMARY KEY ("id"),
                    CONSTRAINT "UQ_tags_slug" UNIQUE ("slug")
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_tags_slug" ON "tags" ("slug")`);
        }

        // Create post_tags junction table
        const hasPostTagsTable = await queryRunner.hasTable('post_tags');
        if (!hasPostTagsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "post_tags" (
                    "post_id" uuid NOT NULL,
                    "tag_id" uuid NOT NULL,
                    CONSTRAINT "PK_post_tags" PRIMARY KEY ("post_id", "tag_id"),
                    CONSTRAINT "FK_post_tags_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                    CONSTRAINT "FK_post_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_post_tags_post_id" ON "post_tags" ("post_id")`);
            await queryRunner.query(`CREATE INDEX "IDX_post_tags_tag_id" ON "post_tags" ("tag_id")`);
        }

        // Create api_keys table
        const hasApiKeysTable = await queryRunner.hasTable('api_keys');
        if (!hasApiKeysTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "api_keys" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "name" character varying NOT NULL,
                    "key" character varying NOT NULL,
                    "user_id" uuid NOT NULL,
                    "expiresAt" TIMESTAMP,
                    "lastUsedAt" TIMESTAMP,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_api_keys" PRIMARY KEY ("id"),
                    CONSTRAINT "UQ_api_keys_key" UNIQUE ("key"),
                    CONSTRAINT "FK_api_keys_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_api_keys_key" ON "api_keys" ("key")`);
            await queryRunner.query(`CREATE INDEX "IDX_api_keys_user_id" ON "api_keys" ("user_id")`);
        }

        // Create email_verifications table
        const hasEmailVerificationsTable = await queryRunner.hasTable('email_verifications');
        if (!hasEmailVerificationsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "email_verifications" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "email" character varying NOT NULL,
                    "token" character varying NOT NULL,
                    "user_id" uuid NOT NULL,
                    "expiresAt" TIMESTAMP NOT NULL,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_email_verifications" PRIMARY KEY ("id"),
                    CONSTRAINT "UQ_email_verifications_token" UNIQUE ("token"),
                    CONSTRAINT "FK_email_verifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_email_verifications_token" ON "email_verifications" ("token")`);
            await queryRunner.query(`CREATE INDEX "IDX_email_verifications_user_id" ON "email_verifications" ("user_id")`);
        }

        // Create audit_logs table
        const hasAuditLogsTable = await queryRunner.hasTable('audit_logs');
        if (!hasAuditLogsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "audit_logs" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "entityType" character varying NOT NULL,
                    "entityId" character varying NOT NULL,
                    "action" character varying NOT NULL,
                    "userId" uuid,
                    "metadata" jsonb,
                    "ipAddress" character varying,
                    "userAgent" character varying,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entityType_entityId" ON "audit_logs" ("entityType", "entityId")`);
            await queryRunner.query(`CREATE INDEX "IDX_audit_logs_userId" ON "audit_logs" ("userId")`);
            await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt")`);
        }

        // Create follows table
        const hasFollowsTable = await queryRunner.hasTable('follows');
        if (!hasFollowsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "follows" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "follower_id" uuid NOT NULL,
                    "following_id" uuid NOT NULL,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_follows" PRIMARY KEY ("id"),
                    CONSTRAINT "UQ_follows_pair" UNIQUE ("follower_id", "following_id"),
                    CONSTRAINT "FK_follows_follower" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                    CONSTRAINT "FK_follows_following" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_follows_follower_id" ON "follows" ("follower_id")`);
            await queryRunner.query(`CREATE INDEX "IDX_follows_following_id" ON "follows" ("following_id")`);
        }

        // Create notifications table
        const hasNotificationsTable = await queryRunner.hasTable('notifications');
        if (!hasNotificationsTable) {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "notifications" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "type" character varying NOT NULL,
                    "message" text NOT NULL,
                    "read" boolean NOT NULL DEFAULT false,
                    "recipient_id" uuid NOT NULL,
                    "actor_id" uuid,
                    "entity_type" character varying,
                    "entity_id" character varying,
                    "metadata" jsonb,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
                    CONSTRAINT "FK_notifications_recipient" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                    CONSTRAINT "FK_notifications_actor" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
                )
            `);
            await queryRunner.query(`CREATE INDEX "IDX_notifications_recipient_id" ON "notifications" ("recipient_id")`);
            await queryRunner.query(`CREATE INDEX "IDX_notifications_read" ON "notifications" ("read")`);
            await queryRunner.query(`CREATE INDEX "IDX_notifications_createdAt" ON "notifications" ("createdAt")`);
        }

        // Now add foreign key constraint to files table for user_id
        const hasFileUserFK = await queryRunner.query(`
            SELECT COUNT(*) as count
            FROM information_schema.table_constraints
            WHERE constraint_name = 'FK_files_user'
            AND table_name = 'files'
        `);
        
        if (hasFileUserFK[0].count === '0') {
            await queryRunner.query(`
                ALTER TABLE "files" 
                ADD CONSTRAINT "FK_files_user" 
                FOREIGN KEY ("user_id") 
                REFERENCES "users"("id") 
                ON DELETE CASCADE ON UPDATE NO ACTION
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This migration should not be rolled back as it restores critical tables
        console.log('This migration restores critical tables and should not be rolled back');
    }
}