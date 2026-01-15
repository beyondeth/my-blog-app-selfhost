import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * audit_logs.performedById를 nullable로 변경하고 ON DELETE SET NULL 추가
 *
 * 목적: 법적 감사 로그 보존
 * - 사용자가 영구 삭제되어도 감사 로그는 유지되어야 함
 * - performedById만 NULL로 설정하여 "삭제된 사용자"임을 표시
 *
 * 변경사항:
 * 1. performedById 컬럼을 nullable로 변경
 * 2. 외래 키 제약 조건을 ON DELETE SET NULL로 변경
 */
export class UpdateAuditLogsPerformedByIdNullable1761466000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 기존 외래 키 제약 조건 이름 찾기
    const foreignKeys = await queryRunner.query(`
      SELECT
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'audit_logs'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'performedById'
    `);

    if (foreignKeys.length > 0) {
      const constraintName = foreignKeys[0].constraint_name;

      // 2. 기존 외래 키 제약 조건 제거
      await queryRunner.query(`
        ALTER TABLE "audit_logs"
        DROP CONSTRAINT "${constraintName}"
      `);
    }

    // 3. performedById 컬럼을 nullable로 변경
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "performedById" DROP NOT NULL
    `);

    // 4. 새로운 외래 키 제약 조건 추가 (ON DELETE SET NULL)
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD CONSTRAINT "FK_audit_logs_performedById"
      FOREIGN KEY ("performedById")
      REFERENCES "users"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 새로운 외래 키 제약 조건 제거
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP CONSTRAINT "FK_audit_logs_performedById"
    `);

    // 2. performedById가 NULL인 레코드 삭제 (rollback을 위해)
    // 주의: 실제 프로덕션에서는 이 작업을 신중하게 수행해야 함
    await queryRunner.query(`
      DELETE FROM "audit_logs"
      WHERE "performedById" IS NULL
    `);

    // 3. performedById 컬럼을 NOT NULL로 변경
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "performedById" SET NOT NULL
    `);

    // 4. 기존 외래 키 제약 조건 복원 (ON DELETE 없음)
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD CONSTRAINT "FK_371007aca0b12c07d6d2dbdb83a"
      FOREIGN KEY ("performedById")
      REFERENCES "users"("id")
    `);
  }
}
