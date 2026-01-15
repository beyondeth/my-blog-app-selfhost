import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVersionDefaultToPosts1761202000000
  implements MigrationInterface
{
  name = "AddVersionDefaultToPosts1761202000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // version 컬럼에 NOT NULL 제약조건과 기본값 1 설정
    // 먼저 NULL 값이 있는 경우 1로 업데이트
    await queryRunner.query(`
            UPDATE posts
            SET version = 1
            WHERE version IS NULL
        `);

    // 기본값 설정
    await queryRunner.query(`
            ALTER TABLE posts
            ALTER COLUMN version SET DEFAULT 1
        `);

    // NOT NULL 제약조건 추가 (이미 있다면 무시)
    await queryRunner.query(`
            ALTER TABLE posts
            ALTER COLUMN version SET NOT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 기본값 제거
    await queryRunner.query(`
            ALTER TABLE posts
            ALTER COLUMN version DROP DEFAULT
        `);

    // NOT NULL 제약조건 제거
    await queryRunner.query(`
            ALTER TABLE posts
            ALTER COLUMN version DROP NOT NULL
        `);
  }
}
