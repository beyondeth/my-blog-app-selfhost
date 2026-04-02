import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 3: 거래 채팅
 *
 * 기존 소셜 DM 인프라를 확장하여 거래 채팅 지원.
 * - Conversation: type(social/transaction), orderId, productPostId, retentionDays, isAdminViewable
 * - Message: messageType(text/system/product_card)
 * - 기존 대화는 모두 'social' 타입으로 유지 (하위 호환)
 */
export class AddTransactionChat1807200000000 implements MigrationInterface {
  name = "AddTransactionChat1807200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Conversation 확장 컬럼
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "type" varchar(20) NOT NULL DEFAULT 'social'
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "orderId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "productPostId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "retentionDays" integer NOT NULL DEFAULT 30
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "isAdminViewable" boolean NOT NULL DEFAULT false
    `);

    // FK 제약조건
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD CONSTRAINT "FK_conversations_order"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD CONSTRAINT "FK_conversations_product_post"
      FOREIGN KEY ("productPostId") REFERENCES "posts"("id") ON DELETE SET NULL
    `);

    // 거래 채팅: 주문당 1개 대화 (UNIQUE partial index)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_conversations_order_unique"
      ON "conversations" ("orderId") WHERE "orderId" IS NOT NULL
    `);
    // 타입 + 최근 메시지 시각 복합 인덱스
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversations_type_lastmsg"
      ON "conversations" ("type", "lastMessageAt" DESC)
    `);

    // 2. Message 확장 컬럼
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "messageType" varchar(20) NOT NULL DEFAULT 'text'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // Message
      await queryRunner.query(
        `ALTER TABLE "messages" DROP COLUMN IF EXISTS "messageType"`,
      );

      // Conversation indexes
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_conversations_type_lastmsg"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_conversations_order_unique"`,
      );

      // Conversation FK
      await queryRunner.query(
        `ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "FK_conversations_product_post"`,
      );
      await queryRunner.query(
        `ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "FK_conversations_order"`,
      );

      // Conversation columns
      await queryRunner.query(
        `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "isAdminViewable"`,
      );
      await queryRunner.query(
        `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "retentionDays"`,
      );
      await queryRunner.query(
        `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "productPostId"`,
      );
      await queryRunner.query(
        `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "orderId"`,
      );
      await queryRunner.query(
        `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "type"`,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }
}
