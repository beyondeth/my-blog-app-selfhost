import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommunityPostHotScore1795000000000 implements MigrationInterface {
    name = 'AddCommunityPostHotScore1795000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add Generated Column for Hot Score
        // Formula: upvoteCount - downvoteCount
        // Using COALESCE to handle potential nulls (though defaults are 0)
        await queryRunner.query(`
            ALTER TABLE "community_posts" 
            ADD "hotScore" integer 
            GENERATED ALWAYS AS (COALESCE("upvoteCount", 0) - COALESCE("downvoteCount", 0)) STORED
        `);

        // Add Index for efficient sorting
        await queryRunner.query(`
            CREATE INDEX "IDX_community_posts_hotScore" ON "community_posts" ("hotScore")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_community_posts_hotScore"`);
        await queryRunner.query(`ALTER TABLE "community_posts" DROP COLUMN "hotScore"`);
    }
}
