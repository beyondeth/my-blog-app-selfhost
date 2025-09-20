import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorReadStatusToLastReadTimestamp1758549600000 implements MigrationInterface {
    name = 'RefactorReadStatusToLastReadTimestamp1758549600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns to conversations table
        await queryRunner.query(`ALTER TABLE "conversations" ADD "user1LastReadAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "user2LastReadAt" TIMESTAMP WITH TIME ZONE`);

        // Initialize lastReadAt with current time for existing conversations
        await queryRunner.query(`
            UPDATE "conversations"
            SET "user1LastReadAt" = NOW(),
                "user2LastReadAt" = NOW()
        `);

        // Drop the index on messages.isRead before removing the column
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_conversationId_isRead"`);

        // Remove isRead and readAt columns from messages table
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN IF EXISTS "isRead"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN IF EXISTS "readAt"`);

        // Add indexes for better performance
        await queryRunner.query(`CREATE INDEX "IDX_conversations_user1_lastRead" ON "conversations" ("user1Id", "user1LastReadAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_conversations_user2_lastRead" ON "conversations" ("user2Id", "user2LastReadAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the new indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user1_lastRead"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user2_lastRead"`);

        // Add back the old columns to messages table
        await queryRunner.query(`ALTER TABLE "messages" ADD "readAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "messages" ADD "isRead" boolean NOT NULL DEFAULT false`);

        // Recreate the old index
        await queryRunner.query(`CREATE INDEX "IDX_messages_conversationId_isRead" ON "messages" ("conversationId", "isRead")`);

        // Remove the new columns from conversations table
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN IF EXISTS "user2LastReadAt"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN IF EXISTS "user1LastReadAt"`);
    }
}