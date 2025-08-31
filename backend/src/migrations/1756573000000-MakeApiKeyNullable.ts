import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeApiKeyNullable1756573000000 implements MigrationInterface {
    name = 'MakeApiKeyNullable1756573000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Make the old 'key' column nullable since we're using keyId and keySecret now
        await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "key" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore the NOT NULL constraint on 'key' column
        await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "key" SET NOT NULL`);
    }
}