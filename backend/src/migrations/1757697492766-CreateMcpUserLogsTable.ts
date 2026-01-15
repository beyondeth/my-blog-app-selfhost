import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMcpUserLogsTable1757697492766 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create mcp_user_logs table for tracking all MCP activities
    await queryRunner.query(`
            CREATE TABLE "mcp_user_logs" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid,
                "api_key_id" uuid,
                "action_type" character varying(50) NOT NULL CHECK (action_type IN ('read', 'write', 'search')),
                "action_category" character varying(50),
                "resource_type" character varying(50),
                "resource_id" uuid,
                "resource_slug" character varying(255),
                "client_type" character varying(50),
                "client_name" character varying(100),
                "client_version" character varying(50),
                "request_endpoint" character varying(255),
                "request_method" character varying(10),
                "response_status" integer,
                "response_time_ms" integer,
                "ip_address" character varying(45),
                "user_agent" text,
                "metadata" jsonb,
                "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_mcp_user_logs" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "mcp_user_logs"
            ADD CONSTRAINT "FK_mcp_user_logs_user_id"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "mcp_user_logs"
            ADD CONSTRAINT "FK_mcp_user_logs_api_key_id"
            FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Create indexes for better query performance
    await queryRunner.query(`
            CREATE INDEX "IDX_mcp_logs_user_time"
            ON "mcp_user_logs" ("user_id", "timestamp")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_mcp_logs_client"
            ON "mcp_user_logs" ("client_type", "timestamp")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_mcp_logs_action"
            ON "mcp_user_logs" ("action_type", "timestamp")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_mcp_logs_resource"
            ON "mcp_user_logs" ("resource_type", "resource_slug")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_mcp_logs_api_key"
            ON "mcp_user_logs" ("api_key_id", "timestamp")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mcp_logs_api_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mcp_logs_resource"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mcp_logs_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mcp_logs_client"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mcp_logs_user_time"`);

    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "mcp_user_logs" DROP CONSTRAINT IF EXISTS "FK_mcp_user_logs_api_key_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mcp_user_logs" DROP CONSTRAINT IF EXISTS "FK_mcp_user_logs_user_id"`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "mcp_user_logs"`);
  }
}
