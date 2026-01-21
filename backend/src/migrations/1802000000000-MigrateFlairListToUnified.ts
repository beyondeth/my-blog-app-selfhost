import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateFlairListToUnified1801000000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. "post_flair_list" 타입의 위젯을 "post_flairs"로 변경합니다.
    // 2. 메타데이터를 통합된 형식(showAll: true)으로 업데이트합니다.
    // 3. 제목이 '플레어'인 경우 '말머리'로 변경합니다.

    // 1. 충돌 방지: 'post_flair_list'가 있는 커뮤니티의 기존 'post_flairs'(하이라이트) 위젯을 삭제합니다.
    // (통합 시 '목록' 위젯을 '전체 보기' 모드의 통합 위젯으로 우선시하기 위함)
    await queryRunner.query(`
      DELETE FROM "community_sidebar_widgets"
      WHERE "type" = 'post_flairs'
      AND "community_id" IN (
        SELECT "community_id" FROM "community_sidebar_widgets" WHERE "type" = 'post_flair_list'
      )
    `);

    // 2. "post_flair_list" 타입의 위젯을 "post_flairs"로 변경합니다.
    await queryRunner.query(`
      UPDATE "community_sidebar_widgets"
      SET 
        "type" = 'post_flairs',
        "metadata" = jsonb_build_object(
          'showAll', true,
          'showFilterButton', COALESCE((metadata->>'showFilter')::boolean, true),
          'flairIds', '[]'::jsonb
        ),
        "title" = CASE 
          WHEN "title" = '플레어' THEN '말머리'
          ELSE "title"
        END
      WHERE "type" = 'post_flair_list'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백 시 원래대로 복구 (완벽한 복구는 어려울 수 있음)
    await queryRunner.query(`
      UPDATE "community_sidebar_widgets"
      SET 
        "type" = 'post_flair_list',
        "metadata" = jsonb_build_object(
          'showFilter', COALESCE((metadata->>'showFilterButton')::boolean, true)
        ),
        "title" = CASE 
          WHEN "title" = '말머리' THEN '플레어'
          ELSE "title"
        END
      WHERE "type" = 'post_flairs' AND (metadata->>'showAll')::boolean = true
    `);
  }
}
