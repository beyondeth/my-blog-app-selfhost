import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlogEntity1754988017824 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop existing blogs table if exists
        await queryRunner.query(`DROP TABLE IF EXISTS "blogs" CASCADE`);
        
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

        // Add blogId column to posts table
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ADD COLUMN IF NOT EXISTS "blogId" uuid
        `);

        // Add foreign key constraint for posts.blogId
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ADD CONSTRAINT "FK_posts_blogId" 
            FOREIGN KEY ("blogId") 
            REFERENCES "blogs"("id") 
            ON DELETE CASCADE
        `);
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