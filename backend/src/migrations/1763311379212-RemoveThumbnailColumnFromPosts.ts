import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveThumbnailColumnFromPosts1763311379212
  implements MigrationInterface
{
  name = "RemoveThumbnailColumnFromPosts1763311379212";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 먼저 thumbnail 컬럼을 사용하는 materialized view 드랍
    await queryRunner.query(`
      DROP MATERIALIZED VIEW IF EXISTS "mv_popular_posts"
    `);

    // 2. thumbnail 컬럼 제거 (Post 엔티티에서 thumbnailImageId만 사용)
    await queryRunner.query(`
      ALTER TABLE "posts"
      DROP COLUMN IF EXISTS "thumbnail"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: thumbnail 컬럼 다시 추가 (복원을 위함)
    await queryRunner.query(`
      ALTER TABLE "posts"
      ADD COLUMN "thumbnail" text
    `);
  }
}
