import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEncryptedApiKeyToMcpApiKeys1804201000000
  implements MigrationInterface
{
  name = "AddEncryptedApiKeyToMcpApiKeys1804201000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mcp_api_keys"
      ADD COLUMN IF NOT EXISTS "encryptedApiKey" text
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "mcp_api_keys"."encryptedApiKey"
      IS 'AES-256-GCM encrypted full API key for secure reveal/copy'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mcp_api_keys"
      DROP COLUMN IF EXISTS "encryptedApiKey"
    `);
  }
}
