import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHybridMarkdownStorage1755000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add content_markdown column to posts table (for storing markdown original)
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ADD COLUMN IF NOT EXISTS "content_markdown" text
        `);

        // Add content_type column to posts table (enum: 'markdown' | 'html')
        // Check if enum type exists
        const enumExists = await queryRunner.query(`
            SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'posts_content_type_enum')
        `);
        
        if (!enumExists[0].exists) {
            await queryRunner.query(`
                CREATE TYPE "posts_content_type_enum" AS ENUM('markdown', 'html')
            `);
        }
        
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ADD COLUMN IF NOT EXISTS "content_type" "posts_content_type_enum" NOT NULL DEFAULT 'html'
        `);

        // Add content_rendered_at column to posts table (timestamp when markdown was rendered)
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ADD COLUMN IF NOT EXISTS "content_rendered_at" TIMESTAMP
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove added columns
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "content_rendered_at"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "content_type"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "content_markdown"`);
        
        // Drop the enum type
        await queryRunner.query(`DROP TYPE IF EXISTS "posts_content_type_enum"`);
    }
}