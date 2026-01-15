import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRuleFlairWidgetTypes1782000000001
  implements MigrationInterface
{
  name = "AddRuleFlairWidgetTypes1782000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."community_sidebar_widgets_type_enum"
      ADD VALUE IF NOT EXISTS 'community_rules'
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."community_sidebar_widgets_type_enum"
      ADD VALUE IF NOT EXISTS 'post_flair_list'
    `);
  }

  public async down(): Promise<void> {
    // PostgreSQL enum 값 제거는 쉽지 않으므로 down 미지원
  }
}
