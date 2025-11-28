import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 음악 테이블에 가사 컬럼 추가
 * - lyrics: 일반 텍스트 가사 (USLT - Unsynchronized Lyrics)
 * - synced_lyrics: 동기화된 가사 데이터 (LRC 포맷 또는 SYLT에서 추출)
 *   JSONB 형태: [{ time: number(ms), text: string }, ...]
 */
export class AddLyricsToMusic1779000000000 implements MigrationInterface {
  name = 'AddLyricsToMusic1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 일반 가사 컬럼 추가 (긴 텍스트이므로 TEXT 타입)
    await queryRunner.query(`
      ALTER TABLE "musics"
      ADD COLUMN "lyrics" TEXT
    `);

    // 동기화된 가사 컬럼 추가 (타임스탬프 배열)
    // 형식: [{ "time": 1000, "text": "가사 첫 줄" }, { "time": 5000, "text": "가사 둘째 줄" }]
    await queryRunner.query(`
      ALTER TABLE "musics"
      ADD COLUMN "synced_lyrics" JSONB
    `);

    // 주석 추가 (문서화 목적)
    await queryRunner.query(`
      COMMENT ON COLUMN "musics"."lyrics" IS '일반 텍스트 가사 (ID3 USLT 태그에서 추출)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "musics"."synced_lyrics" IS '동기화된 가사 배열 [{ time: ms, text: string }] (LRC 파싱 또는 ID3 SYLT에서 추출)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "musics" DROP COLUMN "synced_lyrics"
    `);

    await queryRunner.query(`
      ALTER TABLE "musics" DROP COLUMN "lyrics"
    `);
  }
}
