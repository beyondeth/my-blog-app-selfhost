import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVersionColumnToPost1755449121216 implements MigrationInterface {
    name = 'AddVersionColumnToPost1755449121216'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if version column exists
        const columns = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'posts' 
            AND column_name = 'version'
        `);
        
        if (columns.length === 0) {
            // First add the column with a default value for existing rows
            await queryRunner.query(`ALTER TABLE "posts" ADD "version" integer DEFAULT 1`);
            // Update all existing rows to have version 1
            await queryRunner.query(`UPDATE "posts" SET "version" = 1 WHERE "version" IS NULL`);
            // Now make it NOT NULL
            await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "version" SET NOT NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "version"`);
    }

}
