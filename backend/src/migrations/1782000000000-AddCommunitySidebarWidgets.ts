import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommunitySidebarWidgets1782000000000
  implements MigrationInterface
{
  name = "AddCommunitySidebarWidgets1782000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."community_sidebar_widgets_type_enum" AS ENUM(
        'text',
        'buttons',
        'images',
        'community_list',
        'calendar',
        'post_flairs',
        'bookmarks'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "community_sidebar_widgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "community_id" uuid NOT NULL,
        "type" "public"."community_sidebar_widgets_type_enum" NOT NULL,
        "order_index" integer NOT NULL DEFAULT 0,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "title" character varying(120),
        "description" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_5d2b58d0fdb82de8ab1bf0ca84c" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_widget_community_type"
        ON "community_sidebar_widgets" ("community_id", "type")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_widget_order"
        ON "community_sidebar_widgets" ("community_id", "order_index")
    `);

    await queryRunner.query(`
      ALTER TABLE "community_sidebar_widgets"
      ADD CONSTRAINT "FK_widget_community"
      FOREIGN KEY ("community_id") REFERENCES "communities"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."community_sidebar_widget_entries_entry_type_enum" AS ENUM(
        'text',
        'link',
        'bookmark',
        'image',
        'community',
        'event'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "community_sidebar_widget_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "widget_id" uuid NOT NULL,
        "entry_type" "public"."community_sidebar_widget_entries_entry_type_enum" NOT NULL,
        "order_index" integer NOT NULL DEFAULT 0,
        "label" character varying(150),
        "body" text,
        "link_url" character varying(500),
        "image_url" character varying(500),
        "image_alt" character varying(255),
        "cta_label" character varying(120),
        "cta_url" character varying(500),
        "target_community_id" uuid,
        "starts_at" TIMESTAMP WITH TIME ZONE,
        "ends_at" TIMESTAMP WITH TIME ZONE,
        "location" character varying(250),
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_911240f0fb2bc67fbf91195bf9b" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_widget_entry_widget" ON "community_sidebar_widget_entries" ("widget_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_widget_entry_target_community"
        ON "community_sidebar_widget_entries" ("target_community_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "community_sidebar_widget_entries"
      ADD CONSTRAINT "FK_widget_entry_widget"
      FOREIGN KEY ("widget_id") REFERENCES "community_sidebar_widgets"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "community_sidebar_widget_entries"
      ADD CONSTRAINT "FK_widget_entry_target_community"
      FOREIGN KEY ("target_community_id") REFERENCES "communities"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."file_contexts_contexttype_enum"
      ADD VALUE IF NOT EXISTS 'community_widget'
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."file_contexts_purpose_enum"
      ADD VALUE IF NOT EXISTS 'widget_asset'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "community_sidebar_widget_entries"
      DROP CONSTRAINT "FK_widget_entry_target_community"
    `);
    await queryRunner.query(`
      ALTER TABLE "community_sidebar_widget_entries"
      DROP CONSTRAINT "FK_widget_entry_widget"
    `);
    await queryRunner.query(`
      ALTER TABLE "community_sidebar_widgets"
      DROP CONSTRAINT "FK_widget_community"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_widget_entry_target_community"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_widget_entry_widget"
    `);
    await queryRunner.query(`
      DROP TABLE "community_sidebar_widget_entries"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."community_sidebar_widget_entries_entry_type_enum"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_widget_order"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_widget_community_type"
    `);
    await queryRunner.query(`
      DROP TABLE "community_sidebar_widgets"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."community_sidebar_widgets_type_enum"
    `);

    // Enum 값 제거는 PostgreSQL 제약상 자동으로 되돌리지 않음
  }
}
