import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * MCP API Key 테이블 생성
 *
 * Stripe 스타일 API Key 관리:
 * - keyHint: 8자 식별자 (공개 가능)
 * - keyHash: bcrypt 해시
 * - 90일 자동 만료
 * - 사용자당 1개 제한
 */
export class CreateMcpApiKeyTable1760697657000 implements MigrationInterface {
  name = "CreateMcpApiKeyTable1760697657000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 테이블이 이미 존재하는지 체크
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'mcp_api_keys'
      ) as exists
    `);

    // 테이블이 없을 때만 생성
    if (!tableExists[0].exists) {
      await queryRunner.query(`
        CREATE TABLE "mcp_api_keys" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "keyHint" character varying(8) NOT NULL UNIQUE,
          "keyHash" character varying NOT NULL,
          "name" character varying NOT NULL,
          "userId" uuid NOT NULL,
          "blogId" uuid NOT NULL,
          "isActive" boolean NOT NULL DEFAULT true,
          "lastUsedAt" timestamp with time zone,
          "requestCount" integer NOT NULL DEFAULT 0,
          "postsCreated" integer NOT NULL DEFAULT 0,
          "expiresAt" timestamp with time zone NOT NULL,
          "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
          "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
          CONSTRAINT "FK_mcp_api_keys_userId" FOREIGN KEY ("userId")
            REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_mcp_api_keys_blogId" FOREIGN KEY ("blogId")
            REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
    }

    // 인덱스 생성 (성능 최적화) - IF NOT EXISTS 추가
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mcp_api_keys_keyHint" ON "mcp_api_keys" ("keyHint")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mcp_api_keys_userId_isActive" ON "mcp_api_keys" ("userId", "isActive")
    `);

    // 주석 추가
    await queryRunner.query(`
      COMMENT ON TABLE "mcp_api_keys" IS 'MCP API Keys for Claude Code integration'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "mcp_api_keys"."keyHint" IS '공개 가능한 8자 식별자 (예: a1b2c3d4)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "mcp_api_keys"."keyHash" IS 'bcrypt 해시된 전체 API Key'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "mcp_api_keys"."expiresAt" IS '만료 시간 (생성 시 +90일)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_mcp_api_keys_userId_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_mcp_api_keys_keyHint"`);
    await queryRunner.query(`DROP TABLE "mcp_api_keys"`);
  }
}
