import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 음악 테이블 생성 마이그레이션
 * BGM 플레이어 기능을 위한 음악 파일 메타데이터 저장
 */
export class CreateMusicsTable1764221012636 implements MigrationInterface {
  name = "CreateMusicsTable1764221012636";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // musics 테이블 생성
    await queryRunner.query(`
      CREATE TABLE "musics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "original_name" character varying NOT NULL,
        "file_key" character varying NOT NULL,
        "file_size" integer NOT NULL,
        "mime_type" character varying NOT NULL,
        "duration" double precision,
        "title" character varying,
        "artist" character varying,
        "album" character varying,
        "year" integer,
        "genre" character varying,
        "track_number" character varying,
        "cover_image_key" character varying,
        "display_title" character varying,
        "display_artist" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "play_order" integer NOT NULL DEFAULT 0,
        "uploaded_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_musics_id" PRIMARY KEY ("id")
      )
    `);

    // 인덱스 생성
    await queryRunner.query(`
      CREATE INDEX "IDX_musics_is_active_order" ON "musics" ("is_active", "play_order")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_musics_uploaded_by_id" ON "musics" ("uploaded_by_id")
    `);

    // 외래 키 제약조건 (users 테이블 참조)
    await queryRunner.query(`
      ALTER TABLE "musics"
      ADD CONSTRAINT "FK_musics_uploaded_by"
      FOREIGN KEY ("uploaded_by_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 외래 키 제약조건 삭제
    await queryRunner.query(`
      ALTER TABLE "musics" DROP CONSTRAINT "FK_musics_uploaded_by"
    `);

    // 인덱스 삭제
    await queryRunner.query(`DROP INDEX "IDX_musics_uploaded_by_id"`);
    await queryRunner.query(`DROP INDEX "IDX_musics_is_active_order"`);

    // 테이블 삭제
    await queryRunner.query(`DROP TABLE "musics"`);
  }
}
