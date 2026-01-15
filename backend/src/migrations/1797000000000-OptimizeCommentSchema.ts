import { MigrationInterface, QueryRunner } from "typeorm";

export class OptimizeCommentSchema1797000000000 implements MigrationInterface {
    name = 'OptimizeCommentSchema1797000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add Columns
        await queryRunner.query(`ALTER TABLE "comments" ADD "blogId" uuid`);
        await queryRunner.query(`ALTER TABLE "community_comments" ADD "communityId" uuid`);

        // 2. Backfill Data
        await queryRunner.query(`UPDATE "comments" SET "blogId" = "posts"."blogId" FROM "posts" WHERE "comments"."postId" = "posts"."id"`);
        await queryRunner.query(`UPDATE "community_comments" SET "communityId" = "community_posts"."communityId" FROM "community_posts" WHERE "community_comments"."postId" = "community_posts"."id"`);

        // 3. Set NOT NULL for communityId
        await queryRunner.query(`ALTER TABLE "community_comments" ALTER COLUMN "communityId" SET NOT NULL`);

        // 4. Create Indexes (Using IDs from original generation to match TypeORM)
        await queryRunner.query(`CREATE INDEX "IDX_6606e50d3a1b4a5fe6b301c9c8" ON "comments" ("blogId", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_3a99d4b97b002a13f08c2a56c7" ON "community_comments" ("communityId", "isDeleted")`);
        await queryRunner.query(`CREATE INDEX "IDX_9d408095f2f378600da738da00" ON "community_comments" ("communityId", "createdAt")`);

        // 5. Add Foreign Keys
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_42a37ec3be9f871d4e44dd21bf9" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_comments" ADD CONSTRAINT "FK_8aa22eefc417253522bcc3edabe" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop FKs
        await queryRunner.query(`ALTER TABLE "community_comments" DROP CONSTRAINT "FK_8aa22eefc417253522bcc3edabe"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_42a37ec3be9f871d4e44dd21bf9"`);

        // Drop Indexes
        await queryRunner.query(`DROP INDEX "IDX_9d408095f2f378600da738da00"`);
        await queryRunner.query(`DROP INDEX "IDX_3a99d4b97b002a13f08c2a56c7"`);
        await queryRunner.query(`DROP INDEX "IDX_6606e50d3a1b4a5fe6b301c9c8"`);

        // Drop Columns
        await queryRunner.query(`ALTER TABLE "community_comments" DROP COLUMN "communityId"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "blogId"`);
    }
}
