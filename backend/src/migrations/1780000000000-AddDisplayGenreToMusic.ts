import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Music 테이블에 display_genre 컬럼 추가
 * 관리자가 ID3 메타데이터의 genre를 덮어쓸 수 있는 표시용 장르 필드
 */
export class AddDisplayGenreToMusic1780000000000 implements MigrationInterface {
  name = "AddDisplayGenreToMusic1780000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "musics"
      ADD COLUMN "display_genre" varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "musics"
      DROP COLUMN "display_genre"
    `);
  }
}
