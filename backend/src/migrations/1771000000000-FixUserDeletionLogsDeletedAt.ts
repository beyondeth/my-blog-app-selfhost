import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUserDeletionLogsDeletedAt1771000000000 implements MigrationInterface {
  name = 'FixUserDeletionLogsDeletedAt1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_deletion_logs 테이블의 deletedAt 컬럼을 nullable로 변경
    await queryRunner.query(`
      ALTER TABLE "user_deletion_logs"
      ALTER COLUMN "deletedAt" DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백: deletedAt 컬럼에 NOT NULL 제약조건 추가
    await queryRunner.query(`
      ALTER TABLE "user_deletion_logs"
      ALTER COLUMN "deletedAt" SET NOT NULL;
    `);
  }
}