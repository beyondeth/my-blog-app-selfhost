import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 비디오 만료 필드 추가 마이그레이션
 *
 * @description
 * videos 테이블에 expires_at 컬럼을 추가합니다.
 * - 업로드 시 24시간 후로 설정 (임시 파일)
 * - 포스트 저장 시 null로 설정 (영구 보관)
 * - 크론에서 만료된 비디오 자동 삭제
 */
export class AddVideoExpirationField1787000000000
  implements MigrationInterface
{
  name = "AddVideoExpirationField1787000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // expires_at 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN "expires_at" TIMESTAMP
    `);

    // expires_at 인덱스 추가 (만료된 비디오 조회 성능 최적화)
    await queryRunner.query(`
      CREATE INDEX "IDX_videos_expires_at" ON "videos" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_videos_expires_at"
    `);

    // expires_at 컬럼 삭제
    await queryRunner.query(`
      ALTER TABLE "videos"
      DROP COLUMN IF EXISTS "expires_at"
    `);
  }
}
