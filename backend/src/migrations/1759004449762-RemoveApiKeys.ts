import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveApiKeys1759004449762 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // MCP 로그 테이블에서 API Key 관련 제약사항 및 인덱스 제거
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mcp_logs_api_key"`);

    // MCP 로그 테이블에서 외래 키 제약사항 제거 (있는 경우)
    const foreignKeys = await queryRunner.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'mcp_user_logs'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%api_key%'
        `);

    for (const fk of foreignKeys) {
      await queryRunner.query(
        `ALTER TABLE "mcp_user_logs" DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`,
      );
    }

    // MCP 로그 테이블에서 api_key_id 컬럼 제거
    await queryRunner.query(
      `ALTER TABLE "mcp_user_logs" DROP COLUMN IF EXISTS "api_key_id"`,
    );

    // API Keys 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // API Keys 테이블 재생성
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "api_keys" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "key" varchar NOT NULL,
                "name" varchar NOT NULL,
                "user_id" uuid,
                "blog_id" uuid,
                "is_active" boolean NOT NULL DEFAULT true,
                "expires_at" TIMESTAMP WITH TIME ZONE,
                "last_used_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_api_keys_id" PRIMARY KEY ("id")
            )
        `);

    // API Key 인덱스 재생성
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_api_key_key" ON "api_keys" ("key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_api_key_user" ON "api_keys" ("user_id")`,
    );

    // MCP 로그 테이블에 api_key_id 컬럼 재추가
    await queryRunner.query(
      `ALTER TABLE "mcp_user_logs" ADD "api_key_id" uuid`,
    );

    // MCP 로그 테이블에 인덱스 재추가
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_logs_api_key" ON "mcp_user_logs" ("api_key_id", "timestamp")`,
    );
  }
}
