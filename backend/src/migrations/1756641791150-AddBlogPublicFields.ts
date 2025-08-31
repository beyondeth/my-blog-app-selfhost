import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlogPublicFields1756641791150 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add isPublic column to blogs table
        await queryRunner.query(`
            ALTER TABLE "blogs" 
            ADD COLUMN IF NOT EXISTS "isPublic" boolean DEFAULT true
        `);
        
        // Add allowComments column to blogs table
        await queryRunner.query(`
            ALTER TABLE "blogs" 
            ADD COLUMN IF NOT EXISTS "allowComments" boolean DEFAULT true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove allowComments column
        await queryRunner.query(`
            ALTER TABLE "blogs" 
            DROP COLUMN IF EXISTS "allowComments"
        `);
        
        // Remove isPublic column
        await queryRunner.query(`
            ALTER TABLE "blogs" 
            DROP COLUMN IF EXISTS "isPublic"
        `);
    }

}
