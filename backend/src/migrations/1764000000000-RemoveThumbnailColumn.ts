import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveThumbnailColumn1764000000000 implements MigrationInterface {
  name = "RemoveThumbnailColumn1764000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // thumbnail 컬럼 삭제
    await queryRunner.query(
      `ALTER TABLE "posts" DROP COLUMN IF EXISTS "thumbnail"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // thumbnail 컬럼 다시 추가 (롤백용)
    await queryRunner.query(`ALTER TABLE "posts" ADD "thumbnail" text`);
  }
}
