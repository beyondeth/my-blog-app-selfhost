import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBioToUser1754999999999 implements MigrationInterface {
    name = 'AddBioToUser1754999999999'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if bio column exists
        const columns = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'bio'
        `);
        
        if (columns.length === 0) {
            await queryRunner.query(`ALTER TABLE "users" ADD "bio" character varying(500)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
    }
}