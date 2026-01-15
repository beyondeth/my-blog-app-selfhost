import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 비디오 테이블 생성 마이그레이션
 *
 * @description
 * 1. videos 테이블 생성
 *    - Cloudflare R2 스토리지 경로 관리
 *    - 원본(raw) 및 압축본(processed) 분리
 *    - BullMQ 처리 상태 추적
 * 2. video_status enum 생성
 */
export class CreateVideosTable1785000000000 implements MigrationInterface {
  name = "CreateVideosTable1785000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. video_status enum 생성
    await queryRunner.query(`
      CREATE TYPE "video_status_enum" AS ENUM (
        'uploading',
        'processing',
        'ready',
        'failed'
      )
    `);

    // 2. videos 테이블 생성
    await queryRunner.query(`
      CREATE TABLE "videos" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "storage_key_raw" VARCHAR(512) NOT NULL,
        "storage_key_processed" VARCHAR(512),
        "original_name" VARCHAR(255) NOT NULL,
        "mime_type" VARCHAR(50) NOT NULL DEFAULT 'video/mp4',
        "resolution" INTEGER NOT NULL DEFAULT 720,
        "size_raw" BIGINT NOT NULL,
        "size_processed" BIGINT,
        "duration" FLOAT,
        "status" "video_status_enum" NOT NULL DEFAULT 'uploading',
        "error_message" TEXT,
        "processing_started_at" TIMESTAMPTZ,
        "processing_completed_at" TIMESTAMPTZ,
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "fk_videos_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 3. 인덱스 생성
    await queryRunner.query(`
      CREATE INDEX "idx_videos_user_id" ON "videos"("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_videos_status" ON "videos"("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_videos_created_at" ON "videos"("created_at")
    `);

    // 처리 대기 중인 비디오 조회용 인덱스
    await queryRunner.query(`
      CREATE INDEX "idx_videos_processing_pending" ON "videos"("status", "created_at")
        WHERE "status" IN ('uploading', 'processing')
    `);

    // 삭제되지 않은 비디오만 조회하는 부분 인덱스
    await queryRunner.query(`
      CREATE INDEX "idx_videos_active" ON "videos"("user_id", "created_at")
        WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_videos_active"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_videos_processing_pending"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_videos_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_videos_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_videos_user_id"`);

    // 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS "videos"`);

    // enum 삭제
    await queryRunner.query(`DROP TYPE IF EXISTS "video_status_enum"`);
  }
}
