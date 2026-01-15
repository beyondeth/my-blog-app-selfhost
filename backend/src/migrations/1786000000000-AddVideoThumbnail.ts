import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 비디오 썸네일 컬럼 추가 마이그레이션
 *
 * @description
 * videos 테이블에 thumbnail_key 컬럼을 추가합니다.
 * FFmpeg로 비디오에서 추출한 썸네일 이미지의 R2 스토리지 경로를 저장합니다.
 */
export class AddVideoThumbnail1786000000000 implements MigrationInterface {
  name = "AddVideoThumbnail1786000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // thumbnail_key 컬럼 추가 (videos/thumbnails/{uuid}.jpg 형태의 R2 경로)
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN "thumbnail_key" VARCHAR(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // thumbnail_key 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE "videos"
      DROP COLUMN IF EXISTS "thumbnail_key"
    `);
  }
}
