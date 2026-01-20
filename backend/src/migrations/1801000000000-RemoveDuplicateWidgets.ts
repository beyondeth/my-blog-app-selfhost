import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDuplicateWidgets1801000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 중복 위젯 삭제 (커뮤니티 규칙, 플레어 목록만 해당)
    await queryRunner.query(`
      DELETE FROM "community_sidebar_widgets"
      WHERE id IN (
        SELECT id FROM (
          SELECT 
            id,
            ROW_NUMBER() OVER (
              PARTITION BY "community_id", "type" 
              ORDER BY "created_at" ASC, id ASC
            ) as rn
          FROM "community_sidebar_widgets"
          WHERE "type" IN ('community_rules', 'post_flair_list')
        ) duplicates
        WHERE rn > 1
      )
    `);

    // 2. 유니크 제약조건 추가 (싱글톤 위젯만 1개로 제한)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_community_widget_singleton"
      ON "community_sidebar_widgets" ("community_id", "type")
      WHERE "type" IN ('community_rules', 'post_flair_list', 'bookmarks', 'post_flairs', 'community_list', 'calendar')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_community_widget_singleton"`);
  }
}
