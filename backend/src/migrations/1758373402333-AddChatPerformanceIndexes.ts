import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatPerformanceIndexes1758373402333 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        /**
         * conversations 테이블 인덱스 추가
         * - user1Id, user2Id: 각각의 사용자로 대화 조회 최적화
         * - lastMessageAt: 대화 목록 정렬 최적화
         */

        // user1Id 단독 인덱스 (user1 관련 조회 최적화)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_conversations_user1Id"
            ON "conversations"("user1Id")
        `);

        // user2Id 단독 인덱스 (user2 관련 조회 최적화)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_conversations_user2Id"
            ON "conversations"("user2Id")
        `);

        /**
         * messages 테이블 인덱스 추가
         * - 대화별 메시지 조회 및 unread count 계산 최적화
         */

        // conversationId와 createdAt 복합 인덱스 (대화별 메시지 시간순 조회)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_messages_conversationId_createdAt"
            ON "messages"("conversationId", "createdAt" DESC)
        `);

        // senderId 인덱스 (특정 사용자가 보낸 메시지 조회)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_messages_senderId"
            ON "messages"("senderId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 인덱스 제거 (역순)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_senderId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_conversationId_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user2Id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_user1Id"`);
    }

}
