import { MigrationInterface, QueryRunner } from "typeorm";

export class SeparateApiKeyIdSecret1756571240878 implements MigrationInterface {
    name = 'SeparateApiKeyIdSecret1756571240878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns for keyId and keySecret
        await queryRunner.query(`ALTER TABLE "api_keys" ADD "keyId" character varying`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD "keySecret" character varying`);
        
        // Generate unique keyId for existing records (akid_ prefix)
        await queryRunner.query(`
            UPDATE "api_keys" 
            SET "keyId" = 'akid_' || gen_random_uuid()::text 
            WHERE "keyId" IS NULL
        `);
        
        // Copy existing hashed key to keySecret for backward compatibility
        await queryRunner.query(`
            UPDATE "api_keys" 
            SET "keySecret" = "key" 
            WHERE "keySecret" IS NULL
        `);
        
        // Make keyId required and unique
        await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "keyId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD CONSTRAINT "UQ_api_keys_keyId" UNIQUE ("keyId")`);
        
        // Make keySecret required
        await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "keySecret" SET NOT NULL`);
        
        // Optionally drop the old key column (commented out for safety)
        // await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "key"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore the old key column if it was dropped
        // await queryRunner.query(`ALTER TABLE "api_keys" ADD "key" character varying`);
        // await queryRunner.query(`UPDATE "api_keys" SET "key" = "keySecret"`);
        // await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "key" SET NOT NULL`);
        // await queryRunner.query(`ALTER TABLE "api_keys" ADD CONSTRAINT "UQ_api_keys_key" UNIQUE ("key")`);
        
        // Remove new columns
        await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "UQ_api_keys_keyId"`);
        await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "keySecret"`);
        await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "keyId"`);
    }
}