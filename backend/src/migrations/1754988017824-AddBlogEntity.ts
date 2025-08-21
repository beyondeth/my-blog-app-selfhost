import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlogEntity1754988017824 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if blogs table exists
        const blogsTableExists = await queryRunner.hasTable('blogs');
        
        if (!blogsTableExists) {
            // Create blogs table
            await queryRunner.query(`
                CREATE TABLE "blogs" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "slug" character varying NOT NULL,
                    "name" character varying NOT NULL,
                    "description" character varying,
                    "thumbnailUrl" character varying,
                    "userId" uuid NOT NULL,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "UQ_blogs_slug" UNIQUE ("slug"),
                    CONSTRAINT "PK_blogs" PRIMARY KEY ("id")
                )
            `);

            // Add foreign key to users table
            await queryRunner.query(`
                ALTER TABLE "blogs" 
                ADD CONSTRAINT "FK_blogs_userId" 
                FOREIGN KEY ("userId") 
                REFERENCES "users"("id") 
                ON DELETE CASCADE
            `);
        }

        // Check if blogId column exists in posts table
        const columns = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'posts' 
            AND column_name = 'blogId'
        `);
        
        if (columns.length === 0) {
            // Add blogId column to posts table
            await queryRunner.query(`
                ALTER TABLE "posts" 
                ADD COLUMN "blogId" uuid
            `);
        }

        // Check if foreign key constraint exists
        const fkExists = await queryRunner.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'posts' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'FK_posts_blogId'
        `);
        
        if (fkExists.length === 0) {
            // Add foreign key constraint for posts.blogId
            await queryRunner.query(`
                ALTER TABLE "posts" 
                ADD CONSTRAINT "FK_posts_blogId" 
                FOREIGN KEY ("blogId") 
                REFERENCES "blogs"("id") 
                ON DELETE CASCADE
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign key constraint from posts
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "FK_posts_blogId"`);
        
        // Remove blogId column from posts
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "blogId"`);
        
        // Drop blogs table
        await queryRunner.query(`DROP TABLE IF EXISTS "blogs"`);
    }
}