import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatIndexes1758117705918 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add indexes for messages table for better performance
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
            ON messages("conversationId")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_sender_id
            ON messages("senderId")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_created_at
            ON messages("createdAt" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
            ON messages("conversationId", "createdAt" DESC)
        `);

        // Add indexes for conversations table
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_conversations_user1_id
            ON conversations("user1Id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_conversations_user2_id
            ON conversations("user2Id")
        `);

        // Add indexes for user_blocks table
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_blocked
            ON user_blocks("blockerId", "blockedId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove indexes in reverse order
        await queryRunner.query(`DROP INDEX IF EXISTS idx_user_blocks_blocker_blocked`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_conversations_user2_id`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_conversations_user1_id`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_conversation_created`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_created_at`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_sender_id`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_conversation_id`);
    }
}