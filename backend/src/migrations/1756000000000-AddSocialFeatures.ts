import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSocialFeatures1756000000000 implements MigrationInterface {
    name = 'AddSocialFeatures1756000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add displayName column to users table
        const displayNameExists = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'displayName'
        `);
        
        if (displayNameExists.length === 0) {
            await queryRunner.query(`ALTER TABLE "users" ADD "displayName" character varying(100)`);
        }

        // Check if follows table exists
        const followsTableExists = await queryRunner.hasTable('follows');
        
        if (!followsTableExists) {
            // Create follows table
            await queryRunner.query(`
                CREATE TABLE "follows" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "followerId" uuid NOT NULL,
                    "followingId" uuid NOT NULL,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_follows_id" PRIMARY KEY ("id"),
                    CONSTRAINT "UQ_follows_follower_following" UNIQUE ("followerId", "followingId")
                )
            `);

            // Add indexes for follows table
            await queryRunner.query(`CREATE INDEX "IDX_follows_followerId" ON "follows" ("followerId")`);
            await queryRunner.query(`CREATE INDEX "IDX_follows_followingId" ON "follows" ("followingId")`);
        }

        // Add foreign key constraints for follows table (only if table was created)
        if (!followsTableExists) {
            await queryRunner.query(`
                ALTER TABLE "follows" 
                ADD CONSTRAINT "FK_follows_follower" 
                FOREIGN KEY ("followerId") 
                REFERENCES "users"("id") 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION
            `);

            await queryRunner.query(`
                ALTER TABLE "follows" 
                ADD CONSTRAINT "FK_follows_following" 
                FOREIGN KEY ("followingId") 
                REFERENCES "users"("id") 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION
            `);
        }

        // Check if notifications table exists
        const notificationsTableExists = await queryRunner.hasTable('notifications');
        
        if (!notificationsTableExists) {
            // Create notifications table
            await queryRunner.query(`
                CREATE TABLE "notifications" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "recipientId" uuid NOT NULL,
                    "issuerId" uuid NOT NULL,
                    "postId" uuid,
                    "commentId" uuid,
                    "blogId" uuid,
                    "type" character varying NOT NULL,
                    "read" boolean NOT NULL DEFAULT false,
                    "message" text,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
                )
            `);

            // Add indexes for notifications table
            await queryRunner.query(`CREATE INDEX "IDX_notifications_recipientId_read" ON "notifications" ("recipientId", "read")`);
            await queryRunner.query(`CREATE INDEX "IDX_notifications_recipientId_createdAt" ON "notifications" ("recipientId", "createdAt")`);
        }

        // Add foreign key constraints for notifications table (only if table was created)
        if (!notificationsTableExists) {
            await queryRunner.query(`
                ALTER TABLE "notifications" 
                ADD CONSTRAINT "FK_notifications_recipient" 
                FOREIGN KEY ("recipientId") 
                REFERENCES "users"("id") 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION
            `);

            await queryRunner.query(`
                ALTER TABLE "notifications" 
                ADD CONSTRAINT "FK_notifications_issuer" 
                FOREIGN KEY ("issuerId") 
                REFERENCES "users"("id") 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION
            `);

            await queryRunner.query(`
                ALTER TABLE "notifications" 
                ADD CONSTRAINT "FK_notifications_post" 
                FOREIGN KEY ("postId") 
                REFERENCES "posts"("id") 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION
            `);

            await queryRunner.query(`
                ALTER TABLE "notifications" 
                ADD CONSTRAINT "FK_notifications_comment" 
                FOREIGN KEY ("commentId") 
                REFERENCES "comments"("id") 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION
            `);
        }

        // Update existing users to have displayName same as username initially
        await queryRunner.query(`
            UPDATE "users" 
            SET "displayName" = COALESCE("username", "email")
            WHERE "displayName" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints for notifications
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_comment"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_post"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_issuer"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_recipient"`);

        // Drop indexes for notifications
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_recipientId_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_recipientId_read"`);

        // Drop notifications table
        await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);

        // Drop foreign key constraints for follows
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT IF EXISTS "FK_follows_following"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT IF EXISTS "FK_follows_follower"`);

        // Drop indexes for follows
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_follows_followingId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_follows_followerId"`);

        // Drop follows table
        await queryRunner.query(`DROP TABLE IF EXISTS "follows"`);

        // Drop displayName column from users table
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "displayName"`);
    }
}