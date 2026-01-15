import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveMcpUserLogs1759005459352 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // mcp_user_logs 테이블 삭제 (CASCADE로 관련 제약사항도 함께 삭제)
    await queryRunner.query(`DROP TABLE IF EXISTS "mcp_user_logs" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // mcp_user_logs 테이블 재생성 (롤백 시)
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "mcp_user_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "blogId" uuid,
                "actionType" varchar NOT NULL,
                "actionCategory" varchar,
                "resourceType" varchar,
                "resourceId" uuid,
                "resourceSlug" varchar,
                "clientType" varchar,
                "requestEndpoint" varchar,
                "requestMethod" varchar,
                "ipAddress" varchar,
                "userAgent" text,
                "metadata" jsonb DEFAULT '{}',
                "responseTimeMs" integer,
                "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_mcp_user_logs_id" PRIMARY KEY ("id")
            )
        `);

    // 인덱스 재생성
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_logs_user" ON "mcp_user_logs" ("userId", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_logs_blog" ON "mcp_user_logs" ("blogId", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_logs_action" ON "mcp_user_logs" ("actionType", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_logs_resource" ON "mcp_user_logs" ("resourceType", "resourceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_logs_timestamp" ON "mcp_user_logs" ("timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_logs_client" ON "mcp_user_logs" ("clientType", "timestamp")`,
    );
  }
}
