import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingPostMetadataColumns1761201000000 implements MigrationInterface {
    name = 'AddMissingPostMetadataColumns1761201000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // IF NOT EXISTS 사용으로 안전하게 컬럼 추가
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "wordCount" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "readingTimeMinutes" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "editCount" integer NOT NULL DEFAULT 0`);
        // searchVector는 이미 존재하므로 건너뛰기
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "indexedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "processingCompletedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "processingError" text`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "editorPickedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "isEditorPick" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "content_rendered_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "post_metadata" ADD COLUMN IF NOT EXISTS "content_type" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "content_type"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "content_rendered_at"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "publishedAt"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "isEditorPick"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "editorPickedAt"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "processingError"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "processingCompletedAt"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "indexedAt"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "searchVector"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "editCount"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "lastEditedAt"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "readingTimeMinutes"`);
        await queryRunner.query(`ALTER TABLE "post_metadata" DROP COLUMN IF EXISTS "wordCount"`);
    }
}